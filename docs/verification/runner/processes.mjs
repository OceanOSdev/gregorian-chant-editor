// Ownership and lifecycle of runner child processes.
//
// Every child is spawned from an argument array (never a shell string) as the
// leader of its own process group, so the runner can signal exactly that
// child and its descendants (browser helpers, esbuild/rolldown workers)
// without touching anything it did not start. Nothing here looks processes up
// by name or port.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';

const OUTPUT_LIMIT = 256 * 1024;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class SetupError extends Error {
  name = 'SetupError';
}

export class TimeoutError extends Error {
  name = 'TimeoutError';
}

function groupAlive(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function signalGroup(pgid, signal) {
  try {
    process.kill(-pgid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

export class ProcessRegistry {
  #processes = new Set();
  #parent;

  constructor(parent = null) {
    this.#parent = parent;
  }

  /** A registry for one job whose processes are also tracked by this one. */
  scope() {
    return new ProcessRegistry(this);
  }

  add(managed) {
    this.#processes.add(managed);
    this.#parent?.add(managed);
  }

  get active() {
    return [...this.#processes].filter((managed) => !managed.stopped);
  }

  async stopAll(options) {
    await Promise.all(this.active.map((managed) => managed.stop(options)));
  }
}

/**
 * A spawned child that owns its process group and log streams.
 */
export class ManagedProcess {
  stopped = false;
  exitInfo = null;
  #output = '';
  #listeners = new Set();
  #streams;

  constructor({ name, command, args, env, cwd, stdoutPath, stderrPath }) {
    this.name = name;
    this.command = command;
    this.args = args;
    const stdout = createWriteStream(stdoutPath, { flags: 'a' });
    const stderr =
      stderrPath && stderrPath !== stdoutPath
        ? createWriteStream(stderrPath, { flags: 'a' })
        : stdout;
    this.#streams = [...new Set([stdout, stderr])];
    this.child = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.pid = this.child.pid;
    const capture = (stream) => (chunk) => {
      stream.write(chunk);
      this.#output = (this.#output + chunk.toString()).slice(-OUTPUT_LIMIT);
      for (const listener of this.#listeners) listener();
    };
    this.child.stdout.on('data', capture(stdout));
    this.child.stderr.on('data', capture(stderr));
    this.exited = new Promise((resolve) => {
      this.child.once('error', (error) => {
        this.exitInfo ??= { code: null, signal: null, error: error.message };
        resolve(this.exitInfo);
        for (const listener of this.#listeners) listener();
      });
      this.child.once('exit', (code, signal) => {
        this.exitInfo ??= { code, signal, error: null };
        resolve(this.exitInfo);
        for (const listener of this.#listeners) listener();
      });
    });
  }

  get output() {
    return this.#output;
  }

  get hasExited() {
    return this.exitInfo !== null;
  }

  describeExit() {
    const info = this.exitInfo;
    if (!info) return `${this.name} is running`;
    if (info.error) return `${this.name} failed to start: ${info.error}`;
    return `${this.name} exited early (code ${info.code}, signal ${info.signal})`;
  }

  /** Resolve with the first regex match in combined output. */
  waitForOutput(pattern, timeoutMs, description = String(pattern)) {
    return new Promise((resolve, reject) => {
      const check = () => {
        const match = this.#output.match(pattern);
        if (match) return finish(() => resolve(match));
        if (this.hasExited)
          return finish(() =>
            reject(
              new SetupError(
                `${this.describeExit()} while waiting for ${description}`,
              ),
            ),
          );
      };
      const timer = setTimeout(
        () =>
          finish(() =>
            reject(
              new TimeoutError(
                `${this.name}: no ${description} within ${timeoutMs} ms`,
              ),
            ),
          ),
        timeoutMs,
      );
      const finish = (settle) => {
        clearTimeout(timer);
        this.#listeners.delete(check);
        settle();
      };
      this.#listeners.add(check);
      check();
    });
  }

  /**
   * Stop the whole process group: SIGTERM, bounded wait, then SIGKILL.
   * Idempotent; never signals a group once it has been confirmed gone.
   */
  async stop({ graceMs = 5000, killMs = 5000 } = {}) {
    if (this.stopped) return;
    const pgid = this.pid;
    if (pgid !== undefined && groupAlive(pgid)) {
      signalGroup(pgid, 'SIGTERM');
      const deadline = Date.now() + graceMs;
      while (groupAlive(pgid) && Date.now() < deadline) await delay(50);
      if (groupAlive(pgid)) {
        signalGroup(pgid, 'SIGKILL');
        const killDeadline = Date.now() + killMs;
        while (groupAlive(pgid) && Date.now() < killDeadline) await delay(50);
      }
    }
    if (pgid !== undefined && !this.hasExited) {
      await Promise.race([this.exited, delay(killMs)]);
    }
    this.stopped = true;
    await this.closeLogs();
  }

  async closeLogs() {
    await Promise.all(
      this.#streams.map(async (stream) => {
        if (stream.writableEnded) return;
        stream.end();
        await once(stream, 'finish');
      }),
    );
  }
}

export function startProcess(registry, options) {
  const managed = new ManagedProcess(options);
  registry.add(managed);
  return managed;
}

/**
 * Poll `probe` until it returns a truthy value. Fails early if a watched
 * process exits, and with a TimeoutError after `timeoutMs`.
 */
export async function pollUntil(
  probe,
  { timeoutMs, intervalMs = 100, description, watch = [] },
) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  for (;;) {
    for (const managed of watch) {
      if (managed.hasExited)
        throw new SetupError(
          `${managed.describeExit()} while waiting for ${description}`,
        );
    }
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() >= deadline) {
      throw new TimeoutError(
        `No ${description} within ${timeoutMs} ms${lastError ? ` (last error: ${lastError.message})` : ''}`,
      );
    }
    await delay(intervalMs);
  }
}

export async function fetchWithTimeout(
  url,
  { timeoutMs = 2000, ...init } = {},
) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

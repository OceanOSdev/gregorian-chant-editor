// Pure argument parsing and job selection. Nothing here launches processes.
import { parseArgs } from 'node:util';
import { BROWSERS, DRIVERS, PRESETS } from './manifest.mjs';

export class UsageError extends Error {
  name = 'UsageError';
}

export const DEFAULTS = {
  preset: 'smoke',
  browsers: ['chromium'],
  concurrency: 2,
  startupTimeoutSeconds: 60,
  jobTimeoutSeconds: 600,
};

const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  list: { type: 'boolean' },
  driver: { type: 'string', multiple: true },
  preset: { type: 'string' },
  browser: { type: 'string', multiple: true },
  concurrency: { type: 'string', short: 'j' },
  'startup-timeout': { type: 'string' },
  'job-timeout': { type: 'string' },
  'output-dir': { type: 'string' },
  'chromium-binary': { type: 'string' },
  'firefox-binary': { type: 'string' },
  'keep-profiles': { type: 'boolean' },
};

const splitList = (values) =>
  (values ?? [])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

const positiveNumber = (name, value, fallback, { integer = false } = {}) => {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number <= 0 ||
    (integer && !Number.isInteger(number))
  ) {
    throw new UsageError(
      `--${name} must be a positive ${integer ? 'integer' : 'number'}, got '${value}'`,
    );
  }
  return number;
};

/** Parse CLI arguments into runner options. Throws UsageError. */
export function parseCliArgs(argv, env = {}) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: OPTIONS,
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    throw new UsageError(error.message);
  }
  const browserValues = splitList(values.browser);
  let browsers = DEFAULTS.browsers;
  if (browserValues.length > 0) {
    const expanded = browserValues.flatMap((value) =>
      value === 'both' ? [...BROWSERS] : [value],
    );
    for (const browser of expanded) {
      if (!BROWSERS.includes(browser)) {
        throw new UsageError(
          `Unknown browser '${browser}'. Use chromium, firefox or both.`,
        );
      }
    }
    browsers = BROWSERS.filter((browser) => expanded.includes(browser));
  }
  const driverIds = splitList(values.driver);
  if (driverIds.length > 0 && values.preset !== undefined) {
    throw new UsageError('Use either --driver or --preset, not both.');
  }
  return {
    help: Boolean(values.help),
    list: Boolean(values.list),
    driverIds,
    preset: driverIds.length > 0 ? null : (values.preset ?? DEFAULTS.preset),
    browsers,
    browsersExplicit: browserValues.length > 0,
    concurrency: positiveNumber(
      'concurrency',
      values.concurrency,
      DEFAULTS.concurrency,
      { integer: true },
    ),
    startupTimeoutMs:
      1000 *
      positiveNumber(
        'startup-timeout',
        values['startup-timeout'],
        DEFAULTS.startupTimeoutSeconds,
      ),
    jobTimeoutMs:
      1000 *
      positiveNumber(
        'job-timeout',
        values['job-timeout'],
        DEFAULTS.jobTimeoutSeconds,
      ),
    outputDir: values['output-dir'] ?? null,
    binaries: {
      chromium:
        values['chromium-binary'] ?? env.CHANT_RUNNER_CHROMIUM_BINARY ?? null,
      firefox:
        values['firefox-binary'] ?? env.CHANT_RUNNER_FIREFOX_BINARY ?? null,
    },
    keepProfiles: Boolean(values['keep-profiles']),
  };
}

/**
 * Resolve driver IDs/preset and browsers into runnable driver/browser pairs
 * plus explicitly reported unsupported pairs. Throws UsageError for unknown
 * IDs or presets, a driver with no supported requested browser, an explicitly
 * requested unsupported pair, or an empty selection.
 */
export function selectJobs(
  { driverIds, preset, browsers },
  drivers = DRIVERS,
  presets = PRESETS,
) {
  let ids;
  if (driverIds.length > 0) {
    const unknown = driverIds.filter(
      (id) => !drivers.some((driver) => driver.id === id),
    );
    if (unknown.length > 0) {
      throw new UsageError(
        `Unknown driver ID(s): ${unknown.join(', ')}. Run with --list to see valid IDs.`,
      );
    }
    ids = [...new Set(driverIds)];
  } else {
    if (!Object.hasOwn(presets, preset)) {
      throw new UsageError(
        `Unknown preset '${preset}'. Use one of: ${Object.keys(presets).join(', ')}.`,
      );
    }
    ids = presets[preset];
  }
  const runnable = [];
  const unsupported = [];
  for (const id of ids) {
    const driver = drivers.find((candidate) => candidate.id === id);
    const supported = browsers.filter((browser) =>
      driver.browsers.includes(browser),
    );
    if (driverIds.length > 0 && supported.length === 0) {
      throw new UsageError(
        `Driver '${id}' does not support ${browsers.join('/')}; it supports ${driver.browsers.join('/')} only. Pass --browser ${driver.browsers.join(',')}.`,
      );
    }
    for (const browser of browsers) {
      if (driver.browsers.includes(browser)) runnable.push({ driver, browser });
      else
        unsupported.push({
          driver,
          browser,
          reason: `${driver.id} implements ${driver.browsers.join('/')} only`,
        });
    }
  }
  if (runnable.length === 0) {
    throw new UsageError(
      'The selection contains no runnable driver/browser pair.',
    );
  }
  return { runnable, unsupported };
}

export function formatList(drivers = DRIVERS, presets = PRESETS) {
  const width = Math.max(...drivers.map((driver) => driver.id.length));
  const lines = [
    'Routine browser drivers (docs/verification/runner/manifest.mjs):',
    '',
    `${'ID'.padEnd(width)}  SERVER   BROWSERS          SCRIPT`,
  ];
  for (const driver of drivers) {
    lines.push(
      `${driver.id.padEnd(width)}  ${driver.server.padEnd(7)}  ${driver.browsers.join(',').padEnd(16)}  docs/verification/${driver.script}`,
    );
    if (driver.knownIssue)
      lines.push(`${''.padEnd(width)}  note: ${driver.knownIssue}`);
  }
  lines.push('', 'Presets:');
  for (const [name, ids] of Object.entries(presets)) {
    lines.push(
      `  ${name}: ${name === 'full' ? 'every driver above' : ids.join(', ')}`,
    );
  }
  return lines.join('\n');
}

export const HELP = `Usage: npm run verify:browser -- [options]

Runs routine standalone browser drivers against isolated, runner-owned Vite
servers and headless browsers. Default: --preset smoke --browser chromium.

Selection:
  --list                      List drivers, transports and presets; launch nothing.
  --driver <id[,id...]>       Run specific drivers (repeatable). Excludes --preset.
  --preset <smoke|full>       Named selection (default smoke).
  --browser <name>            chromium (default), firefox, or both (repeatable,
                              comma-separated). Each driver runs once per
                              requested browser it supports; other pairs are
                              reported as unsupported.

Execution:
  -j, --concurrency <n>       Maximum simultaneous jobs (default ${DEFAULTS.concurrency}).
  --startup-timeout <sec>     Per-resource readiness limit (default ${DEFAULTS.startupTimeoutSeconds}).
  --job-timeout <sec>         Per-driver run limit (default ${DEFAULTS.jobTimeoutSeconds}).
  --output-dir <dir>          Parent of the unique run directory
                              (default <repo>/.verification-runs).
  --chromium-binary <path>    Chromium executable (or CHANT_RUNNER_CHROMIUM_BINARY).
  --firefox-binary <path>     Firefox executable (or CHANT_RUNNER_FIREFOX_BINARY).
  --keep-profiles             Keep disposable browser profiles for debugging.
  -h, --help                  Show this help.

Exit status: 0 when every runnable job passed; 1 when any job failed, timed
out or could not be set up; 2 for a usage error; 130 when interrupted.
See docs/verification/runner/README.md.`;

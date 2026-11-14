// Controllable stand-in for a server, browser or driver process.
//   --print <text>       write a line to stdout (repeatable)
//   --exit <code>        exit with this code after printing
//   --sleep-ms <n>       exit 0 after n ms (otherwise run until signalled)
//   --child-pid-file <f> spawn a long-lived grandchild and record its pid
//   --record <file>      write {pid, env, start, end} as JSON on exit
//   --ignore-term        ignore SIGTERM (forces SIGKILL escalation)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    print: { type: 'string', multiple: true },
    exit: { type: 'string' },
    'sleep-ms': { type: 'string' },
    'child-pid-file': { type: 'string' },
    record: { type: 'string' },
    'ignore-term': { type: 'boolean' },
  },
  strict: false,
});
const start = Date.now();
const record = () => {
  if (!values.record) return;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key.startsWith('CHANT_') || key === 'TMPDIR',
    ),
  );
  writeFileSync(
    values.record,
    JSON.stringify({ pid: process.pid, env, start, end: Date.now() }),
  );
};
if (values['ignore-term']) process.on('SIGTERM', () => {});
if (values['child-pid-file']) {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
  });
  writeFileSync(values['child-pid-file'], String(child.pid));
}
for (const line of values.print ?? []) console.log(line);
if (values.exit !== undefined) {
  record();
  process.exit(Number(values.exit));
}
if (values['sleep-ms'] !== undefined) {
  setTimeout(() => {
    record();
    process.exit(0);
  }, Number(values['sleep-ms']));
} else {
  setInterval(() => {}, 1000);
}

# Browser verification runner (Maintenance B)

One local entry point for the routine standalone browser drivers. It starts
runner-owned Vite servers and headless browsers on dynamic loopback ports,
gives each job an isolated profile, origin and protocol endpoint, runs the
unchanged driver, and records outcomes. It is not a test framework, is not
part of Vitest, and does not run in hosted CI.

[`manifest.mjs`](manifest.mjs) is the executable list of drivers, transports,
server kinds and presets. The human-readable
[driver inventory](../README.md#current-standalone-browser-drivers-maintenance-a-2026-11-13)
links here and does not duplicate it.

## Commands

```bash
npm run verify:browser -- --help
npm run verify:browser -- --list                 # launches nothing
npm run verify:browser                           # smoke, Chromium, -j 2
npm run verify:browser -- --browser both         # smoke in both browsers
npm run verify:browser -- --driver clefs,divisions --browser both
npm run verify:browser -- --preset full --browser both -j 2
npm run test:verify-runner                       # runner tests, no browser needed
```

Use a targeted `--driver` run while iterating and `--preset full --browser
both` for a final regression run.

## Selection

- `--driver <id>` (repeatable or comma-separated) or `--preset smoke|full`
  (default `smoke`), not both.
- `--browser chromium|firefox|both` (default `chromium`). Each selected driver
  runs once per requested browser it implements; other combinations are
  reported as `unsupported`. CDP-only drivers never run in Firefox.
- `smoke`: `vowel-alignment` (dev-fixture lyrics, Chromium only),
  `divisions` (dev fixture, both) and `local-persistence` (production preview,
  storage-clearing, both). `full`: every manifest driver.
- An unknown ID or preset, a driver with no requested browser (for example
  `--driver continuous-lyrics --browser firefox`), or an empty selection exits
  with status 2 before launching anything.

## Execution and isolation

- `-j/--concurrency` (default 2; 1 is serial), `--startup-timeout` (seconds per
  readiness wait, default 60) and `--job-timeout` (seconds per driver, default
  600). Timeouts are finite and a timed-out driver is stopped, not retried.
- Preview jobs share one production build per invocation, run before any
  preview server starts, written into the run directory with the repository's
  `vite.config.ts`. Dev-only selections never build. This is `vite build` only;
  `npm run build` (with `tsc -b`) remains the standard gate.
- Every job owns: a Vite dev or preview server ([`vite-server.mjs`](vite-server.mjs),
  strict port, job-private dependency cache), a headless browser with a fresh
  profile and debug port 0, and its own `TMPDIR`, so driver screenshots land in
  the job directory. Readiness waits for the owned endpoints: the server's own
  ready line plus an HTTP probe of the real fixture or built app; Chromium's
  printed browser ID matching `/json/version` plus a page target; Firefox's
  printed BiDi port matching the job profile's `WebDriverBiDiServer.json` plus a
  ready `session.status` (the driver still creates and ends its own session).
- Drivers receive only `CHANT_EDITOR_URL` or `CHANT_PREVIEW_URL` plus
  `CHANT_CHROMIUM_URL` or `CHANT_FIREFOX_URL`. Every inherited `CHANT_*`
  variable, including `CHANT_BASELINE`, `CHANT_CORPUS` and `CHANT_LEGACY_URL`,
  is removed first. Those modes remain available standalone.
- Children are spawned from argument arrays as process-group leaders. On
  completion, failure, timeout or interrupt (Ctrl-C once: graceful; twice:
  forced) the runner stops only its own groups (SIGTERM, bounded wait, SIGKILL)
  and deletes only profile and cache directories inside its run directory.
  A stop counts only once the whole group is confirmed gone; a surviving or
  unconfirmed group is reported, and that job's profile and cache are then left
  in place rather than removed under a possibly running browser or server.
  Profile and cache removal are attempted independently. Concurrent runner invocations share no ports, profiles, build output or run
  directories.

## Browsers

Discovery is fixed: `--chromium-binary`/`--firefox-binary`, else
`CHANT_RUNNER_CHROMIUM_BINARY`/`CHANT_RUNNER_FIREFOX_BINARY`, else the first of
`chromium`, `chromium-browser`, `google-chrome-stable`, `google-chrome`
(`firefox`, `firefox-esr`) on `PATH`, then standard macOS application paths.
A missing requested browser makes its jobs `setup_failed`; nothing is
downloaded or installed.

## Output

Each invocation creates a unique `.verification-runs/run-<time>-<id>/`
(ignored by Git; override the parent with `--output-dir`). It holds
`summary.json`, `build/build.log` and, per job, `driver.stdout.log`,
`driver.stderr.log`, `server.log`, `browser.log` and `driver-tmp/` with the
driver's screenshots. `summary.json` records the revision and dirty files,
selection, browser executables and versions, origins and endpoints, timings and
per-job status: `passed`, `failed`, `timed_out`, `setup_failed`,
`interrupted`, `not_run` or `unsupported`. Cleanup is recorded separately from
that driver outcome: per job `cleanup` (`processesStopped`, `profile` and
`cache` as `removed`, `kept`, `skipped` or `failed`, and `errors`) and a
run-level `cleanup` (`ok`, `jobFailures`, `runErrors`). Exit status: 0 only
when every runnable job passed and cleanup succeeded; 1 otherwise; 2 for usage
errors; 130 when interrupted.

## Platforms and limits

Linux is the supported and tested platform. macOS discovery paths exist but are
untested; Windows is rejected (POSIX process groups are required). Snap
Chromium cannot use profiles in the host `/tmp`, so the default run directory
lives inside the repository. Headless runs do not verify foreground focus,
actual zoom/IME or spoken screen-reader behaviour.

## Results (Maintenance B, 2026-11-14)

Owner-accepted 2026-11-13 in PR #78 at final reviewed revision `1fb9a8f`.
Evidence comes from three revisions and was not repeated for later changes:
the full matrix at runner code `412d2f5`; the standard gate and benchmark at
`6b0b7a9`; the cleanup-reporting corrections, 28 passing runner tests and the
final smoke run at `1fb9a8f`.

- Final smoke, `--browser both`, clean tree at `1fb9a8f`: 5 supported jobs
  passed (`vowel-alignment` Chromium; `divisions` and `local-persistence` in
  both), `vowel-alignment` Firefox reported unsupported; one 0.3 s build;
  57.4 s wall clock; cleanup `ok` with every profile and cache removed and no
  runner process left.

Linux x64, Node 24.12.0, Chromium 157.0.8103.38 (snap), Firefox 146.0.

- Full matrix, both browsers, `-j 2`, at runner code identical to `412d2f5`:
  34 runnable pairs, 30 passed, 4 failed, 6 unsupported; one 0.3 s build;
  476.7 s wall clock. The per-job durations sum to 941.8 s, an estimated
  serial figure, not a measured one. All profiles removed, no processes left.
  Per-job table: [PR #78 comment](https://github.com/OceanOSdev/gregorian-chant-editor/pull/78#issuecomment-6872022284).
- The four failures are pre-existing: the unchanged committed drivers fail
  identically on their default standalone endpoints. `word-composition`
  (Chromium and Firefox, line 327 `podatus note0-1 at 1440`), `lyric-spacing`
  (Chromium, line 220 `getComputedStyle` TypeError) and
  `lyric-spacing-selection-cue` (Firefox, line 127). They are not fixed or
  waived here. Firefox `mid-score-clefs` passed in this run; its intermittent
  150% zoom failure remains unresolved.
- Measured benchmark, Chromium, the same six drivers (`vowel-alignment`,
  `clefs`, `b-accidentals`, `local-persistence`, `bundled-example`,
  `note-shapes`), each run including its 0.3–0.4 s build: `-j 1` 69.9 s,
  `-j 4` 28.9 s (2.4x). In the `-j 4` run two dev drivers ran concurrently
  with the storage-clearing `local-persistence` driver on distinct origins,
  DevTools endpoints and profiles; all six passed.

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

## Maintenance C targeted completion (2026-11-14 UTC)

Driver-only repair `002fb04`; runner and application unchanged. The final
run started at parent `a6cdac3` with exactly the three repaired drivers dirty;
those bytes were committed as `002fb04` during execution. Subsequent changes
are documentation only. Linux x64, Node 24.12.0 (the existing local version,
versus requested 24.18.0), Chromium 157.0.8103.38 (snap), Firefox 146.0.

Command: `npm run verify:browser -- --driver word-composition,lyric-spacing,lyric-spacing-selection-cue --browser both -j 2`.

Run directory:
`.verification-runs/run-2026-11-14T05-16-32-396Z-rn6MQ9/`
(`summary.json`, driver logs and temporary screenshots; ignored, not committed).

| Job                                  | Result      | Total  |
| ------------------------------------ | ----------- | ------ |
| word-composition Chromium            | passed      | 32.5 s |
| word-composition Firefox             | passed      | 38.1 s |
| lyric-spacing Chromium               | passed      | 18.6 s |
| lyric-spacing-selection-cue Firefox  | passed      | 7.0 s  |
| lyric-spacing Firefox                | unsupported | —      |
| lyric-spacing-selection-cue Chromium | unsupported | —      |

51.4 s wall clock, no build required; cleanup succeeded, all owned processes
stopped and profiles/caches removed. Standard gate on the same substantive
bytes passed once: format:check, lint, 87 test files / 1,894 tests, build and
git diff --check. Documentation closeout runs formatting/link checks only.

Clean baseline at `a6cdac3`:
`.verification-runs/run-2026-11-14T05-12-47-035Z-E3qTMc/`
reproduced four failures / two unsupported, with successful cleanup.
Word composition failed `podatus note0-1 at 1440` in each browser;
Chromium spacing threw at `getComputedStyle(r)`; Firefox cue failed
`selected === 'true'` at 150% CSS zoom. The earlier sandbox invocation
(`run-2026-11-14T05-12-35-104Z-1n5hRB`) had four setup failures,
not browser test results; rerunning outside the sandbox enabled local
servers and installed browsers.

Root causes and repairs:
[word composition](../word-composition/README.md#maintenance-c-repair-2026-11-14-utc)
and [lyric spacing/cue](../lyric-spacing/README.md#maintenance-c-repair-2026-11-14-utc).
Focused iterations exposed native Close timing/visibility and the later
oversized-placement Undo interception. Those failed diagnostics remain in their
local run directories; final completion used no diagnostic modes or retries.

The targeted run preceded the owner comprehensive verification below. No
foreground browser, spoken screen-reader or new human engraving acceptance is
claimed. No historical screenshots were regenerated.

## Maintenance C owner acceptance (2026-11-13)

Completed and owner-accepted in [PR #79](https://github.com/OceanOSdev/gregorian-chant-editor/pull/79)
at final reviewed revision `eea0095eabd598df08e7156a31a3350271134497`.
The owner's `summary.json` was inspected for revision, dirty state, browser
versions and every job result before recording this evidence. The tree was clean
(`dirty: false`, no dirty files). Linux x64, Node 24.12.0,
Chromium 157.0.8103.38 snap and Mozilla Firefox 146.0.

Command: `npm run verify:browser -- --preset full --browser both -j 4`.
Summary: `.verification-runs/run-2026-11-14T05-21-07-299Z-bIe9CY/summary.json`
(local ignored evidence; UTC date is November 14, owner acceptance date is
November 13).

All 34 supported jobs passed, zero failed; six expected unsupported pairs.
All four previously failing jobs passed, and `mid-score-clefs` passed in both
browsers. Wall time 261.3 s, observed concurrency 4; production bundle build
passed in 0.3 s. Every job exited 0; all owned processes stopped, profiles and
caches removed, with no cleanup errors. The full per-driver results follow;
unsupported pairs are reported, not executed.

| Driver                      | Chromium    | Firefox     |
| --------------------------- | ----------- | ----------- |
| continuous-lyrics           | passed      | unsupported |
| lyric-move                  | passed      | unsupported |
| vowel-alignment             | passed      | unsupported |
| lyric-spacing               | passed      | unsupported |
| lyric-spacing-selection-cue | unsupported | passed      |
| word-composition            | passed      | passed      |
| clefs                       | passed      | unsupported |
| mid-score-clefs             | passed      | passed      |
| divisions                   | passed      | passed      |
| extended-scandicus-climacus | passed      | passed      |
| pes-subpunctis              | passed      | passed      |
| repeated-note-neumes        | passed      | passed      |
| note-modifiers              | passed      | passed      |
| note-shapes                 | passed      | passed      |
| b-accidentals               | passed      | passed      |
| b-accidentals-acceptance    | passed      | passed      |
| local-persistence           | passed      | passed      |
| bundled-example             | passed      | passed      |
| vertical-episemata          | passed      | passed      |
| vertical-episemata-context  | passed      | passed      |

Hosted CI passed, as reported by the owner:
[run 43560915338](https://github.com/OceanOSdev/gregorian-chant-editor/actions/runs/43560915338).
This documentation-only closeout does not rerun the matrix, unit tests or
benchmarks. Stage 9B-3 is next; the completed plan remains historical.

The intermittent Firefox mid-score-clefs 150% CSS-zoom issue remains unresolved;
this passing run is not evidence of a fix. Headless results do not establish
foreground focus, actual browser/OS zoom, native popup/IME behavior, spoken
screen-reader output or final engraving acceptance.

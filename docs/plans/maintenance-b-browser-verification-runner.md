# Plan: Maintenance B — Browser verification automation

Branch: `maintenance/browser-verification-runner`
Target: `master`

Status: **completed and owner-accepted 2026-11-13** in PR #78 (final reviewed
revision `1fb9a8f`); retained as a historical record. Results live in the
[runner guide](../verification/runner/README.md). Maintenance C (pre-existing driver failure triage) is the
next follow-up before Stage 9B-3. Original planning context: Maintenance A (PR #77) merged at `da14890`; its
[driver inventory](../verification/README.md) is the input to this task.
The next notation milestone remains separate.

## Problem and goal

The project has 1,894 unit tests at the Maintenance A verified revision
(`49012eb`) and many real-editor CDP/BiDi drivers. Running browser
regressions requires manually starting servers, browsers and disposable
profiles, and several drivers still use fixed ports. Earlier parallel runs
needed port-substituted copies. Provide one repeatable, bounded, local
verification entry point that runs existing drivers with isolated resources,
records actual outcomes, and reduces human and agent setup time.

Read AGENTS.md, the [workflow](../ai-workflow.md),
[testing guide](../testing.md), and the inventory and owning driver READMEs
before implementation. Inspect actual scripts and launch commands; the
inventory is a starting point, not an executable manifest.

## 1. Manifest and selection

Add a small explicit, reviewable manifest and Node-based runner under
`docs/verification/` (use existing Node facilities; no new browser framework).
Expose an npm script such as `npm run verify:browser -- --help`.
Keep the runner separate from application code and the existing Vitest suite.

- Assign stable driver IDs, script paths, supported transports (Chromium
  CDP, Firefox BiDi), and server kinds (Vite dev fixture, built preview).
  Include every current routine driver in the Maintenance A inventory,
  including the Firefox-only selection cue and the separate accidental
  acceptance and contextual episema checks. Check each against its code.
  Historical, comparison-board, raster/weight, legacy-storage and
  baseline/diagnostic scripts are not routine jobs. Do not automatically
  enable corpus diagnostic, baseline generation or optional legacy builds.
- Support listing without launching anything; selection by stable driver ID
  (multiple IDs), browser, and a documented smoke/full preset. Default to
  a useful smoke run with Chromium; support explicit Firefox and both
  browsers. A full run with both browsers selects every supported routine
  driver/transport pair, not just whichever binaries happen to be found.
  Define a small fixed smoke subset exercising dev lyrics and real preview
  editing/persistence, with supported counterparts in each requested browser.
  Do not invent Firefox support for CDP-only drivers. Report unsupported
  combinations explicitly; an explicitly requested unsupported pair,
  unknown ID or empty selection must fail with a useful message.
- Provide bounded concurrency (default 2, configurable including 1) and
  configurable finite startup and per-job timeouts. Document exact commands,
  selection semantics, browser binary overrides, prerequisites and outputs.
  Preserve standalone driver use and its existing defaults.

## 2. Configurable endpoints and isolated orchestration

Normalize current routine driver endpoint overrides to the established
`CHANT_EDITOR_URL` (dev origin), `CHANT_PREVIEW_URL` (complete preview URL),
`CHANT_CHROMIUM_URL` (CDP JSON discovery URL) and `CHANT_FIREFOX_URL`
(BiDi WebSocket session URL). In particular, dev drivers with hard-coded
CDP discovery and mid-score-clefs' fixed dev origin need narrow changes.
Keep default endpoints and fixture paths compatible, including the contextual
driver's different defaults. Do not port or rewrite transport adapters,
input methods or assertions just to unify them.

Each concurrent job owns an isolated browser process, disposable profile,
tab/context, dev or preview server origin and debug endpoint. A fresh profile
per job is the straightforward baseline; any later reuse must prove equivalent
isolation and is not required. In particular, storage-clearing drivers must
never encounter another job's state or the owner's browser/profile.
Build the production bundle at most once per runner invocation when a preview
job is selected, before preview servers launch. Do not run a build for a
dev-only selection; no concurrent builds of the same output. Use the current
Vite base configuration and real dev fixture, not a synthetic editor.

- Start servers/browsers on loopback with dedicated dynamically allocated
  or safely managed nonconflicting ports, Vite strict-port behavior, and
  appropriate Firefox-safe HTTP ports. Detect races or occupied ports; never
  connect to a pre-existing service as though it were owned. Launch via
  argument arrays, not interpolated shell commands. Discover browser
  executables predictably, with explicit overrides; no downloads or installs
  without owner consent.
- Wait for the actual owned HTTP server and browser protocol endpoints to
  be ready, with bounded polling, checking premature process exit. Chromium
  needs an actual page target; Firefox needs a working BiDi endpoint/session
  lifecycle compatible with existing drivers. Use headless mode. Do not use
  arbitrary fixed startup sleeps as readiness proof.
- Set job-specific environment deliberately. Remove inherited incompatible
  transport/endpoint settings and baseline/diagnostic mode flags (including
  `CHANT_BASELINE`, `CHANT_CORPUS`, `CHANT_LEGACY_URL`), rather than allowing
  ambient shell settings to redirect a job or silently change its coverage.
  Keep the standalone optional comparison paths available outside the runner.
- Own and track subprocesses and resources; on success, failure, timeout or
  interrupt, stop/reap only children started for the run (including relevant
  descendants), close handles and clean disposable profiles. Use bounded
  graceful shutdown then escalation where needed. Never kill by global
  process name/port or remove the user's profile or unrelated files.
  Handle concurrent runner invocations or reject conflicts safely.
  Document the actually supported operating systems and any platform limits;
  Linux is the primary owner environment.

## 3. Results and development efficiency

Create one unique run directory outside tracked specimens, with per-job
driver stdout/stderr, browser/server logs and a concise terminal summary.
Keep screenshot and diagnostic output paths from existing drivers visible
and retained for investigation. Record exact revision (and dirty state),
selection, browser versions, endpoint/origin details, start/end or duration,
and outcome per driver/transport. A machine-readable summary (JSON) should
distinguish passed, failed, timed out, setup failed, unsupported/not run and
interrupted where applicable. Print the run directory and exit nonzero for
any requested runnable job that fails, times out or cannot be started.

Do not silently skip a missing requested browser, retry a failed assertion
into a pass, swallow output, or treat a diagnostic script as regression
coverage. Continue independent jobs after ordinary failures where safe;
report all outcomes. Preserve the unresolved Firefox mid-score-clefs
150% zoom failure from the Stage 9B-2 investigation. Run its normal assertion
unchanged; if it fails, retain evidence and report the failure. This task
does not fix or waive that application/driver issue.

Support a quick targeted run during implementation and a broader regression
run for final review. Preserve the standard repository gate; browser tests
remain local and outside hosted CI/Vitest for this milestone. Avoid expensive
repeated full suites or unnecessary agent orchestration. Record a measured
serial versus bounded-parallel comparison for the same representative
selection, including whether build/setup is counted. Report actual timings
and resource caveats; no arbitrary speedup threshold or claim without data.

## 4. Verification and acceptance

Add focused automated tests of runner/manifest selection and lifecycle
behavior using controlled stub processes or a test seam, not requiring a
browser installation for basic orchestration tests. Cover valid selection,
unknown/unsupported requests, no accidental diagnostic mode, bounded
concurrency, unique resources, nonzero driver exit, early process exit,
startup and job timeout, reporting, cleanup and interrupt handling.
Exercise occupied-port handling and missing-browser setup failure without
touching unrelated processes. Document how to run these tests.

Run real editor checks on the final substantive revision:

- List and smoke commands; a dev-only selection and a preview selection
  demonstrating correct fixture/production URLs and one build at most.
- Run two or more simultaneous real jobs, demonstrating separate profiles,
  origins and protocol endpoints; include a storage-sensitive preview driver
  and a dev driver. Verify actual results and isolation, not merely spawn
  arguments. Show serial and parallel timing evidence.
- Run the full routine manifest once across Chromium and Firefox with bounded
  concurrency, if both are available. Record the complete per-pair outcome
  matrix, actual browser versions, timings and logs. If an environment
  prevents a run, report exactly what was not run and why. Inspect failures;
  compare suspicious cases with the unchanged standalone invocation when
  needed, without replacing initial failures in the record.
- Check that individual standalone drivers still work with defaults or
  their documented overrides, particularly changed dev drivers. Keep
  current native pointer/keyboard, narrow viewport and semantic assertions.
  Do not claim foreground focus, actual zoom/IME or spoken screen-reader
  verification from headless automation.
- Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`
  and `git diff --check` on the substantive final revision; reuse the
  runner's actual standard build result if equivalent and on that revision.
  Check changed documentation links. During iteration prefer focused tests.
  Documentation-only closeout needs formatting/link checks, not repeated
  full browser runs.

Update the testing guide, driver inventory, affected setup READMEs and
roadmap as needed. Clearly separate dated Maintenance A/historical results
from new runner evidence; retain known Firefox limitations. Keep the
human-readable inventory linked to the manifest without duplicating the
complete executable configuration in prose.

## Scope and stop conditions

No editor application behavior, notation, ADR or schema changes, new browser
test framework, broad driver rewrite, CI/browser dependency changes, or
historical driver resurrection. No application fixes disguised as runner
maintenance. If real application regressions, unavoidable architecture
changes or significant cross-platform constraints arise, report evidence
and options before expanding scope. Ordinary runner implementation choices
need no additional owner approval.

## Delivery

Implement, commit and push on this branch; open a PR against master.
Include usage examples, actual verification, measured timings, isolation
evidence, any failure or not-run check, limitations and remaining owner
review items. Retain this plan through review and owner acceptance, then
mark it completed accurately. Do not merge.

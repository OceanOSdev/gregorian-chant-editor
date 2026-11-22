# Plan: Playwright M1 — cross-browser E2E pilot

Branch: `test/playwright-m1-pilot`
Target: `master`
Status: **Completed** (historical record). Implemented and merged in [PR #120](https://github.com/OceanOSdev/gregorian-chant-editor/pull/120) (merge `fb86711`); see [Closeout](#closeout). The PR and the [M1 verification record](../verification/playwright-m1/README.md) hold the actual verification, including checks not performed. The sections below record the plan as approved; the acceptance checklist is left as written.

## Motivation and user-visible goal

ChantPad has useful browser regression coverage, but its standalone `docs/verification/**/browser-check.mjs` scripts also implement browser transport, process management, input synthesis, waiting, and assertions by hand. The Maintenance B runner (`docs/verification/runner/`) manages isolated browsers, Vite servers, and output, but is explicitly not a test framework. Future behavior tests should read primarily as user scenarios, with reliable cross-browser execution and failure diagnostics.

Establish a small Playwright Test pilot and evaluate it against the _existing_ checks before committing to a broader migration. This is test-infrastructure work, **not** a rewrite of the editor or a promise that every driver can be ported without low-level browser checks.

## Agreed decisions

1. **Test organization:** Keep Vitest unit tests co-located with source modules. Put new Playwright E2E specs under **`tests/e2e/`** (e.g., `divisions.spec.ts`, `local-persistence.spec.ts`). Add `tests/e2e/fixtures/` and `tests/e2e/helpers/` only for genuinely shared code; avoid a large page-object layer in M1. Put `playwright.config.ts` at the repository root.
2. **Separate runners:** Keep Vitest for pure domain, state, layout, and geometry tests; use `@playwright/test` for real browser workflows. Ensure `npm test` continues to discover only Vitest tests and never collects `tests/e2e/**/*.spec.ts`.
3. **Browser matrix:** Run Playwright's managed **Chromium and Firefox** projects (desktop initially). Document browser installation and Linux prerequisites, and the distinction between Playwright's patched Firefox and the installed Firefox driven by the legacy runner.
4. **Two representative pilot areas:** `divisions` on the development-only real-editor fixture, and `local-persistence` on the built application served by Vite preview. Choose a _small but meaningful_ set of named end-to-end scenarios from each, with both browsers and representative native input/keyboard behavior. Preserve strong assertions about semantics, undo/redo, focus or persistence where the scenarios require them.
5. **Parallel operation:** All legacy scripts, their manifest, the verification runner, historical records, and existing commands stay intact in M1. Do not delete or silently disable a driver. Do not claim full equivalence to an old driver when only a subset was ported.
6. **CI:** Do not add browser installation or a required Playwright check to hosted CI in this milestone. Evaluate local stability first; CI adoption is a separate later milestone.
7. **No production changes:** Do not modify notation semantics, editor UX, data formats, rendering, or application behavior to make a test pass. Reuse the real existing development fixture or production preview as appropriate. If a test uncovers a genuine product defect, document and escalate instead of quietly changing the app.

## References and existing contracts

- `AGENTS.md` and `docs/ai-workflow.md` — repository conventions and agent handoff.
- `docs/testing.md` — authoritative test strategy and verification responsibilities.
- `docs/verification/runner/README.md`, `docs/verification/runner/manifest.mjs` — existing runner behavior and driver inventory.
- `docs/verification/divisions/browser-check.mjs` and `docs/verification/divisions/README.md` — development-fixture scenarios, native pointer and keyboard checks, multiple viewport sizes, focus and division history.
- `docs/verification/local-persistence/browser-check.mjs` and `docs/verification/local-persistence/README.md` — production-preview scenarios, fresh storage, refresh, undo/redo, import/export, dialogs, and multi-tab conflict behavior.
- Official Playwright documentation: https://playwright.dev/docs/test-configuration , https://playwright.dev/docs/test-webserver , https://playwright.dev/docs/browsers .

## M1 implementation scope

### Configuration and commands

- Add `@playwright/test` as an intentional development dependency, with the updated lockfile; configure `testDir: './tests/e2e'`, two browser projects, a reasonable local timeout/concurrency, useful failure diagnostics (trace/screenshots), and isolated test contexts.
- Define one straightforward npm command for the new E2E tests and document how to run a named spec or one browser. Playwright should own browser launch and lifecycle; prefer its web-server facilities over recreating a generalized runner.
- Support both the development fixture and the production build/preview without conflating them. Use distinct predictable local origins or project/test configuration, with clean test isolation and no owner data. Handle development/preview server startup and teardown without collisions or accidental reuse of an unrelated application server. Production-preview tests should exercise built assets, not the Vite dev server.
- Keep Playwright reports, traces, and test output in ignored directories. Avoid committed generated screenshots or artifacts in this milestone.
- Keep ordinary repository scripts (`npm test`, `npm run verify:browser`, `npm run test:verify-runner`) working unchanged.

### Pilot scenarios

- **Divisions:** A focused test or small group demonstrating real selection/insertion or editing of division bars, stable ordering/identity as applicable, and Delete/Undo or another history action through native browser input. Use the existing dev fixture; include meaningful assertions on rendered state rather than mere absence of errors.
- **Local persistence:** A focused test or small group on the actual production-preview app that edits committed content, verifies storage/refresh recovery, and exercises Undo/Redo or New/import/export where practical. A fresh browser context/storage must prevent cross-test or personal-data interference. Use the same product contract as the existing driver.
- Both representative workflows should run in Chromium **and** Firefox. Treat known browser differences as explicit evidence, not automatic skips. Use meaningful accessible locators, `expect` auto-waiting, and native Playwright pointer/keyboard APIs when they reflect the scenario. Avoid arbitrary fixed sleeps and direct DOM event dispatch for ordinary user actions. `page.evaluate` is acceptable for controlled fixture setup or validating otherwise inaccessible semantic details when justified.
- Do **not** port every assertion from the two long existing drivers as part of M1. Build a short **coverage crosswalk** in the PR or verification record: named old-driver scenarios; scenarios exercised by new specs; capabilities intentionally left to legacy checks; important browser differences. Only a later fully equivalent migration may retire an original driver.

### Documentation

- Update `docs/testing.md` with the two-runner division of labor, folder convention, setup and local command(s), and accurate limits of the pilot.
- Add a concise Playwright-specific guide under `tests/e2e/` only if needed for setup and writing conventions. Keep historical verification records intact. Avoid copying the runner's detailed old implementation into new docs.

## Acceptance criteria

- [ ] Playwright specs live under `tests/e2e/`; Vitest unit tests remain co-located; `npm test` does not run any Playwright tests.
- [ ] Chromium and Firefox execute both development-fixture and production-preview pilot workflows successfully in isolated contexts, with no cross-test storage contamination.
- [ ] Scenarios assert actual observable state and meaningful user behavior; native pointer/keyboard/focus or refresh behavior is covered where appropriate.
- [ ] No arbitrary sleep-based synchronization is required in the new happy-path specs; fixture setup and server startup are deterministic.
- [ ] The old runner and every registered driver remain available, and their substantive coverage is not misrepresented as migrated.
- [ ] The PR includes a named scenario-by-scenario coverage crosswalk and a comparison run of the relevant legacy drivers versus the new specs on the same implementation revision, with exact pass/fail/unsupported states; explain any differences.
- [ ] Playwright artifacts are ignored, local instructions work from a clean install with the documented browser prerequisites, and local processes terminate after tests/failures.
- [ ] Standard `format:check`, `lint`, `test`, `build`, `git diff --check`, and appropriate runner checks have actual recorded results. Do not assert successful hosted CI unless it ran.
- [ ] No changes to application runtime behavior or broader browser testing migration.

## Stop conditions and non-goals

Stop and return options if the real app/fixture cannot be exercised without production changes, Playwright Firefox cannot reproduce a critical native-browser contract, or server/build isolation would require a disproportionate infrastructure layer. In those cases, preserve the existing working runner rather than weakening tests.

Not included: whole-suite migration; deletion/replacement of the old runner; rewriting tests into page-object abstractions; WebKit; visual-snapshot baselines; routine browser CI; product bug fixes; full Playwright parity for all divisions and local-persistence driver scenarios.

## Delivery

Implement on this branch, commit and push, and open a PR against `master`. Do **not** merge. Report the implementation commit SHA, key design choices, exact commands and results, cross-browser and legacy comparisons, any gaps or failures, and work intentionally deferred to M2/M3. Follow `docs/ai-workflow.md` verification tiers.

## Closeout

Completed 2026-11-22. The owner reviewed and accepted PR #120 and merged it
with a merge commit.

| Item                | Reference                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| PR                  | [#120](https://github.com/OceanOSdev/gregorian-chant-editor/pull/120)                                       |
| Merge commit        | `fb86711`                                                                                                   |
| Reviewed PR head    | `263c89d` (implementation `18f5364` and `c421a5f`; results `263c89d`)                                       |
| Hosted CI           | Format, Lint, Test and Build passed on `263c89d` and on `fb86711`. No Playwright job exists in CI           |
| Verification record | [`docs/verification/playwright-m1/README.md`](../verification/playwright-m1/README.md) (crosswalk, results) |

The resulting contracts are owned by the
[testing guide](../testing.md#playwright-end-to-end-tests-m1-pilot).

### Outstanding, not resolved by M1

- **Division pointer selection defect:**
  [issue #121](https://github.com/OceanOSdev/gregorian-chant-editor/issues/121).
  Found by the pilot and kept out of M1 by agreement. `divisions.spec.ts`
  marks it `test.fail()`; the fix should remove that marker.
- **Playwright Firefox file chooser:** a second or later picker in one page
  was intermittently not reported. The specs open one native picker per page.
  This has not been checked in a foreground, installed Firefox.
- **Partial and legacy-only coverage:** listed in the
  [crosswalk](../verification/playwright-m1/README.md#coverage-crosswalk). No
  legacy driver is retired or claimed equivalent.
- **Deferred to later milestones:** further migration (M2), a Playwright CI job,
  relocating the runner's `vite-server.mjs` if the runner is ever retired, and
  WebKit.
- **Not performed:** foreground focus, OS zoom, native popup, IME and
  screen-reader checks.

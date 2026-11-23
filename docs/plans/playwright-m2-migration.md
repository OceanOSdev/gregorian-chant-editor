# Plan: Playwright M2 — migrate and retire the legacy browser drivers

Branch: `docs/playwright-m2-plan` (this plan only)
Target: `master`
Status: **Approved direction; awaiting review of this revision.** Each
implementation milestone below gets its own branch from `master` and its own
PR. This plan records intent and acceptance criteria; PRs and verification
records hold actual results.

## Problem and goal

The [M1 pilot](playwright-m1-pilot.md) showed that Playwright Test can express
real-browser editor workflows in Chromium and Firefox. Its
[verification record](../verification/playwright-m1/README.md) ported a subset
of two drivers and retired none. Routine browser coverage still lives in 31
standalone drivers registered in
[`docs/verification/runner/manifest.mjs`](../verification/runner/manifest.mjs)
(about 24,400 lines). Each driver implements its own CDP/BiDi transport, input
synthesis, waiting and assertions. The custom runner launches them.

M2 moves that coverage into readable Playwright specs, retires each driver
once equivalent behavioural coverage exists, starts a non-required hosted CI
smoke job, resolves [issue #123](https://github.com/OceanOSdev/gregorian-chant-editor/issues/123)
with Playwright, and finally removes obsolete executable infrastructure. The
historical verification records stay under `docs/verification/`.

## Agreed decisions

1. **Order.** First finish the two M1 pilot areas (`divisions`, then
   `local-persistence`), which proves the full migrate-and-retire loop on
   known-good drivers. Next add the CI smoke job. Then investigate #123 under
   the new conventions, still within M2. After that, migrate the remaining
   groups.
2. **Retirement policy.** A driver is removed from the manifest, and its
   script deleted, in the same PR that completes its migration. That is
   allowed only when the PR demonstrates equivalent behavioural coverage.
   Equivalence is judged against documented behaviour and meaningful
   regression protection, not by mechanically reproducing every
   implementation-specific assertion. Every dropped assertion needs an
   explicit written justification; coverage is never weakened silently.
3. **Hosted CI.** Add a **non-required** Playwright smoke job in M2. It covers
   representative interactions in both browsers and grows to include
   neume-palette placement. Whether it becomes required is decided later,
   from its record across real PR runs.
4. **Records and cleanup.** Historical documentation and committed
   verification evidence stay under `docs/verification/`. After migration,
   obsolete drivers, the custom runner and redundant browser-protocol code are
   removed. Specialised historical and diagnostic scripts are audited first:
   genuinely useful tools are kept and relocated, and superseded ones are
   deleted. The runner is removed only when no required browser coverage
   still depends on it.
5. **Cross-build and compatibility checks are not dropped automatically.**
   This covers the `CHANT_LEGACY_URL` mode of `b-accidentals` and
   `note-shapes/storage-review.mjs`. Determine which contracts they actually
   verify. Pure serialization or validation belongs in Vitest. Genuine
   cross-build or browser compatibility behaviour stays browser-tested unless
   the owner explicitly decides it is no longer needed.
6. **Unchanged M1 conventions.** The rules in the
   [testing guide](../testing.md#playwright-end-to-end-tests-m1-pilot) still
   apply:
   - Playwright owns browsers and servers.
   - Specs live in `tests/e2e/<area>.spec.ts`, with shared code only in
     `tests/e2e/helpers/`.
   - There is no page-object layer.
   - Use role and label locators, web-first assertions, and native
     pointer and keyboard input. Never use fixed sleeps.
   - `page.evaluate` is only for justified setup or reads.
   - A known product defect is recorded with `test.fail()`, never by
     weakening or skipping the test.
7. **No production changes in migration PRs.** A product defect found during
   migration is escalated. Its fix goes in a separate `fix:` PR with its own
   plan, as #121 was handled.

## Inventory at plan time (`master` `0ae32be`)

| Driver                                          | Server  | Browsers | Status                                                       |
| ----------------------------------------------- | ------- | -------- | ------------------------------------------------------------ |
| contiguous-selection, musical-passage-clipboard | dev     | C, F     | Pass                                                         |
| continuous-lyrics, lyric-move, vowel-alignment  | dev     | C        | Pass; Firefox unsupported (focus automation; see #96)        |
| lyric-spacing / lyric-spacing-selection-cue     | dev     | C / F    | Pass (after #112 fix)                                        |
| css-zoom-toolbars, divisions                    | dev     | C, F     | Pass; divisions partly ported in M1                          |
| word-composition                                | dev     | C, F     | **Fails in both** (#123)                                     |
| clefs                                           | dev     | C        | Pass                                                         |
| mid-score-clefs                                 | dev     | C, F     | Pass; known intermittent Firefox 150% zoom pointer insertion |
| liquescent-notation, neume-ledger-lines         | preview | C, F     | Pass                                                         |
| dynamic-vertical-layout                         | preview | C, F     | Pass; font-metric sensitive                                  |
| compound-directional-neumes, pes-subpunctis     | preview | C, F     | Pass                                                         |
| repeated-note-neumes, note-shapes               | preview | C, F     | Pass                                                         |
| extended-scandicus-climacus                     | preview | C, F     | **Fails in both since #119** (#123)                          |
| note-modifiers                                  | preview | C, F     | **Chromium intermittent** (#123)                             |
| b-accidentals, b-accidentals-acceptance         | preview | C, F     | Pass; optional `CHANT_LEGACY_URL` mode not run by the runner |
| editor-toolbar, score-focus-reparenting         | preview | C, F     | Pass; score-focus tolerates one exact headless Firefox form  |
| local-persistence, bundled-example              | preview | C, F     | Pass; local-persistence partly ported in M1                  |
| audio-playback, audio-follow-along              | preview | C, F     | Pass; not listening tests                                    |
| vertical-episemata, vertical-episemata-context  | preview | C, F     | Pass                                                         |

"Pass" means the driver was not among the #123 failures in the full matrix at
`0a46178`. Existing Playwright specs: `divisions.spec.ts` and
`local-persistence.spec.ts` (partial ports, with crosswalks in the M1 record)
and `pointer-activation.spec.ts` (new #121 coverage that replaces no driver).

## Migration rules (every migration PR)

1. **Crosswalk.** Before retiring a driver, add a "Playwright migration"
   section to the driver's existing `docs/verification/<area>/README.md`.
   Group the driver's scenarios and assertions by behaviour, and map each
   group to exactly one of:
   - **Playwright:** the spec and test that now protect it.
   - **Vitest:** an existing or new unit test, named. Use this when the
     contract is pure (codec, validation, version rejection, layout
     arithmetic) and the browser adds nothing.
   - **Dropped, with justification:** transport or harness plumbing,
     human-review screenshots, or an implementation detail with no
     documented contract. Cite the owning guide or ADR for why the remaining
     coverage protects the behaviour. Owner review of the PR approves the
     drop.

   Behaviour that depends on painted ink, `getBBox`/CTM geometry, clip paths,
   hit-testing, real fonts, focus, dialogs, storage events or print media
   stays in the browser.

2. **Evidence before retiring.**
   - Run the legacy driver and the new spec on the same revision, in both
     browsers where either supports them.
   - Run the new spec with `--repeat-each=10` in Chromium and Firefox.
   - Where practical, add a negative control: show the spec failing on a
     revision before a known fix, or against a deliberately reverted line.
     Record that the revert was discarded.

3. **Browser enrolment.** Specs ported from Chromium-only (or Firefox-only)
   drivers run in both projects. A failure in the newly added browser is
   investigated:
   - a product defect becomes `test.fail()` plus an issue;
   - a documented automation limit becomes a scoped, commented skip, and
     the crosswalk records it.

   A browser-specific skip is never added without that record.

4. **Retire in the same PR.** Remove the driver's manifest entry and its
   presets reference, and delete its script. Update
   `docs/verification/README.md`, the driver README's status line and the
   testing guide's feature index. The README and evidence files stay.

5. **Helpers arrive with their first consumer.** No speculative helper PRs.
   Expected helpers:
   - preview app open with fresh storage, file import and cache read;
   - an assertion that loading a document writes nothing;
   - staff-point to screen-point conversion;
   - palette family and variant selection;
   - ink bounding boxes.

6. **Smoke tagging.** Tag tests that are representative, fast and not
   font-metric sensitive with `@smoke`.

## Milestones

Each milestone is one small PR unless noted. A milestone may split further if
its diff becomes hard to review.

| #     | Milestone                          | Drivers in scope                                                              | Retires                                 |
| ----- | ---------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| M2.1  | Complete divisions                 | divisions                                                                     | `divisions`                             |
| M2.2  | Complete local persistence         | local-persistence                                                             | `local-persistence`                     |
| M2.3  | Hosted CI smoke job (non-required) | none                                                                          | none                                    |
| M2.4  | Issue #123 investigation           | word-composition, extended-scandicus-climacus, note-modifiers                 | none (see below)                        |
| M2.5  | App shell and focus                | bundled-example, editor-toolbar, score-focus-reparenting, css-zoom            | those four                              |
| M2.6  | Selection and clipboard            | contiguous-selection, musical-passage-clipboard                               | both                                    |
| M2.7  | Neume palette A                    | repeated-note-neumes, pes-subpunctis, compound-directional-neumes             | all three; adds palette placement smoke |
| M2.8  | Neume palette B                    | extended-scandicus-climacus, liquescent-notation                              | both                                    |
| M2.9  | Lyrics A                           | continuous-lyrics, lyric-move                                                 | both                                    |
| M2.10 | Lyrics B                           | vowel-alignment, lyric-spacing, lyric-spacing-selection-cue, word-composition | all four                                |
| M2.11 | Clefs                              | clefs, mid-score-clefs                                                        | both                                    |
| M2.12 | Note properties                    | note-modifiers, note-shapes, vertical-episemata, vertical-episemata-context   | all four (may be two PRs)               |
| M2.13 | Accidentals and compatibility      | b-accidentals, b-accidentals-acceptance                                       | both                                    |
| M2.14 | Vertical layout                    | dynamic-vertical-layout, neume-ledger-lines                                   | both                                    |
| M2.15 | Audio                              | audio-playback, audio-follow-along                                            | both                                    |
| M2.16 | Diagnostic-script audit            | non-routine scripts (see below)                                               | superseded scripts                      |
| M2.17 | Runner removal and relocation      | runner, launcher, fixture                                                     | runner                                  |

M2.1 and M2.2 set the pattern. Their closeouts amend this plan with any
convention changes they found before M2.4 starts. M2.5 onward is ordered to
reuse helpers. The groups that depend most on fonts and geometry come late,
and every group that depends on #123 comes after M2.4. The owner may reorder
M2.5–M2.15 between milestones.

### M2.1 Complete divisions

Port the rows the M1 crosswalk marks legacy-only or partial:

- pointer activation of the Insert before/after buttons;
- all four Division-menu kinds, with ghost ink-line counts and a
  non-focusable preview;
- tool persistence and menu order;
- leading, adjacent and trailing divisions, a division-only score, and a
  20-neume multi-system score, with every division focusable;
- the outgoing mark across reflow and 150% CSS zoom;
- local scrolling with an oversized lyric, and pointer focus after
  scrolling;
- the PR #48 glyph/bar clearance matrix and explicit sides beside an
  extended staff;
- the Division-menu keyboard (End, Enter, Escape, remembered variant, no
  empty fieldset);
- sticky-tool focus reveal with Tab and Shift+Tab, and no scroll when focus
  is already visible;
- the human-timed lyric press in the reveal margins. Check this against
  `pointer-activation.spec.ts` to avoid duplicating it.

The legacy check that the preview has `pointer-events="none"` is replaced by
the behavioural check that the preview is non-focusable and not a target, or
it is justified.

### M2.2 Complete local persistence

Port:

- title IME composition with Enter, blur commit, Export committing a
  pending title, leaving an unchanged title keeping redo, and the
  `Sálve-Regina` and `untitled` filenames;
- the remaining rejected imports. Keep one browser path per rejection
  class (alert, intact cache, unchanged history). Exhaustive validation
  stays in Vitest.
- a dirty lyric draft and a staged clef edit blocking Document controls;
- corrupt-cache recovery, Replace cache and Retry save;
- throwing storage reporting "Not saved". Injecting the failing storage
  with `addInitScript` is allowed as controlled setup.
- the Help disclosure, the header without a fieldset, responsive header
  containment at 1440px and 320px, long titles, and `/assets/` paths;
- the same-task synchronous save. Decide between the browser and Vitest,
  and justify the choice.

IME needs a recorded approach: a Chromium `CDPSession` IME call, a documented
synthetic composition-event setup, or a justified Vitest/state test. It must
not be dropped silently.

### M2.3 Hosted CI smoke job

Add an `E2E smoke` job to `.github/workflows/ci.yml`:

- `npm ci`, then `npx playwright install --with-deps chromium firefox`,
  with the browser cache keyed by the Playwright version;
- `npm run test:e2e -- --grep @smoke` for both projects, with `retries: 0`
  so flakiness stays visible;
- the HTML report and traces uploaded as artifacts on failure.

The job is **not** added to branch protection.

Initial `@smoke` set: the division pointer insert with Undo, persistence
refresh/restore, the pointer-activation division click, and one keyboard
workflow. M2.7 adds neume-palette placement, and later groups may add one
representative test each. Keep font-metric and geometry-matrix tests out.

Record hosted run results in `docs/testing.md#continuous-integration` and the
PR. A later owner decision makes the job required, based on its record across
real PR runs: the number of runs, any flakes, and their causes.

### M2.4 Issue #123 investigation (Playwright)

Write focused Playwright reproductions of the three failures using the M2.1
and M2.2 conventions. Classify each against its owning contract (the
[editor interactions guide](../editor-interactions.md), the
[layout and rendering guide](../layout-and-rendering.md) and the relevant
ADRs):

- **Product regression.** Visible behaviour contradicts a documented
  contract. Escalate it; the fix goes in a separate planned `fix:` PR. Until
  then, the spec keeps the full assertion under `test.fail()` with the issue
  link.
- **Outdated test assumption.** The documented contract holds when exercised
  through user-visible means, and the driver relied on an incidental detail
  (a selector, a fixed coordinate, palette geometry, timing). The new
  assertion expresses the contract, and the crosswalk explains the change.
- **Ambiguous, or a contract that is itself unclear.** Stop and report
  options to the owner. Do not choose.

Starting leads (these are not findings):

- extended-scandicus-climacus first fails at the #119 merge (`7163deb`,
  palette icons). The legacy `placeAt` hovers at a fixed SVG x after
  choosing a variant, and no ghost appears.
- word-composition's first failing revision lies between `eea0095` and
  `f1b144b`; bisect it.
- note-modifiers fails intermittently on a null read. Identify the calling
  scenario. If Playwright's auto-waiting makes it pass, the PR must still
  say whether the race can reach a user.

Deliverables:

- the reproduction specs;
- a findings record in `docs/verification/` and a summary comment on #123;
- any split issues.

The full driver ports happen in M2.8, M2.10 and M2.12, which absorb these
specs.

### M2.13 Accidentals and compatibility

Before porting, determine what the cross-build checks verify. Preliminary
reading:

- The `CHANT_LEGACY_URL` mode checks across real builds on one origin:
  - an older build saves a v4 cache;
  - the current build loads it without writing;
  - the first current edit writes the current version;
  - the older build then reports "Not saved" and must not overwrite the
    newer cache, including after an edit and a refresh.
- `note-shapes/storage-review.mjs` checks the same kind of v2/v3 round
  trips across a pinned old build (`56816a4`, built in a temporary
  directory), plus another-tab conflicts.

Separate these into:

- pure version detection, validation and refusal decisions, which go to
  Vitest;
- current-build browser behaviour with a synthetic older-version or
  newer-version cache, which goes to Playwright;
- genuine cross-build behaviour. Deployed GitHub Pages tabs can run an
  older build against a newer cache, so this stays browser-tested.
  Propose a mechanism, for example an opt-in Playwright project that builds
  a pinned revision through a worktree-backed web server. The alternative is
  an explicit owner decision to retire it.

Record the analysis and decision in the b-accidentals and note-shapes
records. Do not delete either mode before that decision.

### M2.16 Diagnostic-script audit

Audit every non-routine script before deletion and classify each as **keep
and relocate** (a maintained location such as `scripts/verification/`, with
a short usage note) or **delete as superseded**. Scripts to audit:

- historical drivers `lyric-anchors`, `syllables` and
  `placement/browser-check.mjs`;
- the `render-comparison.mjs` boards;
- the vertical-episemata raster and weight scripts, plus
  `save-raster-evidence.py`;
- `three-note-baseline.mjs`;
- `note-shapes/storage-review*.mjs`, depending on the M2.13 decision;
- `word-composition/corpus-browser.mjs` and its corpus `.ts` tools.

Criteria: is the script still runnable against the current app, is it used
for owner review of future engraving work, and does a maintained alternative
exist? Committed outputs (PNG, PDF, JSON, GABC, TeX) and Markdown records
stay where they are.

### M2.17 Runner removal and relocation

Precondition: no required browser coverage depends on the runner. That
means the manifest is empty, or every remaining entry has been explicitly
accepted by the owner as non-required with a reason. Then:

- Relocate `runner/vite-server.mjs` to `tests/e2e/support/`, trimmed to
  what Playwright uses. It is still needed for the private dev `cacheDir`
  and the preview output directory.
- Relocate `placement/browser-fixture.html` to `tests/e2e/fixtures/`.
  Update `playwright.config.ts`, the helpers and any kept tools. The
  placement README records where the fixture moved.
- Delete the runner (`cli`, `run`, `selection`, `processes`, `resources`,
  `manifest`, `test/`), the `verify:browser` and `test:verify-runner`
  scripts, and the `.verification-runs/` ignore entry.
- Move the runner README's Maintenance B/C results into
  `docs/verification/testing-history.md`.
- Update `docs/testing.md`, `AGENTS.md` (commands and testing guidelines)
  and `docs/verification/README.md`, which becomes an index of the
  records.
- Review whether Playwright as the single browser-test runner warrants an
  ADR, or whether the testing guide suffices.

## Acceptance criteria (M2 as a whole)

- [ ] M2.1 and M2.2 retire `divisions` and `local-persistence`, with
      complete crosswalks and same-revision evidence, before M2.4 begins.
- [ ] A non-required `E2E smoke` CI job runs both browsers on PRs. It
      includes neume-palette placement by the end of M2, and its hosted
      results are recorded.
- [ ] Each #123 failure is classified with evidence. Product regressions
      are fixed in separate PRs or tracked with `test.fail()`. No assertion
      is weakened without a cited contract and owner approval.
- [ ] Every manifest driver is either retired with a crosswalk or
      explicitly deferred by the owner with a reason. Every dropped
      assertion has a written justification.
- [ ] Specs from single-browser drivers have results in both browsers, and
      any limits are recorded.
- [ ] The cross-build checks are analysed and covered, or their retirement
      is an explicit owner decision.
- [ ] Each diagnostic script is classified, and kept tools are relocated
      with usage notes.
- [ ] The runner is removed only after its precondition holds. No custom
      CDP/BiDi transport infrastructure (hand-written WebSocket clients,
      protocol message plumbing or input synthesis) remains in routine
      coverage. A justified, documented use of Playwright's own protocol
      access, such as a `CDPSession` for IME testing, is acceptable. The
      historical records under `docs/verification/` are intact.
- [ ] Every PR records actual results of `format:check`, `lint`, `test`,
      `build`, `git diff --check` and `test:e2e`, plus
      `test:verify-runner` and the relevant legacy drivers while the runner
      exists.
- [ ] Production code changes only in separately planned `fix:` PRs.

## Exclusions

WebKit, visual-snapshot baselines, making CI required, running the full
Playwright suite in hosted CI (M3), page-object layers, and product behaviour
changes inside migration PRs.

## Open questions and stop conditions

Stop and report options when:

- a legacy assertion's contract is undocumented or contradicts the owning
  guide;
- a behaviour cannot be exercised in Playwright without production changes;
- a Firefox enrolment failure cannot be classified;
- equivalence would require dropping meaningful protection.

Open questions for later milestones: the IME approach (M2.2), the
cross-build mechanism (M2.13), and when to make the smoke job required
(after M2.3 has a run history).

## Delivery

For each milestone: branch from `master`, implement, verify per the
[testing guide](../testing.md), and open a PR against `master`. Report:

- the changes and the crosswalk;
- the exact commands and their results;
- dropped assertions with their justifications;
- deviations from this plan, and the remaining items.

Do not merge.

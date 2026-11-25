# Score focus reparenting verification (readability M2)

The [interaction guide](../../editor-interactions.md#focus) owns the focus
contract. The [M2 plan](../../plans/editor-readability-m2.md) owns scope. M2
moved note and lyric controls into `NeumeControl` and `LyricControl`. Focus
restoration still depends on the score's note-registration callback. React
calls it on every ref swap, and when it detaches a note, including before it
reparents one. No routine driver covered that path in either browser, so this
one does.

## Driver

`browser-check.mjs` (runner ID `score-focus-reparenting`, production preview,
Chromium CDP and Firefox BiDi, clears test-origin storage) imports the bundled
Dominican Salve Regina at 1440×1100. It waits for measured layout to settle,
then dispatches FontFaceSet `loading`/`loadingdone` events to force the real
lyric-measurement fallback and back, as `lyric-spacing` does. It checks:

1. The fallback layout moves notes and lyrics into a different system group,
   and `loadingdone` restores the measured layout.
2. A note reached by trusted Tab keeps browser focus, by note ID, through both
   reparents. It also returns to its original system.
3. A note focused by script `focus()` does the same. This leaves that note
   (`notes[1]`) as the score's last tracked focus target.
4. A lyric reached by trusted Tab: preconditions are strict in both browsers.
   The lyric must be focused before reflow, must move to another system, and
   must return. In Chromium the lyric must also keep focus. Firefox is covered
   by the known behavior below.
5. Focus on a palette button outside the score is not taken by either reflow.
   The case where focus rests on `<body>` while a stale control is tracked is
   not covered.

The driver also logs the `focusin` targets a document listener sees and the
actual active element after each lyric reflow, as evidence rather than
assertions.

### Known baseline behavior: headless Firefox lyric focus (not an M2 regression)

Observed with this driver on 2026-11-17, identically on the M2 branch and on
the exact base `9b9d2af`:

- The `focusin` listener recorded **no events at all** in headless Firefox. It
  recorded none while reaching the lyric by script focus plus trusted Tab, and
  none for a script-focused HTML palette button. Chromium recorded each target.
- After the fallback reflow, the active element was **not** the lyric and
  **not** `<body>`. It was the note `notes[1]` from step 3. It remained there
  after the measured return. Focus was **redirected**, not lost.

The likely mechanism is inferred from the code and not proven. The tracker
never learned that the lyric was focused, so it still pointed at `notes[1]`.
That note was also reparented, and the restore effect refocused it by ID.
Because no `focusin` was seen even for an HTML button, the missing events look
like a headless/no-window-focus property of this session rather than something
specific to SVG. Headed Firefox with real window focus has **not** been checked.
It may not show the symptom.

In Firefox the driver tolerates exactly that outcome: the active element is the
`g` for `notes[1]` after both reflows. Any other outcome fails. Preconditions,
protocol errors and every other assertion propagate normally. If the lyric
keeps focus, the check passes and prints a note asking for it to be made strict.

This is a candidate for a focused fix after M2, for example a lyric detachment
record or clearing a stale tracked note. M2 deliberately does not change it.

### Negative and mutation checks (2026-11-17)

Each change was applied temporarily and then reverted:

- Removing the focused-note record from `registerNoteElement` in `ScoreSvg.tsx`
  failed Firefox at "Tab-focused note: focus survives fallback reparent".
  Chromium still passed. In this headless Firefox session the record is the
  only path that restores focus to a note.
- Changing the tolerated lyric outcome to a different note (`notes[0]`) failed
  Firefox at "Firefox lyric: only the baseline redirection to notes[1] is
  tolerated". This shows that unexpected outcomes are not swallowed.

## Results (2026-11-17)

Linux, Node 24.12.0, Chromium 157.0.8103.38, Firefox 146.0.

- M2 branch: Chromium passed, including the strict lyric check. Firefox passed
  and reported the known lyric redirection.
- Exact base `9b9d2af` (driver copied into a base worktree): identical outcomes
  and identical diagnostic output.

## Playwright migration (M2.5)

Status: **coverage complete; retirement awaiting owner approval.** This
crosswalk maps each scenario in [`browser-check.mjs`](browser-check.mjs) to
[`tests/e2e/score-focus-reparenting.spec.ts`](../../../tests/e2e/score-focus-reparenting.spec.ts)
(production preview, Chromium and Firefox, 1440 × 1100) under the
[M2 plan](../../plans/playwright-m2-migration.md). The driver stays in the
runner manifest until the owner accepts this equivalence.

Setup in every test matches the driver: load the bundled "Salve Regina
Dominican" (through **Load example**; the driver imported the same file), wait
for `document.fonts.ready` and a settled measured layout, then use FontFaceSet
`loading`/`loadingdone` events to force the measurement fallback and back.
That event dispatch is controlled setup; no native path exists.

| #   | Legacy scenario (lines)                                                                                                                                                    | Playwright                                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Preconditions: the fallback moves at least two notes and one lyric to another system; `loadingdone` restores the measured layout (244–251)                                 | `beforeEach` (`movingControls`), asserted in every test.                                                                                                                                                                             |
| 2   | A note reached by native Tab keeps focus by ID through the fallback reparent (moving to another system) and the measured one (returning to its system) (253–256)           | "a note reached by native Tab keeps focus through both reparents".                                                                                                                                                                   |
| 3   | A note focused by script does the same (257–264)                                                                                                                           | "a note focused by script keeps focus through both reparents".                                                                                                                                                                       |
| 4   | A lyric reached by native Tab, after a script-focused note is the tracked focus: strict in Chromium; in Firefox the exact redirection to that note was tolerated (265–322) | "a lyric reached by native Tab keeps focus through both reparents, even after another note had focus". **Strict in both browsers.** The same preceding script focus is reproduced inside the test, so the stale tracked note exists. |
| 5   | Focus on a palette button outside the score is not taken by either reflow (323–339)                                                                                        | "reflow never takes focus from a palette button outside the score" (also with a previously focused, reparented note tracked).                                                                                                        |

### Firefox: the tolerated redirection does not occur under Playwright

On the same revision (`d5603ec`), the legacy driver in headless Firefox (WebDriver BiDi)
again logged "KNOWN BASELINE BEHAVIOR … lyric focus redirected to the stale
tracked note". Under Playwright Firefox 159.0 the lyric **keeps** focus through
both reparents, and the strict assertion passed in every run, including
`--repeat-each=10`. A probe on the production preview found that Playwright
Firefox delivers `focusin` for SVG notes and for an HTML palette button and
reports `document.hasFocus()` as true. The BiDi session saw no `focusin` at
all. That is consistent with this record's inference that the redirection
belonged to a headless session without window focus, so the M2.5 test is
strict rather than tolerant. Foreground headed Firefox is still not checked.
Issue #96 tracks the observation.

### Proposed removals

- **A. The Firefox tolerance branch** (lines 297–321). It is replaced by the
  strict assertion, which now passes in Firefox.
- **B. Diagnostic logging** of `focusin` targets and active elements, which
  was evidence, not assertions.
- **C. File import through `DataTransfer` and a stubbed `confirm`.** The score
  is loaded through **Load example** with a real confirm; the document is the
  same bundled file.

### Negative control

In a temporary worktree of `222ea05`, the `ScoreSvg` restore effect was made to
return immediately. All three focus-retention tests failed in both browsers on
"focus survives the fallback reparent", and the palette test still passed. The
worktree was removed.

### Results (M2.5, 2026-11-24)

Implementation commit `d5603ec` with a clean tree. Linux x64, Node 24.12.0,
Playwright 1.65.1 (Chromium `chromium-1255`, Firefox 159.0 `firefox-1572`).
The runner used installed Chromium 157.0.8103.38 and Firefox 146.0.

| Check                                                                                                                                    | Result                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Legacy `npm run verify:browser -- --driver bundled-example,editor-toolbar,score-focus-reparenting,css-zoom-toolbars --browser both -j 4` | 8 of 8 passed (50.7 s wall clock)                                                                                   |
| `npm run test:e2e` (all specs, both browsers)                                                                                            | 277 passed, 1 skipped (the Chromium-only IME test in Firefox)                                                       |
| The four M2.5 specs (66 tests across both browsers), `--repeat-each=10`                                                                  | 660 passed, 0 failed, 0 flaky                                                                                       |
| Negative controls (temporary worktrees, removed)                                                                                         | #112 fix parent: 8 CSS-zoom failures; restore effect disabled: 6 focus failures; palette reset disabled: 2 failures |
| `format:check`, `lint`, `test` (118 files / 2,703 tests), `build`, `git diff --check`, `test:verify-runner` (28/28)                      | All passed                                                                                                          |

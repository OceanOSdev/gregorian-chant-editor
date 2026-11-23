# Playwright M1 cross-browser E2E pilot

Plan: [`docs/plans/playwright-m1-pilot.md`](../../plans/playwright-m1-pilot.md).
Setup, commands and conventions:
[testing guide](../../testing.md#playwright-end-to-end-tests-m1-pilot).
Specs: [`tests/e2e/divisions.spec.ts`](../../../tests/e2e/divisions.spec.ts)
(development fixture) and
[`tests/e2e/local-persistence.spec.ts`](../../../tests/e2e/local-persistence.spec.ts)
(production preview).

The pilot ports a **subset** of two legacy drivers. Neither
`divisions/browser-check.mjs` nor
[`local-persistence/browser-check.mjs`](../local-persistence/browser-check.mjs)
is retired, disabled or claimed equivalent; both stay in the runner manifest
and smoke preset. (M2.1 later retired the divisions driver; see its
[migration record](../divisions/README.md#playwright-migration-m21).)

## Coverage crosswalk

"Ported" means the Playwright spec asserts the same observable contract in
both browsers. "Partial" names what is left out. "Legacy only" capabilities
remain covered only by the original driver.

### Divisions (development fixture)

| Legacy scenario                                                                                                                                | Playwright                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native pointer caret and commit before/after a division at 1440px and 320px; lyric IDs kept; Punctum stays armed; Escape; Undo/Redo order      | **Ported** (4 tests per browser). The caret is checked against rendered division ink and neighbour positions instead of the layout module's slot x. The legacy `pointer-events="none"` preview check is not ported.                                                                  |
| Explicit Insert Punctum before/after buttons by pointer click                                                                                  | **Partial.** The same buttons are activated by keyboard (next row), not pointer.                                                                                                                                                                                                     |
| Native Tab from the kind select to each Insert button, Enter inserts, Undo                                                                     | **Ported** in both browsers. The legacy driver skips Enter activation in Firefox/BiDi; Playwright Firefox activates it.                                                                                                                                                              |
| Pointer click focuses the division; kind change to Finalis (2 ink lines); Undo/Redo keep focus and kind; Delete; Undo restores the same ID     | **Ported**, with selection by keyboard Enter. Kind change uses `selectOption` (programmatic, like the legacy DOM `change`; neither opens the OS popup). Pointer selection is a separate expected-failure test: see [known defect](#known-product-defect-division-pointer-selection). |
| Native Tab note → division (focus without selection) → note; Backspace deletes                                                                 | **Ported**, plus Shift+Tab back to the division and Undo.                                                                                                                                                                                                                            |
| Four kinds through the Division menu tool: ghost ink line counts, non-focusable preview, tool persistence, seven-item order                    | Legacy only.                                                                                                                                                                                                                                                                         |
| Leading, adjacent, trailing, division-only and 20-neume multi-system scores; every division focusable                                          | Legacy only.                                                                                                                                                                                                                                                                         |
| Outgoing mark across reflow and 150% CSS zoom keeps division focus                                                                             | Legacy only.                                                                                                                                                                                                                                                                         |
| Oversized lyric: local score scrolling, page containment, pointer focus after scrolling                                                        | Legacy only (page containment at 320px is asserted in the pointer tests).                                                                                                                                                                                                            |
| PR #48 measured glyph/bar clearance matrix (word/continuation, 4 length pairs, 2 widths) and explicit sides beside an oversized extended staff | Legacy only.                                                                                                                                                                                                                                                                         |
| Division menu keyboard: End, Enter, Escape, remembered variant; no empty Divisions fieldset                                                    | Legacy only.                                                                                                                                                                                                                                                                         |
| Native Tab/Shift+Tab reveals focus covered by the sticky tools, and does not scroll visible focus                                              | Legacy only.                                                                                                                                                                                                                                                                         |
| Pointer press/release with human timing on a lyric in the top and bottom reveal margins                                                        | Legacy only.                                                                                                                                                                                                                                                                         |

### Local persistence (production preview)

| Legacy scenario                                                                                                                                | Playwright                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First load leaves the cache absent; a select change saves synchronously in the same task                                                       | **Partial.** Absent cache and the save are asserted; the same-task synchronous save is not (Playwright observes it after the action).                                                                                            |
| Refresh restores committed content, “Saved locally” and fresh history; Undo/Redo save and survive refresh                                      | **Ported.**                                                                                                                                                                                                                      |
| New with cancel and accept                                                                                                                     | **Ported** through real `confirm` dialogs (the legacy driver replaces `window.confirm`).                                                                                                                                         |
| Import of the v8 multi-system fixture re-saves v10, clears history; import cancel keeps the cache                                              | **Ported.** The accepted import goes through the native file chooser (the legacy driver sets `input.files` from a `DataTransfer`); the cancelled one sets the real file input, see [Firefox file chooser](#browser-differences). |
| Export bytes and sanitized filename; re-import round trip                                                                                      | **Ported** through a real download (the legacy driver replaces `URL.createObjectURL` and anchor `click`). Re-import after the download sets the real file input; see [Firefox file chooser](#browser-differences).               |
| Title draft, Escape, Enter, focus return, refresh, one history entry                                                                           | **Ported.**                                                                                                                                                                                                                      |
| Title: IME composition Enter, blur commit, Export commits a pending title, unchanged leave keeps redo, `Sálve-Regina` and `untitled` filenames | Legacy only.                                                                                                                                                                                                                     |
| Rejected imports: malformed JSON, future version, invalid neumes, oversize file, unsafe integer                                                | **Partial.** Malformed JSON only (alert and intact cache). The rest are legacy and unit tested.                                                                                                                                  |
| Dirty lyric draft and staged clef edit block Document controls without saving                                                                  | Legacy only.                                                                                                                                                                                                                     |
| Another tab writes the cache: conflict status, edits do not overwrite, Load cached score                                                       | **Ported** with a real second page in the same browser context.                                                                                                                                                                  |
| Corrupt cache recovery and Replace cache / Retry save; throwing storage reports “Not saved”                                                    | Legacy only.                                                                                                                                                                                                                     |
| Help disclosure, no header fieldset, responsive header containment and screenshots at 1440px/320px, long titles, `/assets/` paths              | Legacy only.                                                                                                                                                                                                                     |

## Known product defect: division pointer selection

Found by this pilot and escalated, not fixed (the plan forbids production
changes). [Editor interactions](../../editor-interactions.md#stage-5b-division-controls)
says “In Select, click or Enter/Space selects a division”. In Chromium and
Firefox, on the development fixture and on the production preview with a
bundled example, a pointer click on an unselected division focuses it but does
not select it (`aria-pressed` stays `false`). The press moves focus, the
Divisions controls for the focused division mount above the score and push it
down (about 141 px at 1440px), so the release lands outside the division and
the `click` goes to `.chant-editor`. Scrolling the division to the centre
first does not help. The legacy driver asserts only focus after its click, so
it has always passed.

`divisions.spec.ts` recorded this as `test.fail()` with the full assertion.
The fix for issue #121 removed the marker once the test passed normally.

## Browser differences

- **Playwright Firefox file chooser.** With Playwright 1.65.1 (Firefox 159.0,
  `firefox-1572`), a second or later Import picker in the same page
  intermittently never produced a `filechooser` event: 3 of 6 repeats when
  the third picker followed an accepted import or a download, and once in a
  single full run for a second picker. Failures were more frequent under
  parallel load. `page.bringToFront()` did not help. No first picker in a page
  failed. Each spec page therefore opens one native picker and uses
  `setInputFiles` on the real file input for later imports. Chromium never
  failed. The likely cause is Playwright's Firefox picker interception, not
  the app, but this has not been checked in a foreground, installed Firefox.
- **Firefox keyboard activation.** Playwright Firefox activates the Insert
  before/after buttons with Enter. The legacy BiDi driver documents that
  headless installed Firefox does not, and skips the step.
- **Caret position at 320px.** In Firefox the caret can sit up to about 0.4 px
  inside the division's padded hit target. The assertion therefore compares it
  with the division ink, which is the contract.

## Results (2026-11-22)

Implementation revision `c421a5f` (clean tree). The legacy drivers and the
Playwright specs ran on that same revision. Linux x64, Node 24.12.0 (the
repository declares 24.18.0), Playwright 1.65.1 with Chromium `chromium-1255`
and Firefox 159.0 (`firefox-1572`). The runner used installed Chromium
157.0.8103.38 (snap) and Firefox 146.0.

Standard gate, all exit 0: `format:check`, `lint`, `test` (117 files /
2,681 tests, no Playwright spec collected), `build` (including
`tsconfig.e2e.json`), `git diff --check` and `test:verify-runner` (28/28).

| Check                                                                                                     | Chromium                   | Firefox                    |
| --------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------- |
| Legacy `divisions` (`npm run verify:browser -- --driver divisions,local-persistence --browser both -j 2`) | passed, 37.2 s             | passed, 39.1 s             |
| Legacy `local-persistence` (same run)                                                                     | passed, 12.8 s             | passed, 16.1 s             |
| `divisions.spec.ts` (9 tests per browser)                                                                 | 9 passed (1 expected fail) | 9 passed (1 expected fail) |
| `local-persistence.spec.ts` (5 tests per browser)                                                         | 5 passed                   | 5 passed                   |

Legacy run: 55.8 s wall clock, cleanup succeeded, run directory
`.verification-runs/run-2026-11-22T11-03-49-148Z-Xdq81W/` (ignored, not
committed). `npm run test:e2e`: 28 passed in 14.0 s with 8 workers (14.4 s wall
clock including both servers and the preview build). "Expected fail" is the
`test.fail()` pointer-selection test. Playwright counts it as passed because it
failed as declared.

The two runners cover different amounts. The legacy drivers run every
scenario in the crosswalk, and the specs run only the rows marked Ported or
Partial. Neither run produced an unsupported pair. The only behavioural
difference between them is the Firefox Enter activation described above.

Stability and lifecycle, at the same spec bytes:

- `npm run test:e2e -- --repeat-each=5`, twice: 140/140 each. Three more
  single runs: 28/28 each. `local-persistence` with `--repeat-each=10
--workers=16`: 100/100.
- Earlier spec revisions (one picker per page not yet enforced) failed
  intermittently in Firefox only; see
  [browser differences](#browser-differences). One such failure was in the
  first single run at `18f5364`; the legacy drivers passed at that revision too.
- A forced failure run (`--timeout=1`, 28 failed) left no Playwright browser
  or web-server process. With 127.0.0.1:5180 already in use, the run refused
  to start ("is already used … set reuseExistingServer") rather than testing
  the other server.
- `git status` stayed clean after every run; all output stayed in
  `.playwright/` and `.verification-runs/`.

Not run: hosted CI (not part of this milestone), WebKit, and foreground
browser, OS zoom, native popup, IME or screen-reader checks.

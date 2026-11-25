# CSS zoom contextual toolbars (issue #112)

> **Retired in Playwright M2.5.** `browser-check.mjs` was deleted after the owner
> accepted its [crosswalk](#playwright-migration-m25). Commands and results
> below are historical; recover the script with
> `git show 7cb61ba:docs/verification/css-zoom-toolbars/browser-check.mjs`.

The [interaction guide](../../editor-interactions.md#sticky-editing-tools) owns
the placement contract. Issue #112 found that the note and accidental
properties panels were scaled twice under CSS `zoom`. They were placed from
client-pixel measurements but written to inline CSS pixels, so the root
`zoom` scaled them again. At 150% zoom in a 480×1100 viewport, the note panel
opened about 290px below its note and past the viewport's bottom and right
edges. Close then received no pointer events. The `lyric-spacing` (Chromium)
and `lyric-spacing-selection-cue` (Firefox) drivers failed when dismissing it.
`7062268` exposed the defect when the sticky toolbar's bottom became the
panel's upper limit, which moved the panel below the note.

## Driver

`browser-check.mjs` (runner ID `css-zoom-toolbars`, dev fixture, Chromium CDP
and Firefox BiDi) mounts 16 puncta under a C clef on line 4, with a flat
owned by the B at index 8. It runs four viewport modes:

| Mode            | Viewport  | Device pixel ratio | CSS `zoom` |
| --------------- | --------- | ------------------ | ---------- |
| `desktop-1440`  | 1440×1100 | 1                  | 1          |
| `narrow-320`    | 320×1100  | 1                  | 1          |
| `css-zoom-150`  | 480×1100  | 1                  | 1.5        |
| `page-zoom-150` | 320×733   | 1.5                | 1          |

`page-zoom-150` is what 150% browser zoom gives a 480×1100 window: fewer CSS
pixels and denser device pixels, with no CSS `zoom`.

In each mode it opens each panel (note `note6`, accidental `flat`) with a
native click, with the target at 50% and at 85% of the viewport height. Then
it asserts:

1. The panel's `currentCSSZoom` is the CSS `zoom` (1 under page zoom). This
   keeps CSS zoom and real browser zoom distinct.
2. The inline left and top, times that zoom, equal the rendered client
   position (±0.5px), so the position is scaled once.
3. The panel stays inside the visual viewport, does not cover the sticky
   toolbar's visible bottom, and does not overlap its target.
4. `document.elementFromPoint()` at Close's centre is Close. A panel shorter
   than its content (the short-viewport policy, for example 320px with a low
   note) is first scrolled internally to Close; the page must not scroll.
5. Each dismissal route closes the panel and returns focus to the note or
   accidental glyph:
   - **pointer:** a native move, press and release at Close's centre;
   - **escape:** native Tab from the selected target into the panel, then
     Escape;
   - **keyboard** (Chromium only): Close is focused, then a native Enter.

That is 48 cases in Chromium and 32 in Firefox. Screenshots of each mode's
centred pointer case go to a fresh temporary directory.

### Known baseline behavior: headless Firefox Enter on a button

In headless Firefox, `document.hasFocus()` is false. A native BiDi Enter on
a script-focused Close delivers `keydown`, `keypress` and `keyup` (`code`
`Enter`, WebDriver `\uE006`) but no `click`. This is identical on the
unmodified base `d1439ed`; `\uE007` (NumpadEnter) also produced no `click`. It
is a headless automation limitation, not a placement change, so Firefox skips
only the keyboard route.
Escape, which the panel handles on `keydown`, and native pointer Close are
still checked.

## Verification (2026-11-22, Chromium 157, headless Firefox)

- On the unmodified base `d1439ed`, this driver failed in both browsers at
  the first CSS-zoom case (`css-zoom-150 note at 0.5 by pointer: panel leaves
the viewport`). The note panel was rendered from y≈857 to y≈1190 in a
  1100px viewport. The accidental panel failed the same way when run alone.
  The `lyric-spacing` and `lyric-spacing-selection-cue` drivers failed as
  recorded in issue #112.
- With the fix (`1ffffbc`), the following passed in three consecutive runner
  invocations: `lyric-spacing` (Chromium), `lyric-spacing-selection-cue`
  (Firefox) and this driver (Chromium, 48 cases; Firefox, 32 cases). None of
  the original drivers changed.
- `npm run verify:browser -- --preset full --browser both` at clean `1ffffbc`
  reported 54 passed, 2 failed and 6 unsupported. The two failures are
  `word-composition` in Chromium and Firefox (`punctum selected whole-neume
cue must be clipped`). They fail identically on the base `d1439ed`, which
  makes them pre-existing and unrelated to toolbar placement.

## Playwright migration (M2.5)

Status: **accepted and retired.** The owner approved this crosswalk and its
removals on 2026-11-24; the driver was removed from the runner manifest and
deleted (recover it with `git show 7cb61ba:docs/verification/css-zoom-toolbars/browser-check.mjs`). This
crosswalk maps the driver (the former `browser-check.mjs`) to
[`tests/e2e/css-zoom-toolbars.spec.ts`](../../../tests/e2e/css-zoom-toolbars.spec.ts)
(development fixture, Chromium and Firefox) under the
[M2 plan](../../plans/playwright-m2-migration.md).

The spec keeps the driver's matrix: four modes (1440 × 1100; 320 × 1100;
480 × 1100 at 150% CSS `zoom`; 320 × 733 at device pixel ratio 1.5 with no
CSS zoom), two panels (note `note6`, accidental `flat`), two target heights
(50% and 85%) and three dismissals. The page-zoom mode **emulates** the
conditions 150% browser zoom produces (CSS viewport and device pixel ratio);
it does not exercise real foreground browser zoom. That is 16 tests per browser, each running
all three dismissals.

| #   | Legacy assertion (lines)                                                                                                                          | Playwright                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | A native click on the target opens its panel (211–220)                                                                                            | Every test (`open`).                                                                                                                                   |
| 2   | An internally scrolling panel reaches Close without scrolling the page (266–276)                                                                  | "page scrolled" check.                                                                                                                                 |
| 3   | `currentCSSZoom` equals the CSS zoom, 1 under page zoom (280)                                                                                     | "effective zoom". Page-zoom tests also assert `devicePixelRatio === 1.5`, so the mode is real.                                                         |
| 4   | Inline left/top × zoom equal the rendered position, ±0.5 px (282–286)                                                                             | **Removed** (item A; approved).                                                                                                                        |
| 5   | Inside the visual viewport; below the sticky tools' visible bottom; clear of the target (287–302)                                                 | Same checks, in client pixels.                                                                                                                         |
| 6   | `elementFromPoint` at Close's centre is Close (304)                                                                                               | "Close is the hit target".                                                                                                                             |
| 7   | Dismissal by native pointer on Close; by native Tab into the panel then Escape; by keyboard Enter on Close — **Chromium only** (254–258, 306–321) | All three dismissals **in both browsers**. Playwright Firefox activates Close with Enter; the driver skipped it because headless BiDi Firefox did not. |
| 8   | The panel is dismissed and focus returns to its target (322–323)                                                                                  | "dismissed" and "focus returns".                                                                                                                       |

### Proposed removals

- **A. The inline-style arithmetic (row 4), removed.** It checked the
  implementation's CSS-pixel bookkeeping rather than placement. The negative
  control below shows the rendered checks alone catch the #112 defect.
- **B. Review screenshots** (`*-open`), never asserted.
- **C. Script `focus()` on Close before Enter** is kept, as in the driver: it
  isolates Enter activation from Tab order, which row 7's Escape path already
  covers.

### Negative control

The spec was run at `1ffffbc^`, the parent of the #112 fix, in a temporary
worktree. All four CSS-zoom tests failed in both browsers (8 failures), and the
desktop, narrow and page-zoom tests passed. With the inline-style check removed
from that copy, the same 8 tests still failed, on "right" (the panel leaves the
viewport). The worktree was removed.

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

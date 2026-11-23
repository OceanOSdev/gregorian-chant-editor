# Issue #123 investigation (Playwright M2.4)

Plan: [Playwright M2 migration](../../plans/playwright-m2-migration.md), M2.4.
Issue: [#123](https://github.com/OceanOSdev/gregorian-chant-editor/issues/123),
three legacy browser drivers failing on `master`. This is an investigation;
the drivers are not retired or fully migrated here (M2.8, M2.10 and M2.12).
No production code was changed, and the driver files are unchanged. Every
diagnostic edit to a driver was local, temporary and reverted, and is
described below.

## Summary

| Driver                        | Browsers               | Classification                                                                                                | First failing revision                                                          |
| ----------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `extended-scandicus-climacus` | Chromium, Firefox      | **Outdated test assumption**: a fixed hover point now under the taller desktop sticky tools                   | #119 merge `7163deb` (from #123; consistent with the toolbar measurement below) |
| `word-composition`            | Chromium, Firefox      | **Outdated test assumptions** (five, the later four hidden behind the first); no product regression found     | `7062268` (sticky tools, #86); the reported clip assertion from `4a363ce` (#87) |
| `note-modifiers`              | Chromium, intermittent | **Race in the legacy driver**: it clicked coordinates measured in the same frame as a documented focus reveal | Not bisected (a timing race, not a revision change)                             |

No product regression or defect was found, so no new issue was filed. The
focused Playwright tests pass in Chromium and Firefox.

## Extended Scandicus and Climacus

**Reproduction.** `npm run verify:browser -- --driver extended-scandicus-climacus --browser both`
on `9b49bad` fails in both browsers with `AssertionError: ghost visible` in
`placeAt` (`browser-check.mjs:312`). The call is at **line 573**: the Quilisma
figure step ("Ordinary authored quilismatic Scandicus is unchanged"), at 1440px.
It is not the menu-dismissal step at line 479.

**Contract.** The [interaction guide](../../editor-interactions.md) (Stage 9B-2
split controls, Quilisma figure, "Palette and contextual keyboard insertion")
requires the following:

- Choosing a variant or figure arms it.
- Hovering a valid staff point shows the ghost.
- A click commits the exact contour and leaves the tool armed.

After #119 the same guide says "Wider layouts may stack an icon above a wrapped
label". #119 made that layout choice deliberately, and only narrow toolbars
were constrained not to grow.

**Root cause.** `placeAt` scrolls the whole `svg.score` to the centre of the
window and then hovers a fixed score coordinate (x = 300 units on the first
system). By line 573 the score holds many inserted neumes and is tall, so
centring it leaves the first system near the top. Temporary diagnostics in the
driver recorded these values at the failing hover:

| Browser  | Hover y | Sticky tools bottom | `scrollY` | Element hit               | Placement armed (`score--placing`) |
| -------- | ------- | ------------------- | --------- | ------------------------- | ---------------------------------- |
| Chromium | 251.6   | 264.0               | 568       | a palette button (sticky) | yes                                |
| Firefox  | 251.6   | 272.0               | 593       | a palette button (sticky) | yes                                |

The pointer was over the sticky tools, so no ghost is the correct result. The
tool was armed: the driver had just asserted that the Quilisma button is
pressed. Measured with Playwright Chromium on the production preview at
1440 × 1100, the sticky tools are 238 px tall at `710aaf7` (before #119) and
264 px at `9b49bad`. The hover point at about y = 251 was therefore just
below the old toolbar and is now under it. At 320px the toolbar is 468 px at
both revisions.

**Evidence that this is not a product regression:**

- **Remainder of the driver.** With only `placeAt` changed temporarily to
  centre the first staff line instead of the whole score, the **entire legacy
  driver passed in Chromium and Firefox**. That covers every later step:
  refresh, export/import and v7 rejection.
- **Dismissal step.** In the menu-dismissal step (line 479) the hover was on
  the score and passed. A Playwright replay of that step on a fresh page
  showed, at both widths: a ghost with the menu open, the click consumed
  (cache unchanged), the menu closed, focus on the chevron and the variant
  still armed.
- **Same behaviour before #119.** The new
  [`extended-scandicus-climacus.spec.ts`](../../../tests/e2e/extended-scandicus-climacus.spec.ts)
  passes on `9b49bad` and also passes unchanged on `710aaf7`, so the
  user-facing behaviour is the same on both sides of #119.

**Playwright reproduction.**
[`extended-scandicus-climacus.spec.ts`](../../../tests/e2e/extended-scandicus-climacus.spec.ts)
uses the production preview with a tall 60-neume cached score, at 1440px and
320px. It brings the legacy x = 300 point to the middle of the window and
asserts that the score, not the tools, is the pointer target there. Then:

- **Quilisma figure:** "Scandicus" arms the Quilisma tool, the ghost appears,
  and the click commits a Scandicus with forms `[null, 'quilisma', null]`. The
  tool stays armed.
- **Each extended variant** (Scandicus 4 and 5, Climacus 4 and 5), chosen from
  its menu by native clicks, sets `data-active-variant`. Its ghost has the
  legacy ink count (2, 3, 4 or 5 paths), the click commits the exact contour,
  and the variant stays armed.

These tests distinguish the three outcomes the plan asked about: a failure to
arm (`aria-pressed` or `data-active-variant`), a failure to display (ghost
paths) and a failure to commit (cached neumes).

**Recommended next action.** In M2.8, port the driver with this approach:
target a visible staff point and assert it is the hit target. Do not centre
the whole score and hover a fixed coordinate.

## Word composition

**Reproduction.** `npm run verify:browser -- --driver word-composition --browser both`
fails in both browsers with `AssertionError: punctum selected whole-neume cue must be clipped`
(`browser-check.mjs:448`), in the compact-neighbour loop at 1440px.

**Contract.** [Layout and rendering](../../layout-and-rendering.md) ("Compact
neighbors receive derived horizontal `hitClip` ownership intervals …") says:

- SVG clips note targets, lyric-move targets and the placement/move rectangle
  decorations to the ownership intervals.
- "The whole-neume selection outline is instead fitted inside its interval and
  **never clipped**." Its outer stroke edge stays within ownership. Where there
  is room it encloses its own ink, and it never reaches neighbouring ink.

**Bisect.** I tested the legacy driver in Chromium on first-parent merges
between `eea0095` (passes) and `f1b144b` (fails), then on single commits. A
`git worktree` shared `node_modules`; dependencies do not change in the range.

| Revision  | What it is                                                   | Result                                                                          |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `eea0095` | Maintenance C owner acceptance                               | pass                                                                            |
| `9fddcbe` | #85 merge, just before #86                                   | pass                                                                            |
| `0cf584e` | #86: plan only                                               | pass                                                                            |
| `7062268` | #86: "keep editing tools accessible" (adds the sticky tools) | fail: `native accidental selection …` (intra-syllable review, after line 448)   |
| `53c8097` | #86 merge                                                    | fail: same; the line 450 clip check **passed**                                  |
| `6baa5e3` | #87, before the outline change                               | fail: `native accidental selection …`                                           |
| `4a363ce` | #87: "keep whole-neume selection outline complete …"         | fail: **`punctum selected whole-neume cue must be clipped`** (the #123 message) |
| `335994b` | #87 merge                                                    | fail: same                                                                      |
| `f1b144b` | Stage 11B docs                                               | fail: same                                                                      |

The driver first failed at `7062268`, and the reported assertion first failed
at `4a363ce`. From then on it fails before the accidental check is reached,
which hid the earlier failure.

**Root cause of the reported assertion.** `4a363ce` deliberately stopped
clipping the whole-neume outline, because the ownership clip removed its right
stroke and truncated its top and bottom strokes at compact boundaries. The
outline is now fitted inside the interval instead (`neume-selection-bounds.ts`),
with unit and browser coverage added in that commit
(`contiguous-selection/browser-check.mjs`). The driver's `inspectCue` still
requires the outline's nearest `clip-path` ancestor to be an ownership clip:

- **Between `4a363ce` and `4508e8d`** there is no such ancestor, so the check
  fails.
- **Since Stage 11B (`4508e8d`)** the nearest one is the system music group's
  vertical band clip (`x = 0`, documented system containment). Its left edge is
  not after the previous neume's ink, so the check still fails.

The assertion tests how the outline used to be drawn, and contradicts the
current contract.

**Masked failures.** I ran the rest of the driver with temporary local
corrections, one at a time, each reverted, until it passed in both browsers.
Four more outdated assumptions were behind the reported one, all in the shared
[`intra-syllable-grouping/browser-review.mjs`](../intra-syllable-grouping/browser-review.mjs):

1. **The accidental click ignores the sticky tools** (`selectAccidental`). It
   clicks the Kyrie XI flat at its current client centre without scrolling. In
   both browsers that centre was at y ≈ 101–133, under the sticky tools
   (bottom 264/272), and the hit was the palette. This is the same class as
   the `lyric-spacing` breakage recorded from `7062268`. Pointer selection of
   that flat works when the target is reachable (Playwright test below).
2. **Firefox: `selectNote` relies on `scrollIntoView` on an SVG group.**
   Firefox does not scroll correctly for an SVG group, so no painted hit
   region was found ("No painted pointer region for b25dac1c…"). This is the
   harness quirk already recorded in M2.1 and in the mid-score-clefs
   investigation. Chromium passed this step.
3. **The review requires the selected outline itself to carry `clip-path`**
   (`[data-selected-neume-id="bistropha"][clip-path]`, "whole-neume selection
   is clipped"). This is the same outdated assumption as the reported one.
4. **Hard-coded native file version 9** at lines 317 and 367. The app writes
   v10 since Stage 10B (`815143d`).

With all five corrected temporarily, **the entire legacy driver passed in
Chromium (67.7 s) and Firefox (76.4 s)**, including the placement-context and
lyric-move ownership clips (lines 461 and 477) that the reported failure had
hidden.

**Playwright reproduction.**
[`word-composition.spec.ts`](../../../tests/e2e/word-composition.spec.ts) runs
on the development fixture at 1440px and 320px, with two neumes on the compact
melisma "le-lu" for each of the seven kinds (punctum to porrectus). Each test:

- selects every constituent by native click and the whole neume by Shift+click;
- asserts the outline has **no ownership clip** (on itself or between it and
  its neume group);
- asserts that its outer stroke edges **enclose its ink**, **stay inside the
  ownership interval** and **never reach the neighbouring ink**;
- asserts that the **placement context** and the **lyric-move target** are
  clipped to the neume's own ownership clip.

A second group selects the first Kyrie XI melisma flat by native click, then
the adjacent note. On `6baa5e3` (before the outline change) all 28 compact
tests fail on "outline is not clipped", so the test detects the old behaviour.

**Recommended next action.** In M2.10, port the driver on this basis and drop
the five assumptions in its crosswalk: the clip requirement on the outline
(twice), the unscrolled accidental click, Firefox `scrollIntoView` on an SVG
group, and fixed native versions. The `intra-syllable-grouping/browser-review.mjs`
module belongs to that migration.

## Note modifiers

**Reproduction.** In 8 consecutive Chromium runs of
`npm run verify:browser -- --driver note-modifiers --browser chromium` on
`9b49bad`, 4 failed. Every failure was
`TypeError: Cannot read properties of null (reading 'text')` from `ev`, called
at **line 719**. Firefox passed in the runs made.

**Scenario.** The failing step is "Incompatible cache is neither loaded nor
overwritten, even after edits". A withdrawn draft-v2 value (`mora: 2`) is
cached, the bundled example is shown, a note is selected and its mora scope is
edited. The driver then patches `URL.createObjectURL` to capture the blob,
clicks **Download original cached source** with its `button()` helper, and
reads `window.exported.text()`. `null` means its click never activated the
button: `downloadSource` creates the blob, calls `createObjectURL` and clicks
the link synchronously inside the button's handler.

**Contracts.**
[Persistence](../../persistence.md) says incompatible and withdrawn caches keep
their exact bytes, which are recoverable through **Download original cached
source**. The [interaction guide's Focus section](../../editor-interactions.md#focus)
says programmatic focus is revealed after it settles. **Close note properties**
returns focus to its note (`focus({ preventScroll: true })`), and `ScoreSvg`
reveals that focus in the next animation frame.

**Root cause: a race in the legacy driver.** The `button()` helper first
closes the note-properties panel by script, which restores focus to
`note-punctum-1` and schedules the reveal. In the same frame it scrolls the
header button into view, measures it, and then sends the press and release
through separate protocol calls. Temporary instrumentation recorded the
following in 6 runs:

| Run    | `scrollY` at measurement | `scrollY` after click | Element at the measured point          | Captured |
| ------ | ------------------------ | --------------------- | -------------------------------------- | -------- |
| passed | 0                        | 0                     | the button                             | yes      |
| failed | 0                        | 252                   | a paragraph (`Initial clef changes …`) | no       |
| failed | 252 (moved before click) | 252                   | the same paragraph                     | no       |

The reveal scrolled the page by 252 px, either before or after the click was
delivered. The click then landed on text, not on the button that had moved.
Whether it failed depended only on whether the reveal frame ran before the
click arrived.

**Could a user hit this?** No evidence suggests it. The reveal runs in the
frame after closing the panel, about 16 ms later, and moves the page to the
note that just received focus. A user's next click is aimed at where the button
is after that scroll. The driver could fail only because it scrolled the page
programmatically and clicked stale coordinates within that same frame. The
Playwright test closes the panel with a native click and then clicks the
button with a locator, which waits for a stable position. It passed every
repeat. This shows the button and recovery bytes work when clicked normally;
it does **not** prove there is no other timing window.

**Playwright reproduction.**
[`note-modifiers.spec.ts`](../../../tests/e2e/note-modifiers.spec.ts) runs on
the production preview with the same incompatible cache. It:

- asserts the "requires resolution" status;
- selects the note natively and changes its mora scope, and asserts the cache
  is unchanged;
- closes the panel natively and asserts focus returns to the note;
- downloads the original cached source as `recovered-original.chant.json`
  with byte-identical content;
- asserts that Export writes a different, current file and that the cache is
  still unchanged.

**Recommended next action.** In M2.12, port this scenario with native locator
clicks and real downloads, replacing the `createObjectURL` patch. Do not
measure-then-click across a frame boundary.

## Findings about the Playwright conventions

- **Real hit-testing:** "the score is the hit target" as an explicit
  precondition, and Playwright's actionability checks (an intercepting element,
  a stable position), expose exactly the coverage and occlusion problems the
  legacy drivers missed or masked. Use them in M2.8–M2.12.
- **Panels in the way:** the selected neume's properties panel can cover a
  lyric (clivis at 1440px). Close it natively before clicking under it; the
  legacy driver dispatched synthetic clicks instead.
- **Ownership clipping:** in SVG, every system's music group has a band clip
  since Stage 11B. Checks for ownership clipping must stop at the neume group.

## Verification (2026-11-23)

Branch `test/playwright-m2-4-issue-123` from `9b49bad`. Linux x64, Node
24.12.0, Playwright 1.65.1 (Chromium `chromium-1255`, Firefox 159.0
`firefox-1572`). The legacy runner used installed Chromium 157.0.8103.38 and
Firefox 146.0. Results for the committed revision are in the PR.

- **Legacy reproduction on `9b49bad`:** `word-composition` and
  `extended-scandicus-climacus` failed in both browsers. `note-modifiers`
  passed in one both-browser run and failed 4 of 8 Chromium runs.
- **The three new specs (38 tests across both browsers):** all passed;
  `--repeat-each=10` gave 380 passed, 0 failed, 0 flaky.
- **Cross-revision checks:** `word-composition.spec.ts` at `6baa5e3` had 28 of
  28 compact tests fail on "outline is not clipped".
  `extended-scandicus-climacus.spec.ts` at `710aaf7` passed 8 of 8.
- **Not done:**
  - `note-modifiers` was not bisected; it is a timing race.
  - The intermittent failure was not reproduced in Firefox.
  - The exact commit that made the Firefox `scrollIntoView` failure in
    `selectNote` reachable was not identified.
  - No foreground-window or OS checks.

The new specs carry no `@smoke` tag, so the hosted smoke selection is unchanged.

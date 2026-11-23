# Stage 5B division implementation verification

Stage 5B implements the four divisions in the real editor. ADR 0013 is Accepted
with the owner's musical/linguistic independence clarifications. This record
is implementation evidence, not Stage 5C owner graphical acceptance.

For current verification and qualitative owner acceptance, see the separate
[Stage 5C record](stage-5c.md) and [owner checklist](owner-acceptance.md).
The results below remain historical Stage 5B evidence.

**The `browser-check.mjs` driver was retired in Playwright M2.1.** Its
scenarios now run in the Playwright specs listed under
[Playwright migration](#playwright-migration-m21). The commands below record
how earlier results were produced. The script is no longer in the working
tree; it is in git history, for example
`git show 0716ade:docs/verification/divisions/browser-check.mjs`.

## Automated checks

On 2026-11-02:

- `npm run format:check`: passed, including the repaired committed Stage 5B plan.
- `npm run lint`: passed without warnings.
- `npm test`: 48 files, 881 tests passed (including review regressions).
- `npm run build`: passed.
- `git diff --check`: passed.

`division-layout.test.ts` exercises both sides and all adjacent slots, stable
identities/anchors, four staff-relative glyphs, disjoint padded targets,
phrase-ending reservation, leading/trailing/division-only/empty music, bounded
long punctuation runs, oversized-syllable isolation, draft/history safety and
repeated toolbar intent after reanchoring. It verifies that punctuation blocks
contextual compaction without forcing hyphens: marks still require measured
continuing syllables, and melismas never invent syllables. Existing division-free
layout and semantic tests remain regression gates.

## Browser checks

Use Vite on port 5173 and fresh headless Chromium with debugging port 9230.
The development-only placement fixture mounts the actual StrictMode editor.
Run drivers sequentially within each browser; they share a tab.

```sh
node docs/verification/divisions/browser-check.mjs
node docs/verification/continuous-lyrics/browser-check.mjs
node docs/verification/lyric-move/browser-check.mjs
node docs/verification/vowel-alignment/browser-check.mjs
node docs/verification/lyric-spacing/browser-check.mjs
node docs/verification/word-composition/browser-check.mjs
CHANT_CORPUS=1 node docs/verification/word-composition/browser-check.mjs
```

All seven Chromium commands passed. The measured word corpus completed 47 cases
with no invariant errors. For Firefox, start a fresh initialized temporary
profile headless with `--remote-debugging-port 9234`, then run:

```sh
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session node docs/verification/divisions/browser-check.mjs
```

The Firefox division driver also passed. Both division runs check native pointer
caret/commit agreement on each side, explicit insertion buttons, persistent tools,
four shared ghost forms, selection/focus, kind replacement and surviving-ID
undo/redo, Delete/Backspace, native Tab, legal leading/adjacent/trailing/empty and
multi-system music, CSS zoom, 320px containment and exceptional local scrolling.
Dropdown choice dispatches a DOM change on the native select; this does not test
its operating-system popup. Pointer and keyboard actions use native CDP/BiDi
input. DOM/ARIA assertions do not verify spoken output.

Lyric-entry/move fixture collections were updated to the required Stage 5A
document shape. Vowel-alignment selectors now name their own fieldset instead
of selecting the new Divisions fieldset. Initial failures from outdated
fixtures/selectors were corrected and rerun. Division-driver narrow/oversized
pointer setup was corrected to reveal the viewport before native input.

A stronger Firefox surviving-ID history case exposed activeElement changes
without focus events in the background headless session. Presentation tracking
now also reconciles after explicit focus requests, division activation and key
release. It never changes semantic selection on Tab. These headless results
do not establish foreground window-focus behavior or screen-reader speech.

## Review and limits

Selected Chromium [desktop](desktop.png) and [320px](narrow.png) captures are
retained for review; other generated screenshots remain in temporary storage.
The score remains responsively scaled at 320px, so musical text/targets are
small, as in the existing editor. Controls wrap within the page. No product
font-size or score-zoom policy was added.

An arbitrarily long division run can exceed an otherwise empty normal system.
Only this exceptional punctuation case may continue with bars on a later system;
ordinary fitting phrase endings move with their preceding neume. This bounded
progress rule is documented in the layout guide. Finalis never forces a break.

Foreground keyboard/Tab/Shift+Tab and OS/browser zoom, foreground IME, spoken
screen-reader output, publication-quality proportion review and detailed
cross-browser owner graphical acceptance remain **Not run / Stage 5C**. CSS zoom
and headless accessibility assertions are not substitutes for those checks.
No division kind adds linguistic validation, automatic word splitting or warnings.

## PR #48 review: lyric/bar clearance

The review found horizontal overlap on both sides of a division. The measured
walker now positions/reserves bars after the active lyric's right extent, even
within a melisma, and constrains incoming word/continuation left extents against
the preceding bar. Neume and vowel anchors move together during placement;
semantic lyric data is unchanged. An oversized source's visual staff/canvas
includes its following bars, while subsequent music still wraps at the normal
logical width. Slots beside those bars remain usable after local scrolling.

The new pure word/continuation and melisma regression cases fail against the
previous PR head (8eff9fa) with negative horizontal clearance, and pass with the
fix. The browser driver measures actual SVG glyph/bar boxes at desktop/320px
for long preceding/following syllables, distinct words and continuations, and
checks native before/after insertion beside oversized lyrics. Existing ordinary
same-word gaps remain unchanged in the measured spacing driver. A previously
joined test pair had put text under the bar; it now receives a hyphen because its
corrected measured gap exceeds the existing threshold, without a semantic rule
forcing punctuation.

Review verification: format, lint, 881 unit tests, build and diff checks passed.
The expanded division driver passed in Chromium and Firefox at desktop/320px;
the existing measured lyric-spacing Chromium driver also passed. Foreground and
spoken-screen-reader limits above remain unchanged.

Selected review captures: [long preceding syllable](review-preceding.png) and
[long following syllable](review-following.png). Other new desktop/320px captures
remain in temporary storage.

## Playwright migration (M2.1)

Status: **retired.** The owner approved this crosswalk and removals A–F on
2026-11-23, and the driver was removed from the runner manifest and deleted.
Under the [M2 plan](../../plans/playwright-m2-migration.md), this crosswalk
maps each scenario of the former `browser-check.mjs` to the Playwright test
that now protects it. It supersedes the divisions rows of the
[M1 crosswalk](../playwright-m1/README.md#divisions-development-fixture).

Specs, all on the development fixture, in Chromium and Firefox:

- [`divisions.spec.ts`](../../../tests/e2e/divisions.spec.ts): placement,
  selection, editing and the Division menu.
- [`division-layout.spec.ts`](../../../tests/e2e/division-layout.spec.ts):
  score shapes, zoom, local overflow and the PR #48 clearance.
- [`focus-reveal.spec.ts`](../../../tests/e2e/focus-reveal.spec.ts):
  focus reveal below the sticky tools after native Tab.
- [`pointer-activation.spec.ts`](../../../tests/e2e/pointer-activation.spec.ts):
  lyric presses in the window-edge reveal margins.

### Crosswalk

"Legacy" gives the driver lines; the counts are tests per browser. Every
scenario the driver ran at both 1440px and 320px is ported at both widths.

| #   | Legacy scenario (lines)                                                                                                                                                                                         | Playwright                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pointer caret and commit before/after the bar at 1440px and 320px; lyric IDs kept; Punctum stays armed; Escape; Undo/Redo order (279–329)                                                                       | `divisions` › pointer placement, "places a punctum {side} a division at {width}px" (4). The caret is checked against the rendered bar ink and neighbour instead of the layout module's slot x (dropped item A). The preview's `pointer-events` check moves to row 6 (item B). Adds page containment at both widths.                                                                                                    |
| 2   | Insert Punctum before/after buttons, pointer click, both widths (330–337)                                                                                                                                       | `divisions` › explicit insertion, "pointer: Insert Punctum {side} division at {width}px" (4). The division is selected by native pointer click (the driver used script focus and Enter). Adds Undo.                                                                                                                                                                                                                    |
| 3   | Native Tab from the kind select to each Insert button; Enter inserts; Undo; Firefox Enter skipped (338–359)                                                                                                     | `divisions` › explicit insertion, "keyboard: Tab reaches … and Enter inserts it at {width}px" (4). **Firefox Enter is now activated and asserted**; the legacy BiDi skip no longer applies.                                                                                                                                                                                                                            |
| 4   | Pointer click focuses the bar; Finalis via the kind select (2 ink lines); Undo/Redo keep focus and kind; Delete; Undo restores the ID (360–389)                                                                 | `divisions` › selection, "pointer selects a division; kind change …" (2). Stronger: asserts selection (`aria-pressed`), not only focus, plus the ink count after Undo and the restored kind. The legacy role check (line 445) is asserted here. `selectOption`, like the driver's DOM `change`, does not open the native popup.                                                                                        |
| 5   | Tab note → division → note keeps the selection; Backspace deletes the focused bar (390–408)                                                                                                                     | `divisions` › selection, "keyboard: Tab traverses …" (2). Adds Shift+Tab and Undo.                                                                                                                                                                                                                                                                                                                                     |
| 6   | Division menu arms each of the four kinds; ghost ink line count; preview has no tab stops; commit leaves Punctum unarmed; Escape; seven items; division role; Insert still names Punctum; containment (409–462) | `divisions` › Division menu, "places all four kinds …" (2). Native clicks on the arrow and the menu items (the driver used DOM `click()`), hovering past the last item instead of at the fixed score point (450, 100). Stronger: the armed kind persists after the commit, Escape disarms, and the four inserted kinds are exact. The preview is shown not to be the hit-test target at the pointer (replaces item B). |
| 7   | Leading and adjacent bars, a trailing finalis, with 0, 1 and 20 neumes at 320px; every bar focusable (463–481)                                                                                                  | `division-layout` › "leading, adjacent and trailing divisions …" (3). Adds an explicit check that the 20-neume score has several systems, and page containment.                                                                                                                                                                                                                                                        |
| 8   | A focused bar keeps focus under 150% CSS zoom on a 40-neume score with outgoing marks (482–496)                                                                                                                 | `division-layout` › "a focused division keeps focus when 150% CSS zoom …" (1). Adds a check that the zoom actually re-scaled the rendered bar.                                                                                                                                                                                                                                                                         |
| 9   | Oversized lyric: the score viewport scrolls, the page does not, and a pointer click focuses the bar (497–512)                                                                                                   | `division-layout` › "an oversized lyric scrolls the score locally …" (1). Playwright scrolls the score viewport natively before clicking (the driver scrolled by script). Stronger: asserts selection too.                                                                                                                                                                                                             |
| 10  | PR #48 clearance: lyric glyph extents ≥ 15.9 units from both bar edges, word and continuation, 4 length pairs, 1440px and 320px; containment; order (513–551)                                                   | `division-layout` › "lyrics clear a division by 16 units …" (16). Same `getBBox` measurement and threshold. Adds a guard that at least one lyric shares the bar's system, so no case passes without measuring.                                                                                                                                                                                                         |
| 11  | Explicit insertion sides beside an oversized lyric's extended staff, both widths (552–581)                                                                                                                      | `divisions` › pointer placement, "… beside an oversized lyric at {width}px" (4). The caret must be on the bar's system and past its ink on the chosen side. It is bounded by the neighbour only when the neighbour shares the system, because with an oversized syllable `n1` begins the next system (item A). The committed order is asserted as before.                                                              |
| 12  | Division menu keyboard: primary arms Minima; End and Enter choose Finalis and return focus to the arrow; Escape closes; the primary is remembered after Finalis; no empty Divisions group (582–630)             | `divisions` › Division menu, "keyboard: End and Enter choose Finalis …" (1). Adds that reopening after a menu choice focuses Finalis (menu memory) and that Escape on the arrow disarms. Uses a 2-neume score instead of 100 (item D).                                                                                                                                                                                 |
| 13  | Native Tab and Shift+Tab reveal a note covered by the sticky tools (≥ 7 px clear) without changing the selection (631–659)                                                                                      | `focus-reveal` › "native {Tab, Shift+Tab} reveals a note covered by the sticky tools …" (2). Adds a precondition that the note starts covered.                                                                                                                                                                                                                                                                         |
| 14  | Native Tab to a visible note does not scroll (660–675)                                                                                                                                                          | `focus-reveal` › "native Tab to a visible note does not scroll" (1).                                                                                                                                                                                                                                                                                                                                                   |
| 15  | Pointer press on a small lyric 2 px inside the bottom and top reveal margins of a 700px window: no scroll before release; the click selects the lyric (676–757)                                                 | `pointer-activation` › "a lyric press inside the {bottom, top} reveal margin …" (2). Same geometry and preconditions. Adds that the press focuses the lyric. The 120 ms press is replaced by two animation frames (item E).                                                                                                                                                                                            |

### Proposed removals

Each item is a legacy check that is not reproduced as written. None of them
removes protection of a documented behaviour:

- **A. The caret equals the layout module's slot x** (rows 1 and 11). The
  driver imported `src/editor/layout/layout-chant.ts` into the page and
  compared the caret's `x1` attribute to a slot computed in the page. That
  ties the browser test to an internal layout API. The slot and caret
  computation is pure and already covered by Vitest:
  `division-layout.test.ts` ("pointer caret and commit agree on the left and
  right side", leading/adjacent/trailing slots) and
  `graphical-placement-preview.test.ts`. The browser tests keep the
  user-visible contract from the
  [interaction guide](../../editor-interactions.md#stage-5b-division-controls):
  a caret between the bar and the neighbour on the hovered side, and a commit
  into that slot.
- **B. The preview carries `pointer-events="none"`** (row 1). The driver
  read this attribute after the commit, when the preview may already be
  gone, and its fallback was `'none'`, so the check could pass without a
  preview. Replaced in row 6 with behavioural checks taken while the preview
  is shown: it has no tab stops, and the element hit-tested at the pointer is
  not inside it.
- **C. Review screenshots** (`four-kinds-*`, `leading-trailing-*`,
  `outgoing-zoom`, `oversized-scrolled`, `review-*`). These were captured for
  human review, not asserted. Playwright keeps failure screenshots and
  traces. Visual baselines are excluded from M2.
- **D. Incidental fixture sizes.** The 100-neume score in the
  menu-keyboard step (row 12) and the fixed score point (450, 100) (row 6)
  did not bear on the asserted behaviour.
- **E. The fixed 120 ms press duration** (row 15). The reveal it guarded
  against is scheduled with `requestAnimationFrame` from `focusin`
  (`ScoreSvg`), so two frames after the press bound it without a fixed sleep.
  The release still follows the press as a separate native input.
- **F. Transport.** CDP/BiDi plumbing, endpoint discovery and the Firefox
  Enter skip.

### Findings while porting

- **Firefox does not scroll the score viewport for an SVG group.** With an
  oversized lyric, `scrollIntoView({ inline: 'center' })` on a division left
  it off screen in Playwright Firefox. The driver centred `.score-viewport`
  explicitly, and the shared `revealCentered` helper now does the same. This
  only affects test setup: native clicks through Playwright scroll correctly,
  and the product's own reveal scrolls containers explicitly.
- **Chromium `boundingBox()` versus `getBoundingClientRect()`.** For a note's
  SVG hit target, Playwright's `boundingBox()` in Chromium returned a top
  1.5 px higher than `getBoundingClientRect()`. The app's reveal uses the
  latter (gap 7.79 px), and the first draft of row 13 failed with the former
  (6.29 px). The spec measures with `getBoundingClientRect()`, as the driver
  did. This is not a product defect.
- **No product defect found.** No assertion is marked `test.fail()`.

### Results (2026-11-23)

Implementation commit `4b3ff7d` with a clean tree. Linux x64, Node 24.12.0,
Playwright 1.65.1 (Chromium `chromium-1255`, Firefox 159.0 `firefox-1572`).
The runner used installed Chromium 157.0.8103.38 and Firefox 146.0.

| Check                                                                                                                 | Result                                            |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Legacy `npm run verify:browser -- --driver divisions --browser both -j 2`                                             | Chromium passed (37.5 s), Firefox passed (39.5 s) |
| `npm run test:e2e` (all specs, both browsers)                                                                         | 132 passed (38.0 s)                               |
| `npm run test:e2e -- divisions division-layout focus-reveal pointer-activation --repeat-each=10`                      | 1,220 passed, 0 flaky, 0 failed (5.6 min)         |
| Negative control: the same specs against `0a46178` (master before the #121 fix), in a temporary worktree              | 29 failed, 93 passed (details below)              |
| `format:check`, `lint`, `test` (118 files / 2,703 tests), `build` (including `tsconfig.e2e.json`), `git diff --check` | All passed                                        |

Legacy run directory: `.verification-runs/run-2026-11-23T07-40-49-427Z-AYYfQ9/`
(ignored, not committed).

The negative control found what the driver missed. Every test that needs a
pointer click to select a division failed in both browsers on the pre-#121
revision: rows 2, 4 and 9, and the #121 tests in `pointer-activation`. The
legacy driver passed on that same revision, because it asserted only focus
after its click. The edge-margin lyric presses (row 15) passed there, which
matches the earlier PR #107 fix. The worktree was removed afterwards.

Not run: hosted CI, WebKit, and foreground window focus, OS zoom, native
popups and screen readers (as in M1).

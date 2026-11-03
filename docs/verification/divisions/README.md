# Stage 5B division implementation verification

Stage 5B implements the four divisions in the real editor. ADR 0013 is Accepted
with the owner's musical/linguistic independence clarifications. This record
is implementation evidence, not Stage 5C owner graphical acceptance.

For current verification and qualitative owner acceptance, see the separate
[Stage 5C record](stage-5c.md) and [owner checklist](owner-acceptance.md).
The results below remain historical Stage 5B evidence.

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

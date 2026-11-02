# Stage 5B division implementation verification

Stage 5B implements the four divisions in the real editor. ADR 0013 is Accepted
with the owner's musical/linguistic independence clarifications. This record
is implementation evidence, not Stage 5C owner graphical acceptance.

## Automated checks

On 2026-11-02:

- `npm run format:check`: passed, including the repaired committed Stage 5B plan.
- `npm run lint`: passed without warnings.
- `npm test`: 48 files, 878 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

`division-layout.test.ts` exercises both sides and all adjacent slots, stable
identities/anchors, four staff-relative glyphs, disjoint padded targets,
phrase-ending reservation, leading/trailing/division-only/empty music, bounded
long punctuation runs, oversized-syllable isolation, draft/history safety and
repeated toolbar intent after reanchoring. It verifies that punctuation blocks
contextual compaction without forcing hyphens: measured adjoining continuing
syllables still have no mark, and melismas never invent syllables. Existing
division-free layout and semantic tests remain regression gates.

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

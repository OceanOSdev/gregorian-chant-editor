# Stage 1 lyric anchors

Verified with headless Chromium against `npm run dev` on 2026-10-29 using the
real React editor and the existing development fixture mount. The dependency-free
`browser-check.mjs` connects to Chromium DevTools on port 9230 and Vite on 5173.

Verified:

- Contextual Punctum insertion into a completely empty, lyricless document.
- Selecting music and adding an anchored syllable through the native text field.
- Disabling Add on an occupied anchor, preserving its existing lyric.
- Inserting subsequent music without creating or moving lyrics.
- Selecting and deleting an anchored Punctum removes its lyric.
- Undo restores both music and lyric; redo removes them atomically.
- No document horizontal overflow at a 320 px viewport.

The script exercises DOM events and DevTools text insertion. It is not a spoken
screen-reader verification, screenshot review, or exhaustive all-kind browser test.
Pure suites cover all-kind geometry/normalization, anchor rules, placement boundaries,
and history. Earlier verification folders describe historical UX and their old
fixtures are not a migration adapter for this model.

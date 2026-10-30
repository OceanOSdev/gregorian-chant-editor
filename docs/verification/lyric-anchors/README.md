# Stage 1 lyric anchors

Historical Stage 1 verification record. Stage 2 replaced the `#new-syllable`
field and Add button used by `browser-check.mjs` with continuous entry through
`#lyric-input`. The driver is retained as a compact scenario inventory, but is
not a runnable current regression check. Its initial lyricless fixture is still
valid; its UI steps need adaptation. No assertions were removed.

Use the [Stage 2 browser driver](../continuous-lyrics/README.md) for current
anchored creation, occupied protection, lyric history and input behavior.
`lyric-anchors.test.ts` retains semantic anchor deletion and restoration coverage;
the Stage 2 browser driver is not a complete replacement for this script's
music-deletion scenario. Porting that scenario is a separate follow-up.

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

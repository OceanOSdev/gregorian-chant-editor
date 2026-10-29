# Continuous lyric entry (Stage 2)

Verified against the real StrictMode React editor with Chromium DevTools and the
Vite development server. Run `npm run dev`, start Chromium with remote debugging
on port 9230, then run:

```sh
node docs/verification/continuous-lyrics/browser-check.mjs
```

The script mounts semantic fixtures through the existing development-only fixture
page on port 5173. It verifies native input and browser event handling:

- Scoped L activation; consecutive minus, Space, and underscore entry.
- Occupied-anchor pauses, underscore skipping, and protection against replacement.
- Greek text and commit-on-click without leaving Lyrics mode.
- Native Tab traversal with the draft retained; invalid navigation retains text.
- Escape cancellation, deliberate replacement, and replacement caret behavior.
- End-of-music resumption after contextual music insertion.
- Save/Discard/Cancel history UI (Save and Cancel exercised in browser; all choices
  covered by pure reducer tests), including redo of the saved syllable.
- Composition and delimiter autorepeat guards; rejection of pasted passages.
- Dirty target deletion, preserved recovery text, and retry at a free neume.
- Stable native input DOM identity across target changes.
- No horizontal page overflow and input bounds inside a 320 px viewport.

The script saves [desktop](desktop.png) and [mobile](mobile.png) screenshots.
It uses DevTools keyboard/text input and synthetic events for focused edge cases;
it is not a spoken screen-reader verification or exhaustive OS/IME compatibility
check. Plain TypeScript tests cover semantic transitions and invariant preservation.
No browser testing dependency was added.

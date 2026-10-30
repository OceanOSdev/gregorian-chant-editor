# Continuous lyric entry (Stage 2)

Verified against the real StrictMode React editor with Chromium DevTools and the
Vite development server. Run `npm run dev`, start Chromium with remote debugging
on port 9230, then run:

```sh
node docs/verification/continuous-lyrics/browser-check.mjs
```

The script mounts semantic fixtures through the existing development-only fixture
page on port 5173. It verifies native input and browser event handling:

- Keyboard-only Tab → Delete/Backspace on engraved lyrics, without mouse
  selection, Space, or programmatic focus. Deletion uses the focused lyric even
  when a different syllable remains selected.
- Minus from selected lyrics outside Lyrics mode opens continuation insertion;
  the occupied-anchor case pauses without replacing text.
- Unchanged lyric ink and no underline in selected state; a purple dashed
  selection outline and separate labeled blue keyboard-focus marker. See [keyboard selection](keyboard-selection.png).
- L targets the focused engraved syllable with no selection, a different selection,
  or that same lyric selected. Activation preserves selection/history/anchors and
  pauses rather than overwriting existing lyrics; native input l remains text.
- Scoped L activation; consecutive minus, Space, and underscore entry.
- Occupied-anchor pauses, underscore skipping, and protection against replacement.
- Greek text and commit-on-click without leaving Lyrics mode.
- Native Tab traversal with the draft retained; invalid navigation retains text.
- Escape cancellation, single-click selection without editing, deliberate replacement,
  and normal collapsed cursors for Enter and real double-click editing.
- Delete, Backspace and Delete syllable button with Lyrics both active and inactive:
  music/IDs unchanged, focus and selection on the former anchor, no empty input,
  atomic undo/redo, and protection against destructive autorepeat on the focused note.
- Native Backspace/Delete inside the input change characters without deleting lyrics.
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

## Focus versus selection

`browser-check.mjs` also checks click selection on Al → Tab/Shift+Tab to le:
selection and history stay unchanged, the panel identifies both targets, and
Delete/Backspace removes le. The explicitly labeled Delete selected syllable
button removes Al instead. The focus summary clears when focus leaves engraved
lyrics. See [Chromium feedback](focus-vs-selection.png).

The Chromium checks use the configured `CHANT_EDITOR_URL` if Vite runs
on a port other than 5173.

Firefox automation was attempted with native WebDriver BiDi actions, but this
environment reported `document.hasFocus() === false` and emitted no focus events,
even while `activeElement` changed. That run is not counted as visual or focus
verification. Recheck manually in a foreground Firefox window: click Al, Tab to
le, confirm the panel names both roles, Shift+Tab back, then Tab to le and delete.
The selected-syllable button should instead delete Al after focus moves to it.

Focus/selection feedback does not synchronize selection with focus or change
command targets. Space inside a lyric input remains a word delimiter. Browser
checks are not a spoken screen-reader verification.

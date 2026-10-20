# Syllable entry verification

The [browser script](browser-check.mjs) exercises the actual StrictMode editor
using the existing development fixture and dependency-free Chrome DevTools
Protocol. Run Vite and Chromium with remote debugging port 9250, then run:

```sh
node docs/verification/syllables/browser-check.mjs
```

`CHANT_EDITOR_URL` and `CHANT_CHROME_URL` override the local defaults.
[Recorded results](browser-results.json) identify the browser and checks.

Verified with native pointer, text insertion, Enter, Escape, Tab and modifier
keyboard events:

- Type the next syllable before clicking Add: existing text stays unchanged.
- Add and Enter create equivalent atomic additions, clear the draft, keep input
  focus and activate the new target. Blank additions are rejected.
- Input Undo remains local; semantic creation and text editing undo/redo use
  the existing history controls.
- Select an existing syllable, edit its populated text, Save/Enter or
  Cancel/Escape, and return focus to its stable strip button. Cancel creates
  no history. Text edits retain the original note ID and target ID.
- Target switching and creation never blur-save an edit; creation drafts survive
  editing. Graphical insertion still targets the active syllable.
- At 320 px, 25 consecutive additions each retain cleared-input focus and reveal
  the active button. The strip moves only enough to reveal its right edge, with
  4 px padding. Window, root and score scroll offsets stay unchanged.
- Exactly one strip button is tabbable. Native Tab/Shift+Tab enter and leave in
  one step; Left/Right (including wrapping) and Home/End move focus without
  changing the active target. Native Enter/Space activates and edits. Modified
  or composing navigation keys are ignored. Offscreen activation reveals its
  button within the strip.
- Reselecting `Ky` while its draft is `Kyr` preserves the draft and focuses the
  editor. Escape still cancels it without changing saved text.
- Save/Cancel are reached with native Tab. At 390 px and 320 px the page has no
  horizontal overflow. Eighty syllables stay in a horizontally scrollable strip.
- Synthetic composing key events check the Enter guards in both inputs.

Screenshots:

| State                  | Desktop                             | 390 px                         | 320 px                         |
| ---------------------- | ----------------------------------- | ------------------------------ | ------------------------------ |
| New syllable draft     | [Desktop](new-syllable-desktop.png) | [390 px](new-syllable-390.png) | [320 px](new-syllable-320.png) |
| Existing syllable edit | [Desktop](editing-desktop.png)      | [390 px](editing-390.png)      | [320 px](editing-320.png)      |

Additional 320 px revision screenshots:

- [25 additions with the last target revealed](long-entry-320.png)
- [Roving keyboard focus in the long strip](roving-focus-320.png)
- [Draft preserved after reselection](reselected-draft-320.png)

These checks do not replace testing with a physical IME or spoken screen reader.
The semantic regression tests separately assert exact history restoration,
unchanged neume references, stable IDs and selection reconciliation. No browser
or test dependencies were added.

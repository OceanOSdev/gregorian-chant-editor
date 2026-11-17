# Score focus reparenting verification (readability M2)

The [interaction guide](../../editor-interactions.md#focus) owns the focus
contract. The [M2 plan](../../plans/editor-readability-m2.md) owns scope. M2
moved note and lyric controls into `NeumeControl` and `LyricControl`. Focus
restoration still depends on the score's note-registration callback. React
calls it on every ref swap, and when it detaches a note, including before it
reparents one. No routine driver covered that path in either browser, so this
one does.

## Driver

`browser-check.mjs` (runner ID `score-focus-reparenting`, production preview,
Chromium CDP and Firefox BiDi, clears test-origin storage) imports the bundled
Dominican Salve Regina at 1440×1100. It waits for measured layout to settle,
then dispatches FontFaceSet `loading`/`loadingdone` events to force the real
lyric-measurement fallback and back, as `lyric-spacing` does. It checks:

1. The fallback layout moves notes and lyrics into a different system group,
   and `loadingdone` restores the measured layout.
2. A note reached by trusted Tab keeps browser focus, by note ID, through both
   reparents. It also returns to its original system.
3. A note focused by script `focus()` does the same. This leaves that note
   (`notes[1]`) as the score's last tracked focus target.
4. A lyric reached by trusted Tab: preconditions are strict in both browsers.
   The lyric must be focused before reflow, must move to another system, and
   must return. In Chromium the lyric must also keep focus. Firefox is covered
   by the known behavior below.
5. Focus on a palette button outside the score is not taken by either reflow.
   The case where focus rests on `<body>` while a stale control is tracked is
   not covered.

The driver also logs the `focusin` targets a document listener sees and the
actual active element after each lyric reflow, as evidence rather than
assertions.

### Known baseline behavior: headless Firefox lyric focus (not an M2 regression)

Observed with this driver on 2026-11-17, identically on the M2 branch and on
the exact base `9b9d2af`:

- The `focusin` listener recorded **no events at all** in headless Firefox. It
  recorded none while reaching the lyric by script focus plus trusted Tab, and
  none for a script-focused HTML palette button. Chromium recorded each target.
- After the fallback reflow, the active element was **not** the lyric and
  **not** `<body>`. It was the note `notes[1]` from step 3. It remained there
  after the measured return. Focus was **redirected**, not lost.

The likely mechanism is inferred from the code and not proven. The tracker
never learned that the lyric was focused, so it still pointed at `notes[1]`.
That note was also reparented, and the restore effect refocused it by ID.
Because no `focusin` was seen even for an HTML button, the missing events look
like a headless/no-window-focus property of this session rather than something
specific to SVG. Headed Firefox with real window focus has **not** been checked.
It may not show the symptom.

In Firefox the driver tolerates exactly that outcome: the active element is the
`g` for `notes[1]` after both reflows. Any other outcome fails. Preconditions,
protocol errors and every other assertion propagate normally. If the lyric
keeps focus, the check passes and prints a note asking for it to be made strict.

This is a candidate for a focused fix after M2, for example a lyric detachment
record or clearing a stale tracked note. M2 deliberately does not change it.

### Negative and mutation checks (2026-11-17)

Each change was applied temporarily and then reverted:

- Removing the focused-note record from `registerNoteElement` in `ScoreSvg.tsx`
  failed Firefox at "Tab-focused note: focus survives fallback reparent".
  Chromium still passed. In this headless Firefox session the record is the
  only path that restores focus to a note.
- Changing the tolerated lyric outcome to a different note (`notes[0]`) failed
  Firefox at "Firefox lyric: only the baseline redirection to notes[1] is
  tolerated". This shows that unexpected outcomes are not swallowed.

## Results (2026-11-17)

Linux, Node 24.12.0, Chromium 157.0.8103.38, Firefox 146.0.

- M2 branch: Chromium passed, including the strict lyric check. Firefox passed
  and reported the known lyric redirection.
- Exact base `9b9d2af` (driver copied into a base worktree): identical outcomes
  and identical diagnostic output.

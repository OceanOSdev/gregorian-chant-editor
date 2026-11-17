# Score focus reparenting verification (readability M2)

The [interaction guide](../../editor-interactions.md#focus) owns the focus
contract. The [M2 plan](../../plans/editor-readability-m2.md) owns scope. M2
moved note and lyric controls into `NeumeControl` and `LyricControl`. Focus
restoration still depends on the score's note-registration callback, which
runs when React detaches a note before reparenting it. No routine driver
covered that path in either browser, so this one does.

## Driver

`browser-check.mjs` (runner ID `score-focus-reparenting`, production preview,
Chromium CDP and Firefox BiDi, clears test-origin storage) imports the bundled
Dominican Salve Regina at 1440×1100. It waits for measured layout to settle
and dispatches FontFaceSet `loading`/`loadingdone` events to force the real
lyric-measurement fallback and back, as `lyric-spacing` does. It checks that:

1. The fallback layout moves notes and lyrics into a different system group,
   and `loadingdone` restores the measured layout.
2. A note reached by trusted Tab keeps browser focus, by note ID, through both
   reparents. It also returns to its original system.
3. A note focused by script `focus()` does the same.
4. A lyric reached by trusted Tab does the same. This is asserted in Chromium
   only; see the known defect below.
5. Focus on a palette button outside the score is not taken by either reflow.

### Mutation check (2026-11-17)

Removing the focused-note record from `registerNoteElement` in `ScoreSvg.tsx`
failed Firefox at "Tab-focused note: focus survives fallback reparent".
Chromium still passed because its `focusin` tracker covers the case. The
source was then restored. The check shows that in headless Firefox, neither
script focus nor native Tab to an SVG control reaches the score's `focusin`
tracker. The detachment record is the only restoration path there.

### Known baseline defect: Firefox lyric focus (not an M2 regression)

In Firefox, a Tab-focused lyric loses focus (the active element is no longer a
syllable) when the fallback reflow reparents it. The same failure occurs on the
exact M2 base `9b9d2af` with this driver, so it predates M2. Lyrics have no
detachment record like notes. Firefox reports the result as
`KNOWN BASELINE DEFECT` and does not fail. If it starts passing, the driver
prints a note asking for the check to be made strict. Fixing it would change
behavior, which is outside M2 scope, so the owner decides.

## Results (2026-11-17)

Linux, Node 24.12.0, Chromium 157.0.8103.38, Firefox 146.0.

- M2 branch: Chromium passed. Firefox passed with the known lyric defect
  reported.
- Exact base `9b9d2af` (driver copied into a base worktree): same outcomes.
  Before the Firefox lyric step was changed to report-only, it failed there
  with the same assertion.

# Editor toolbar verification (readability M1)

The [interaction guide](../../editor-interactions.md#palette-and-action-bar-ownership)
owns the behavior; the [M1 plan](../../plans/editor-readability-m1.md) owns
scope. M1 is a behavior-preserving ownership refactor, so this driver checks
contracts that no earlier driver covered, and passes unchanged on the clean
base `917137c` as well as on the branch.

## Driver

`browser-check.mjs` (runner id `editor-toolbar`, production preview, Chromium
CDP and Firefox BiDi, clears test-origin storage) checks:

1. One roving palette stop; Arrow/Home/End browsing and wrapping move focus
   without arming a tool.
2. The Division menu opens at the remembered kind after a variant choice.
3. **New** and **Import** reset the roving stop to Select and the remembered
   Division kind to Minima. Arrow browsing still works afterwards, so the
   palette's button refs are live.
4. `T` from a focused note focuses the remembered tool (Punctum, then
   `podatus-menu` after arming Epiphonus) without changing selection. A
   following Arrow key is not undone by a re-handled request, so the palette
   focus request was acknowledged once.
5. The Quilisma figure select arms the Quilisma tool and keeps the figure.
6. Action bar: Copy and Paste are disabled or labelled correctly when the
   clipboard is empty; a keyboard passage range describes Lyrics/Insert; and
   Copy, Paste, Undo and Redo buttons change the score as expected.
7. Sticky toolbar `data-too-tall` matches its measured height against half the
   viewport at 1440×1100, 320×1100, 320×500 (fallback to `static`) and 150%
   CSS zoom.

Recovery **reload** shares the same `resetPresentationState` path as New and
Import, but the driver does not provoke a storage conflict to reach it.

A mutation check removed the palette `reset()` call. The driver then failed
with “New: roving stop returns to Select”, and the call was restored.

## Results (2026-11-17)

Linux, Node 24.12.0, Chromium 157.0.8103.38, Firefox 146.0.

- Branch working tree: Chromium 13.7 s and Firefox 15.3 s, both passed
  (`run-2026-11-17T06-06-56-731Z-posZSH`).
- Clean base `917137c`, with only this driver and its manifest entry copied
  in: both passed (`run-2026-11-17T06-09-48-829Z-kFzZXx`). The sticky
  measurements are identical (Chromium 238/468/468/354 px; Firefox
  246/476/476/357 px).

The full-matrix comparison is recorded in the M1 pull request.

# Stage 4A vowel alignment verification

Run Vite (`npm run dev`) and Chromium with debugging port 9230, then run:

```sh
node docs/verification/vowel-alignment/browser-check.mjs
```

The driver mounts the real StrictMode React editor through the existing
development fixture, uses native DevTools keyboard/pointer input, and writes
screenshots to a new system temporary directory. No browser dependency was added.

## Actual results, 2026-11-01

Chromium checks passed for:

- Explicit Latin default and keyboard language changes; one-step undo/redo
  restores language and derived positions without changing musical SVG geometry.
- Latin `Ky`, `ri`, `e`, `lé`, `son`, `au`, `qui`, `æ`. Independent SVG
  character-position/substring measurements check each nucleus center against
  its musical anchor within 0.05 layout units.
- Whole-string baseline comparison (`und`) and manual whole/single-grapheme
  selection, keyboard range editing, Reset to automatic and exact undo/redo.
- Native Tab visits `ri` while `Ky` remains selected. Alignment controls
  explicitly act on selected `Ky` independently of engraved keyboard focus.
- A dirty text draft and target survive language changes without saving;
  manual controls cannot edit an active text draft. Changing text resets a
  manual override; one undo restores the authored range.
- Polytonic Greek with a combining mark exposes two graphemes, with a single
  option for the final segment after choosing its start.
- Multiple systems and 320px viewport: stable musical geometry, keyboard range
  controls, no page horizontal overflow.

The existing Stage 3 `lyric-move/browser-check.mjs` also passed actual pointer,
keyboard, rejection, history, draft, focus, multi-system and narrow checks.

Observed whole-text midpoint positions (the existing anchors remain unchanged):

| Text | Whole-string baseline x | Latin aligned x |
| ---- | ----------------------- | --------------- |
| Ky   | 230                     | 222.7734375     |
| ri   | 275                     | 271.6640625     |
| e    | 320                     | 320             |
| lé   | 365                     | 362.21875       |
| son  | 410                     | 411.1015625     |
| au   | 455                     | 455             |
| qui  | 500                     | 490             |
| æ    | 545                     | 545             |

Desktop Latin automatic/baseline and narrow Greek screenshots were visually
inspected. The diagnostics include `latin-automatic.png`,
`whole-string-baseline.png`, `manual-whole-Ky.png`, `manual-controls.png`,
`narrow-greek-manual.png`, `narrow-manual-controls.png`, and
`narrow-latin-manual.png`. Generated files stay outside Git; the driver prints
their actual temporary directory for each run.

## Limits

This is headless Chromium verification, not foreground Firefox or a spoken
screen-reader test. Those checks were not run. Font advances depend on the
installed Georgia / Times New Roman / serif fallback; no external font was
introduced. Initial unavailable measurements use whole-string centering until
fonts are ready. The alignment center is a typographic advance center, not an
optical ink centroid. Conservative language rules can fall back to whole text;
manual ranges remain available. At 320px the existing fixed-width score scales
down, so lyrics remain small. Lyric collisions/clearance and hyphens are pending
4B/4C; no lyric-driven musical movement or reflow is implemented here.

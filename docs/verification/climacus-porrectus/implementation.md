# Climacus and Porrectus implementation verification

Implemented from the approved silhouette recipes and final interaction
refinement. ADR 0007 remains **Proposed** pending implementation review.
No PR has been opened. No notation font, dependency, semantic document field,
command/history behavior, clef change or additional neume was introduced.

## Integrated screenshots

The review score was built through the editor's insertion and editing controls.
It begins with Punctum, Podatus, Clivis, Scandicus and Torculus, followed by
Climacus and Porrectus in this interval order for each kind:
(1,1), (1,2), (2,1), (2,2), (1,3), (3,1), (2,4), (4,2), (5,5), (6,2).
The final pair is a project extrapolation. Climacus's wider spacing plateaus
remain project-specific optical decisions, not independently verified
GregorioTeX layout rules. Complete fixture IDs and pitches are in the
[browser results](implemented-browser-results.json).

| Screenshot                                                                                     | Viewport | Contents                                                         |
| ---------------------------------------------------------------------------------------------- | -------: | ---------------------------------------------------------------- |
| [Desktop](implemented-desktop.png)                                                             |  1100 px | Full score with the five existing kinds and all 20 new specimens |
| [Normal](implemented-normal.png)                                                               |   760 px | Score near native 720-unit scale                                 |
| [Responsive](implemented-responsive.png)                                                       |   430 px | Same semantic score and system breaks, scaled SVG                |
| [Climacus focus + selection](implemented-climacus-focus-selection.png)                         |   760 px | Blue padded polygon and independent red diamond contour          |
| [Climacus responsive focus + selection](implemented-climacus-focus-selection-responsive.png)   |   430 px | Same feedback at reduced scale                                   |
| [Porrectus focus + selection](implemented-porrectus-focus-selection.png)                       |   760 px | Lower ribbon toe selected; no invented square head               |
| [Porrectus responsive focus + selection](implemented-porrectus-focus-selection-responsive.png) |   430 px | Same toe control at reduced scale                                |
| [DPR 2 focus](implemented-focus-dpr2.png)                                                      |   760 px | Polygonal focus and selected contour at device scale 2           |
| [Climacus preview](implemented-climacus-preview.png)                                           |   760 px | Actual 50% opacity placement preview                             |
| [Climacus responsive preview](implemented-climacus-preview-responsive.png)                     |   430 px | Same hypothetical geometry at reduced scale                      |
| [Porrectus preview](implemented-porrectus-preview.png)                                         |   760 px | Actual continuous-ribbon placement preview                       |
| [Porrectus responsive preview](implemented-porrectus-preview-responsive.png)                   |   430 px | Same hypothetical geometry at reduced scale                      |

Normal, responsive, focus/selection and preview screenshots were visually
inspected. Extreme intervals intentionally extend outside the four-line staff;
the existing fixed vertical-system and lyric-collision limitations remain.
No ledger lines or vertical layout policy has been added.

## Geometry and rendering changes

`neume-geometry.ts` now builds Climacus as one traced Virga plus two disconnected
oblique diamonds, and Porrectus as a single traced ribbon/queue/terminal path.
The black contours, selection contours, nominal anchors, spacing, painted bounds,
advances and lyric axes match the approved independent specimen recipes.
Porrectus retains three semantic notes; the first two select ribbon regions.
The first target's top is fixed at local y=−14 and is independent of terminal
height. The previous five engraving branches retain their exact constructions.

`NoteGeometry` adds only optional `hitShape?: InkShape`. Climacus derives the
approved padded, half-plane-clipped diamond targets; `hitBounds` encloses each
path. The first Virga target is also supplied as its approved rectangular path.
Porrectus retains its approved three rectangular target regions.

`ScoreSvg` renders the supplied hit shape with rectangular fallback through
`InkShapeView`. Target children are inside an aria-hidden group, have no role or
tabindex, and retain one named, focusable parent control per semantic note.
The current focus CSS styles the actual target: blue polygon for Climacus,
blue rectangle for Porrectus. Selection remains an independent red contour.
No extra focus rectangle or CSS redesign was added.

New targets inherit explicit `pointer-events: fill` from their hidden wrapper,
so focus strokes do not expand pointer ownership. During placement that wrapper
explicitly switches to `none`; a child's explicit fill behavior must not
re-enable an otherwise disabled parent. Existing target behavior is retained
for the five earlier kinds.

`layout-chant.ts`, `NeumeInk.tsx`, the semantic model, editing commands,
selection/history state and accessible-label helpers did not need changes.
All kinds now use a six-unit first bearing, keeping the system's first nominal
pitch anchor at x=230. Whole-neume spacing remains painted width +33 and
wrapping still uses the existing shared sequence walker.

## Browser evidence

Checks used Chromium against the actual Vite editor, with real pointer clicks
and keyboard events. They are distinct from the static planning specimen tests.
See [integrated results](implemented-browser-results.json) and
[exact-fit reflow results](implemented-reflow-results.json).

- All five preceding kinds matched 120 pre-change geometry baseline cases
  exactly, including their ink, head contours, bounds, anchors and targets.
- Across 196 line/space/interval geometries, all 1,274 actual SVG ink,
  selection and hit-path bounds matched declarations within 0.001 units.
- 142,163 sampled painted points retained the intended constituent ownership,
  including the Virga queue, separate diamond tips, Porrectus sweep and toe.
- 160 raster samples at scales 1, 0.75, 0.55 and 0.5 with fractional placement
  and 50% opacity retained each intended component without additional fragments
  or dark compositing overlaps. Climacus components were checked separately;
  semantic unity does not require connected paint.
- All 20 integrated new specimens matched independently expected geometry.
  120 actual note clicks at 1100/430-pixel viewports selected the expected note.
  Space, Tab order and the exact selected-note contours also passed.
- Climacus middle-note `:focus-visible` used the path target with computed
  `pointer-events: fill`; blue focus and red selection appeared together.
  At 2,701 focus-stroke sample positions, removing the stroke caused zero
  changes in browser pointer ownership.
- The accessibility tree exposed exactly 71 named note buttons: 11 notes in
  the five preceding control neumes plus 60 in the 20 new neumes. Decorative
  targets and selection paths created no additional controls.
- Individual and whole-neume movement, rejected Porrectus equal-outer edits,
  normalization, Delete/Backspace, stable IDs, focus and undo/redo passed.
- Both placement tools disabled targets and Tab stops, guarded editing keys,
  restored controls after Escape, and produced preview ink identical to
  committed ink at normal/responsive sizes. Commit focused the inserted first
  note. The pure suite additionally compares the complete geometry including
  hit shapes, prospective height and reflowed position.
- Exact-fit fixtures place each new kind's final edge at x=656. Increasing its
  first interval wraps the complete neume to system 2; stable note IDs and real
  DOM focus survive reparenting, undo and redo.

Sampling and raster checks are finite, not proofs of all possible contours or
all browser/device combinations. The live editor checks used Chromium; no
cross-engine claim is made. This change does not add a browser testing
framework or replace the repository's manual verification responsibilities.

## Automated tests and documentation

Final repository checks passed: `npm run format:check`, `npm run lint`,
`npm test` (525 tests in 32 files), `npm run build`, and `git diff --check`.

`climacus-porrectus-geometry.test.ts` checks all 20 approved recipes, interval
matrices including extrapolations, transposition, ID freedom, complete preview
parity, exact-fit wrapping, stable selection/focus decisions, normalization and
history. Placeholder-specific assertions in the existing layout tests were
updated. The older exact-fit Clivis regression now uses an engraved Torculus in
its prefix, preserving its exact x=656 boundary. The multi-system vertical
assertion uses actual note height instead of the removed legacy-height constant.

Authoritative drawing metrics and layout/interaction documentation describe the
implemented recipes and target semantics. The README, glossary, testing guide
and roadmap no longer describe these neumes as placeholders. ADR 0007 was
reviewed for the approved optional target field and ribbon selection meaning;
this fits its existing shared-derived-geometry decision and requires no new ADR.
Its status stays **Proposed**.

No application dependency or scope extension was needed. Implementation review
is the remaining step before deciding whether to accept ADR 0007 or open a PR.

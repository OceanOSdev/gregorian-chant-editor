# Integrated calligraphic compound contours

The approved Podatus and Clivis contours are implemented in the existing shared
geometry builder, including individual-note selection overlays. Each complete
compound remains a single filled path. Standalone Punctum and all four placeholder
neumes are unchanged. ADR 0007 remains Proposed pending implementation review.

## Actual editor screenshots

The review score was built with normal editor commands. From left to right:
Punctum, Podatus Δ1, Podatus Δ3, Clivis Δ1, Δ2, Δ3, Δ4, Punctum.

- [Desktop, 1100px viewport](compound-contours-desktop.png)
- [Normal scale, 760px viewport](compound-contours-normal.png)
- [Reduced responsive scale, 430px viewport](compound-contours-responsive.png)

The score scales to approximately 1.244, 1.011 and 0.553 respectively. Visual
inspection confirmed the adjacent Pes opening is still visible at normal and
reduced sizes. Its detail becomes less distinct at the smaller scale, as expected
from rasterization. No optical translation or spacing adjustment was applied.

## Verification

Chromium checks covered:

- Actual SVG bounds for complete ink and individual head paths at Δ1–5 and Δ8,
  matching all declared bounds. Δ8 remains an extrapolated project construction.
- Independent head clicks, Tab navigation, Enter selection, whole-neume selection,
  pitch changes, stable identity, focus, normalization, and undo/redo.
- Refined individual selection paths in adjacent and wider forms.
- Identical placement-preview and committed ink, including after wrapping.
- Responsive independent Pes-head selection using real pointer events.
- Connected raster ink at 100%, 75%, 55%, and 50% with a fractional translation;
  a sampled point within the Pes opening remained transparent at every scale.
  This supplements visual inspection rather than proving every raster phase.
- Exact-edge Clivis interval reflow with focus preserved through undo/redo.

No runtime exceptions were observed. See
[browser results](compound-contours-browser-results.json) for recorded outcomes.

Geometry regression tests cover the approved specimen paths, fitted head overlays,
unchanged bounds, advance widths, hit regions, musical anchors, the interval and
preview matrix, ten-Podatus system capacity, and existing exact-fit Clivis reflow.
Formatting, lint, all 487 tests, and the production build passed.

The production changes are confined to geometry and drawing documentation. No
renderer, interaction, command, domain, dependency, or wrapping changes were
needed. The [drawing guide](../../engraving-metrics.md) owns the project metrics.

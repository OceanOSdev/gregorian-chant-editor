# Variant C Punctum verification

Standalone Punctum now uses the approved six-cubic contour described in
[drawing metrics](../../engraving-metrics.md#punctum). Podatus and Clivis geometry
is unchanged; ADR 0007 remains Proposed.

Actual Chromium editor captures, created using normal editor commands:

- [Normal size, 760px viewport](punctum-c-desktop.png)
- [Reduced responsive size, 430px viewport](punctum-c-responsive.png)

Both show seven Puncta at staff positions 0–6: all four lines and all three
spaces. At reduced size the crown and scoop become less distinct through
rasterization, while the upright square-note silhouette remains readable.
No optical offset was applied.

Browser checks confirmed actual SVG bounds of 12 × 12 for every head, identical
preview and committed ink, keyboard selection and pitch movement, stable note
identity through undo/redo, and pointer selection at the responsive size.
No runtime exceptions were observed. Details are recorded in
[browser results](punctum-c-browser-results.json).

Formatting, lint, all 477 tests, and the production build passed. Existing layout
tests continue to cover spacing, lyric anchors, hit bounds, and wrapping.

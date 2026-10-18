# 7. Share derived neume engraving geometry

Date: 2026-10-17

## Status

Accepted

## Context

The editor's provisional rectangular heads and vertical connectors are not
sufficient for the distinct modern square-notation forms of Punctum, ordinary
Podatus, Clivis, Scandicus, Torculus, Climacus, and Porrectus. Improving their silhouettes must preserve
semantic note identity, constituent-note interaction, preview parity, and geometry-derived
wrapping. Painted extents, musical alignment points, and padded interaction
regions serve different purposes and need independent definitions.

This decision extends the derived-layout responsibilities established by
[ADR 0002](0002-separate-semantic-and-derived-state.md) and
[ADR 0005](0005-derive-wrapping-from-rendered-geometry.md). It does not supersede
them or change the semantic kinds and stable IDs in ADRs 0003 and 0004.

## Decision

Use small pure TypeScript builders in the layout layer to derive ID-free neume
geometry from kind and ordered staff positions. Represent visible ink with SVG
primitives and short paths, with explicit painted bounds, nominal note anchors,
selection contours, independent hit regions, a kind-specific musical lyric
anchor, and horizontal advance. Committed layout attaches existing semantic IDs
to the result. Semantic document data remains independent of SVG geometry.

Measurement, wrapping, committed placement, and hypothetical insertion previews
consume the same geometry and advance rules. The SVG renderer displays supplied
geometry without calculating authoritative head positions or connections.
Committed and preview rendering share the same ink-rendering helpers.

Musical lyric alignment follows the neume's nominal construction, independently
of complete painted bounds. Interaction padding and selection outlines remain
derived, distinct from ink measurements. Interval-sensitive geometry is computed
procedurally rather than selected from a fixed inventory of interval glyphs.

Introduce no notation-font dependency, generalized glyph framework, or semantic
document fields. All seven initial kinds have implemented, reviewed constructions.
Optional per-note path-shaped hit targets reuse
`InkShape`, with rectangular fallback. Selection contours may follow shared
ribbon regions without adding artificial noteheads. Intended joins use clean filled contours;
semantic unity does not require connected ink. Ordinary Scandicus can retain
separate components when the reference construction calls for them. Shape metrics
and approved contact/stem rules belong in the [drawing-metrics guide](../engraving-metrics.md),
not in this ADR. The
[browser verification record](../verification/engraving/README.md) and subsequent
implementation reviews informed acceptance of this decision. Acceptance does
not establish publication-quality engraving or resolve the existing vertical
collision and extreme-pitch limitations.

## Consequences

### Positive

- One geometry source keeps visible ink, measured widths, previews, and wrapping
  consistent.
- Stable semantic identities and existing command/history behavior survive
  engraving changes.
- Explicit note and lyric anchors remain meaningful when a contour differs from
  a rectangle or contains asymmetric ink.
- Procedural connections support larger intervals without a font-glyph cutoff.
- Paths leave room for later compound shapes without prebuilding their rules.

### Negative

- The project owns contour quality and requires visual reference review in
  addition to numeric tests.
- Bounds and advance contracts must be maintained for each drawn part.
- Compact or continuous ink needs deliberate constituent-note hit regions.
- Extreme semantic pitches still exceed the current fixed vertical layout;
  general interval construction does not provide vertical collision handling.

## Alternatives considered

Rectangles and generic vertical lines alone retain the current simplicity but
cannot express every fitted contact contour. A notation font offers mature
outlines but introduces font mapping, metrics, loading, distribution, and
constituent-note anchoring work beyond the current engraving milestones.

Keep the choice limited to these builders for the initial neume vocabulary.
Reconsider a font only when future vocabulary provides a concrete reason.

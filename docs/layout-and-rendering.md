# Layout and rendering

## Scope

This document is authoritative for derived score layout, engraving geometry,
automatic wrapping, lyric placement, SVG rendering, and layout accessibility.

## Related documents

- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Editor interactions](editor-interactions.md)
- [Testing](testing.md)
- [Glossary](glossary.md)
- [Project drawing metrics](engraving-metrics.md)
- [Shared geometry decision](adrs/0007-share-derived-neume-engraving-geometry.md)
- [Wrapping decision](adrs/0005-derive-wrapping-from-rendered-geometry.md)
- [Roadmap and limitations](roadmap.md)

## Staff, system, and score

A [staff](glossary.md#staff) is one four-line writing area. A
[system](glossary.md#system) contains a repeated staff, C clef, an ordered
partition of neumes, and the lyrics owned by that partition. The
[score](glossary.md#score) contains one or more vertically arranged systems.
Even an empty document produces one empty system.

`layoutChant` converts `ChantDocument` to `ChantLayout`:

- score `title`, fixed `width`, and derived `height`;
- ordered `systems`;
- each system's index, bounds, staff lines, clef, neumes, lyrics, and
  `startNeumeIndex`.

`startNeumeIndex` is the global semantic index of the first neume assigned to a
system. Interaction resolvers add it to a boundary within that system to recover
a global document boundary.

## Coordinate convention and SVG size

Current child geometry is score-absolute. Staff lines, clefs, noteheads,
connectors, raw bounds, lyrics, and previews already include the vertical
offset of their owning system. `ScoreSvg` can render them directly; its system
groups are organizational and have no translation transform.

This describes the present layout contract, not an eternal ban on a future
system-local coordinate design.

The score width is currently fixed at 720 layout units. Its height grows from
the number of systems and the vertical advance between them. `ScoreSvg` uses
both dimensions in its `viewBox`; CSS can scale the vector drawing
responsively while the layout retains stable internal units.

Every system repeats the same four staff-line x extents and a C clef positioned
on the semantic clef line. Their y coordinates advance by the system offset.

Graphical placement previews contain an ID-free local ghost and a caret on
committed systems. They do not assemble hypothetical systems or lyrics, or
change score dimensions. Shared engraving builders still determine the actual
neume shape; [editor interactions](editor-interactions.md#caret-and-cursor-ghost)
owns caret boundary, local pitch, clamping and remote-target feedback rules.

## Neume geometry

`buildNeumeGeometry` in `src/editor/layout/neume-geometry.ts` is the pure,
ID-free source for note selection contours, engraved ink components,
painted bounds, nominal note anchors, interaction bounds, musical `lyricAnchorX`,
and horizontal `advanceX`. Rectangles and short paths carry explicit bounds;
there is no DOM measurement, notation font, glyph framework, or semantic format
change. See [drawing metrics](engraving-metrics.md) for the exact project
recipes, their reference basis, and large-interval extrapolations.

Punctum, ordinary Podatus, Clivis, Scandicus, Torculus, Climacus, and Porrectus use the approved
square-notation constructions. Intended joined components render as traced
filled contours, without internal antialiased boundaries. A semantically unified
neume may have disconnected ink: Scandicus with adjacent first interval keeps
its conventional first Punctum separate from the upper pair, including the
explicit Punctum + Pes construction at (1,1). No artificial connector is added.
Per-note head shapes exist for selection feedback; they do not separately paint
the normal silhouette. Climacus has a Virga followed by two separate descending
inclinata. Porrectus has one descending ribbon and fitted ascending terminal;
its first two notes select regions of that shared ribbon, not artificial heads.

A note's `anchorX` and `anchorY` represent its nominal musical position; its
`x`, `y`, `width`, and `height` enclose its selection contour. This may be a
head or a region of shared ribbon ink. These need not have the
same center, especially for an optically lifted adjacent Pes upper head.
`hitBounds` encloses independent padded interaction geometry. Optional
`hitShape?: InkShape` supplies a polygonal pointer/focus target for Climacus;
absence retains the rectangular target. Shared ink parts have
no semantic IDs. Only committed `NoteLayout` and `NeumeLayout` attach existing
note and neume IDs.

Complete painted `bounds` support measurement, insertion midpoints, and
whole-neume outlines. They exclude interaction padding and selection styling.
Musical lyric anchors are explicit and never recomputed from the union of all
ink. `advanceX` is the distance from one glyph's left ink edge to the following
left ink edge: complete painted width plus the existing 33-unit edge gap.
Each system's first nominal pitch anchor remains x = 230; all seven kinds now
use a six-unit first bearing with the same ink-gap rule.

## Automatic whole-neume wrapping

`placeNeumeSequence` processes semantic neumes in order and measures each
complete raw rendered extent at its proposed horizontal position. A candidate that exceeds
the usable right boundary starts the next system when the current system
already has content.

The algorithm:

- preserves semantic order;
- keeps an exact fit on the current system;
- never exposes or splits a boundary inside a neume;
- derives system membership instead of storing it in `ChantDocument`;
- preserves semantic neume and note IDs across reflow.

Wrapping uses rendered geometry rather than semantic note count. Compact
Scandicus, Torculus, Climacus, and Porrectus geometry and three separately
spaced Puncta do not consume the same horizontal width, even though each
contains three notes.

If one unexpectedly wide neume cannot fit on an otherwise empty system, it is
placed there once and that system is finalized. The input index advances, so
layout always makes progress and does not create a permanent empty trailing
system.

Changing an individual pitch can switch between adjacent and wider Clivis
construction, changing width and system membership. Whole-neume transposition
retains interval widths. Insertion, deletion, normalization, and interval edits
can reflow later entities while preserving semantic IDs and pending focus.
`wrapNeumes` and committed layout use the same sequence walker, including
exact-fit and oversized progress rules. Hover does not run a wrapping pass.

## Committed layout and previews

Committed layout copies semantic neume and note IDs into `NeumeLayout` and
`NoteLayout`. Rendering uses those IDs for React keys, selection, focus, and
data attributes. Coordinates remain derived and carry no authority back into
the semantic document.

Graphical previews reuse complete ID-free `NeumeGeometry` for a ghost on the
hovered staff, alongside caret coordinates for the semantic insertion
index. They share shape, snapped pitch and ink rendering with committed notation;
final spacing and system assignment are derived only after insertion. `ScoreSvg`
renders committed systems directly throughout hover, without hiding/replacing
ink or expanding its viewBox. The preview overlay contains no semantic IDs or
interactive controls. See [editor interactions](editor-interactions.md#graphical-placement-and-preview)
for input and lifecycle rules.

## Lyrics

Lyric syllables carry stable `startsAtNeumeId` anchors. Layout resolves each
anchor directly to its committed neume and emits one lyric on that system.
Later neumes in the span never repeat the text, including across system breaks.
Music-only geometry still determines spacing and wrapping.

Current horizontal alignment rules are:

- Punctum: center of its sole note;
- Podatus: center of its first, lower note;
- Clivis: midpoint of its two nominal head centers (the conventional body span),
  independent of stem/contour overhangs or other ink bounds;
- Scandicus: center of its first, lowest note.
- Torculus, Climacus, and Porrectus: center of their first note.

Valid semantic documents contain only anchored, nonblank syllables in anchor
order. Layout preserves that order. Word boundaries are semantic metadata;
generated hyphens are deferred to Stage 4.

`ScoreSvg` renders each entire string with `textAnchor="middle"` at the
alignment x coordinate. The renderer does not implement vowel-centered
typography, automatic hyphenation, lyric collision avoidance, word-spacing
logic, or continuation marks.

## Rendering and accessibility

`ScoreSvg` renders each system's staff, clef, notation, and lyrics.
`NeumeInk` displays the same supplied ink for committed notation and previews;
preview opacity changes presentation only. Intended joined ink is painted as a
continuous filled contour; conventional disconnected components remain separate.
Individual note selection adds a stroke-only contour overlay, including ribbon
regions for Porrectus.
A selected whole neume
receives an outline expanded from its raw bounds.

Notes are SVG groups with button roles, accessible names describing their
position within a neume, pressed state for individual selection, and shared
whole-neume keyboard instructions. During placement mode they are removed from
the tab order and pointer interaction and are marked disabled. Stacked Pes hit
padding is partitioned at the nominal inter-pitch y midpoint; adjacent Clivis
padding is partitioned at the shared x edge. Visible heads remain independently
clickable. At an exact shared boundary, the later semantic note's control owns
the boundary through SVG paint order. Focus feedback styles the actual target (polygonal when `hitShape` is supplied,
rectangular otherwise);
whole-neume feedback uses complete painted bounds. Scandicus partitions adjacent
first-note padding at the upper column's left edge and the upper pair at its
nominal y midpoint. Torculus partitions adjacent padding at shared x edges.
Wider intervals retain full horizontal padding to preserve visible head interiors;
these existing controls retain their rectangular targets.

Climacus partitions padded diamond targets with an oblique half-plane so that
visible tips remain owned by the correct semantic note. Porrectus partitions at
the right terminal column and the midpoint of its second/third nominal pitches;
its first target has fixed top y=−14 relative to the first pitch. New Climacus
and Porrectus targets explicitly use `pointer-events: fill`, preventing focus
strokes from enlarging ownership. During placement, target descendants also
receive `pointer-events: none` so explicit fill ownership cannot override the
disabled parent. Target shapes are aria-hidden, nonfocusable children of the
existing named note controls. Selection overlays remain hidden and pointer-free.
No separate rectangular focus outline is rendered for a path target. See
[drawing metrics](engraving-metrics.md) for exact ownership recipes.

The SVG has a title and generated description. The description totals systems,
neumes, notes, and rendered lyric syllables across the complete multi-system
layout. During placement, the root instead exposes the concise placement
name/description specified in [editor interactions](editor-interactions.md#focus).
Its local placement-context cue uses derived neume bounds without altering ink,
advance, or wrapping. Preview geometry and purely visual connectors, clefs, hit targets, and
selection outlines are hidden from accessibility APIs where appropriate.

Pure helpers test the accessible strings. Actual browser focus, event
propagation, and visual behavior still require the manual checks described in
the [testing guide](testing.md).

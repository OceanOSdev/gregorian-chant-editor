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

## Neume geometry

The current engraving uses small rectangles as noteheads. Notes inside one
neume use compact horizontal center offsets:

- Punctum: one center;
- Podatus and Clivis: two centers separated by the compact offset;
- Scandicus: three centers at successive compact offsets.

After the final note center of one neume, the next neume advances by notehead
width plus the normal inter-neume gap. Compact internal spacing and normal
between-neume spacing are therefore different contracts.

Every `NeumeLayout` has a connector array:

- Punctum: no connectors;
- Podatus and Clivis: one vertical connector;
- Scandicus: two connectors joining adjacent notes.

Raw neume bounds enclose notehead rectangles and connector stroke extent.
Those complete bounds support width measurement, horizontal insertion
midpoints, selected-neume outlines, and Clivis lyric alignment.

This geometry is intentionally provisional. It does not claim
publication-quality square notation, typographic clefs, ledger lines, or
complete engraving rules.

## Automatic whole-neume wrapping

`wrapNeumes` processes semantic neumes in order and measures each complete raw
rendered extent at its proposed horizontal position. A candidate that exceeds
the usable right boundary starts the next system when the current system
already has content.

The algorithm:

- preserves semantic order;
- keeps an exact fit on the current system;
- never exposes or splits a boundary inside a neume;
- derives system membership instead of storing it in `ChantDocument`;
- preserves semantic neume and note IDs across reflow.

Wrapping uses rendered geometry rather than semantic note count. Compact
Scandicus geometry and three separately spaced Puncta do not consume the same
horizontal width, even though both contain three notes.

If one unexpectedly wide neume cannot fit on an otherwise empty system, it is
placed there once and that system is finalized. The input index advances, so
layout always makes progress and does not create a permanent empty trailing
system.

Pitch-only movement retains the current horizontal width model. Deletion or
insertion can change later system membership, but the affected entities retain
their semantic IDs.

## Committed layout and previews

Committed layout copies semantic neume and note IDs into `NeumeLayout` and
`NoteLayout`. Rendering uses those IDs for React keys, selection, focus, and
data attributes. Coordinates remain derived and carry no authority back into
the semantic document.

Graphical previews reuse the same raw note, connector, bounds, spacing, and
wrapping model. The preview simulates inserting an ID-free candidate into the
semantic order and returns its absolute position after hypothetical reflow.
See [editor interactions](editor-interactions.md#graphical-placement-and-preview)
for input and lifecycle rules.

## Lyrics

Lyric syllables live in `ChantDocument`; lyric coordinates do not. Each neume
refers to one syllable ID. Layout scans committed neumes in semantic/layout
order and records the first associated neume for each syllable.

For every associated syllable, layout emits one `LyricLayout` owned by the
system containing that first neume. Later neumes for the same syllable do not
create repeated text. A melisma that crosses a system break therefore keeps its
single lyric on the first system.

Current horizontal alignment rules are:

- Punctum: center of its sole note;
- Podatus: center of its first, lower note;
- Clivis: center of the complete raw neume bounds;
- Scandicus: center of its first, lowest note.

An unassociated syllable has no lyric layout entry. An associated syllable
with empty text still has an entry and renders an empty SVG text value. Layout
preserves semantic syllable order when collecting lyric entries.

`ScoreSvg` renders each entire string with `textAnchor="middle"` at the
alignment x coordinate. The renderer does not implement vowel-centered
typography, automatic hyphenation, lyric collision avoidance, word-spacing
logic, or continuation marks.

## Rendering and accessibility

`ScoreSvg` renders each system's staff, clef, neumes, connectors, noteheads,
and lyrics. A selected note receives selected styling. A selected whole neume
receives an outline expanded from its raw bounds.

Notes are SVG groups with button roles, accessible names describing their
position within a neume, pressed state for individual selection, and shared
whole-neume keyboard instructions. During placement mode they are removed from
the tab order and pointer interaction and are marked disabled.

The SVG has a title and generated description. The description totals systems,
neumes, notes, and rendered lyric syllables across the complete multi-system
layout. Preview geometry and purely visual connectors, clefs, hit targets, and
selection outlines are hidden from accessibility APIs where appropriate.

Pure helpers test the accessible strings. Actual browser focus, event
propagation, and visual behavior still require the manual checks described in
the [testing guide](testing.md).

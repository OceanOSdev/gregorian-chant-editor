# Glossary

## Scope

This glossary defines project terminology for software contributors. It is not
a general history or musicology reference.

## Related documents

- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Layout and rendering](layout-and-rendering.md)
- [Editor interactions](editor-interactions.md)

## Terms

### Note

A semantic pitched unit with a stable ID and a `StaffPosition`, nested inside a
neume. See the [domain model](domain-model.md).

### Notehead

A rendered head indicating a musical pitch; its contour is derived, not semantic
data. Some notes, such as the first two pitches of Porrectus, are indicated by
regions of a shared ribbon rather than separate noteheads. Nominal pitch anchors
and individual controls remain distinct from painted contours.

### Neume

An ordered semantic group of one or more notes. The current kinds are
Punctum, Podatus, Clivis, Scandicus, Torculus, Climacus, and Porrectus.

### Syllable

An ordered semantic lyric entity with stable ID, text, word boundary and a stable start-neume anchor.

### Melisma

In this project, multiple neumes covered by one syllable anchor before the next anchor.

### Staff line

One of the four horizontal lines on which staff-relative notation is placed.

### Staff

One four-line musical writing area inside a rendered system.

### System

One horizontal staff, effective opening C/F clef, notation partition, and owned
lyric row within the score. System membership is derived by layout.

### Score

The complete derived layout and SVG, containing one or more systems.

### Clef

A semantic pitch reference: C/do or F/fa on staff line 1–4, bottom to top.
The required initial clef is an ID-less value; authored mid-score changes have
stable IDs and explicit score-boundary anchors. The last preceding clef governs
a neume. Continuation systems repeat the effective incoming clef, or use their
first authored clef in the leading position. Initial-clef edits preserve melody
only in their governing passage. See [ADR 0015](adrs/0015-order-clef-changes-at-score-boundaries.md).

### Custos (plural: custodes)

An automatically derived guide anticipating the next pitched note under the
clef at the guide's location. Custodes appear at staff endings and meaningful
mid-staff clef changes; duplicate guides for the same transition are suppressed.
They are noninteractive geometry, not semantic notes or history items.

### Score insertion boundary

A stable semantic intent naming `beforeNeumeId`, `beforeDivisionId` and
`beforeClefId`. Null values denote the corresponding end/run edge. A boundary
never points inside a neume; malformed, stale and ambiguous references reject.
See [semantic insertion boundaries](domain-model.md#semantic-insertion-boundaries).

### `StaffPosition`

An integer line-or-space step measured above the bottom staff line. It is
semantic pitch data, not a pixel coordinate.

### Semantic order

The mixed neume/division/clef walk derived from independent semantic collections.
Neume-array order governs pitched order; boundary division order and clef order
within each division slot govern intervening events. See
[semantic insertion boundaries](domain-model.md#semantic-insertion-boundaries).

### Layout order

The same semantic order partitioned into derived systems. Reflow changes the
partition, not entity identity or order.

### Graphical placement

Pointer-based insertion that resolves a score point to a valid whole-neume
semantic boundary and the selected tool's staff-relative value. Neume, division
and C/F clef tools share measured score slots. See [editor interactions](editor-interactions.md#graphical-placement-and-preview).

### Committed notation

Layout derived from semantic entities already present in the current document.

### Preview notation

ID-free geometry for a hypothetical insertion that has not entered the
semantic document or history.

## Authored note form

An optional explicit engraving choice on a stable note, distinct from its
neume's melodic contour. Stage 8B supports standalone Virga (square head with
right queue), neutral Punctum inclinatum (upright diamond), and Quilisma (a
pitched jagged head in an approved ascending Podatus or Scandicus). Omission
retains the context-derived default. See [the domain contract](domain-model.md#authored-note-forms-stage-8b).

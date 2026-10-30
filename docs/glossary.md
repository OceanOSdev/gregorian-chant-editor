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

One horizontal staff, C clef, notation partition, and owned lyric row within
the score. System membership is derived by layout.

### Score

The complete derived layout and SVG, containing one or more systems.

### Clef

The semantic pitch reference. The current model supports a C clef on staff
line 1, 2, 3, or 4; its rendered letter shape is a placeholder.

### `StaffPosition`

An integer line-or-space step measured above the bottom staff line. It is
semantic pitch data, not a pixel coordinate.

### Semantic order

The order of neumes in `ChantDocument.neumes`. See
[semantic insertion boundaries](domain-model.md#semantic-insertion-boundaries).

### Layout order

The same semantic order partitioned into derived systems. Reflow changes the
partition, not entity identity or order.

### Graphical placement

Pointer-based insertion that resolves a score point to a valid semantic neume
and boundary. See [editor interactions](editor-interactions.md#graphical-placement-and-preview).

### Committed notation

Layout derived from semantic entities already present in the current document.

### Preview notation

ID-free geometry for a hypothetical insertion that has not entered the
semantic document or history.

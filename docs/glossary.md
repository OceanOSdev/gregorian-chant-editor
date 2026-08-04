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

The rendered shape representing a note. It is currently a placeholder
rectangle and is not semantic data.

### Neume

An ordered semantic group of one or more notes. The current kinds are Punctum,
Podatus, Clivis, Scandicus, and Torculus.

### Syllable

An ordered semantic lyric entity with stable ID and complete text. Neumes refer
to a syllable by ID.

### Melisma

In this project, multiple neumes associated with the same lyric syllable.

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

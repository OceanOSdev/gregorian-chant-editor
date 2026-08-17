# Domain model

## Scope

This document is the authoritative description of semantic chant data,
identity, ordering, pitch representation, and neume invariants.

## Related documents

- [Architecture](architecture.md)
- [Commands and history](commands-and-history.md)
- [Layout and rendering](layout-and-rendering.md)
- [Glossary](glossary.md)
- [Stable identity decision](adrs/0003-use-stable-semantic-identities.md)
- [Explicit neume types decision](adrs/0004-use-explicit-neume-types-and-ordered-tuples.md)

## `ChantDocument`

`ChantDocument` is the canonical semantic representation:

- `title` is the score title;
- `clef` is currently a C clef placed on staff line 1, 2, 3, or 4;
- `syllables` is the semantic lyric order;
- `neumes` is the semantic notation order.

The document contains no pixel coordinates, connector geometry, system
assignment, placeholder glyph shape, selection, tool, focus, or history data.
Those concerns are derived or transient.

## Syllables, neumes, and notes

A lyric syllable has a stable `id` and its complete `text`. A neume has its own
stable `id`, a discriminating `kind`, a `lyricSyllableId`, and nested notes.
Each note has a stable `id` and a `StaffPosition`.

`lyricSyllableId` associates a neume with one semantic syllable. Several
neumes may share it, forming the editor's current representation of a
[melisma](glossary.md#melisma). A syllable may also have no associated neume.

Semantic order is the order of `ChantDocument.neumes`. Layout preserves that
order while partitioning it into derived systems. Array indexes are useful
inside one operation, but stable IDs connect entities across edits, reflow,
selection, focus, normalization, and history.

## `StaffPosition`

`StaffPosition` is a branded integer number of line-or-space steps above the
bottom staff line. Positions 0, 2, 4, and 6 are the four staff lines; odd
positions are the intervening spaces. Negative positions and values above 6
are legal semantic pitches for notes outside the staff.

`staffPosition(value)` rejects non-integers. The semantic value is not a y
coordinate: layout converts it to absolute score geometry.

## Supported neumes and tuple order

The `Neume` union is discriminated by `kind`. Its note tuples encode current
cardinality and musical order:

```text
Punctum:   [note]
Podatus:   [lower, higher]
Clivis:    [higher, lower]
Scandicus: [lowest, middle, highest]
Torculus:  [first, higher second, lower third]
```

Podatus must ascend strictly, Clivis must descend strictly, and every adjacent
pair in Scandicus must ascend strictly. Torculus must rise from its first note
to its second and fall strictly from its second to its third; its first and
third pitches may differ or be equal. Equal adjacent or reversed required
intervals are invalid.

Fixed-cardinality tuples make the expected number and order of notes visible
to TypeScript. Explicit kinds let commands, normalization, layout,
interaction, and accessibility use exhaustive behavior. One arbitrary note
array would leave cardinality, ordering, and kind-specific operations implicit.

TypeScript protects correctly typed construction, but data can still arrive
malformed at runtime. `isValidNeume` therefore checks cardinality and pitch
ordering defensively.

## Lookup and identity

`findNeume` resolves a neume ID and its current global semantic index.
`findNote` resolves a note ID, its owning neume, the neume's global index, and
the note's tuple index. Missing IDs return `null`.

These helpers do not search rendered systems. System membership is derived and
may change after any edit that changes horizontal flow.

## Semantic insertion boundaries

Insertion indexes are boundaries in the top-level neume array, from zero
through `document.neumes.length`, inclusive. A boundary never points between
notes inside a compact neume.

`resolveSyllableNeumeInsertionIndex` constrains a preferred global boundary to
the active syllable's existing neume group. For a syllable with no neumes, it
chooses the position before the next later syllable group, or the document end.
This maintains lyric-syllable ordering and keeps each associated group
contiguous.

Toolbar and graphical insertion both use this canonical resolver. The active
syllable is transient editor state, not a field in `ChantDocument`.

## Deletion and normalization

Deleting a complete neume removes that neume and all nested notes.

Deleting an individual note normalizes the owning neume:

- deleting the note of a Punctum removes the neume;
- deleting either Podatus or Clivis note produces a Punctum;
- deleting any Scandicus note produces a Podatus from the two survivors.
- deleting the first Torculus note produces a Clivis;
- deleting the third Torculus note produces a Podatus;
- deleting the middle Torculus note produces a Podatus when the outer notes
  ascend, a Clivis when they descend, or no edit when they are equal because
  the survivors cannot form a supported two-note neume.

Normalization preserves the neume ID, its syllable association, and the IDs of
surviving notes. Stable identity therefore remains valid for surviving
selection and history references.

## Command-validation nuance

Podatus and Clivis share a validating two-note insertion helper. Scandicus and
Torculus insertion independently check their index, syllable association, IDs,
cardinality, and pitch invariant. `insertPunctum` currently performs a simple
immutable splice and is not independently as defensive as the multi-note
insertion commands.

Callers currently provide valid Punctum inputs and resolved boundaries. This is
a current implementation nuance, not a recommendation to bypass validation and
not a behavior changed by the documentation milestone.

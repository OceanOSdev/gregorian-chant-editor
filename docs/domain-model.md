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
- `neumes` is the pitched semantic order;
- `divisions` is a required collection of non-pitched punctuation.

The document contains no pixel coordinates, connector geometry, system
assignment, placeholder glyph shape, selection, tool, focus, or history data.
Those concerns are derived or transient.

## Syllables, neumes, and notes

A lyric syllable has a stable `id`, nonblank single-syllable `text`, a
`startsAtNeumeId` anchor, and `boundaryBefore` (`word` or `continuation`).
Neumes are independent entities with stable IDs, explicit kinds, and nested
notes. They have no lyric reference.

Each syllable anchors an existing neume; anchors are unique and strictly
ordered by the semantic neume array. The first syllable starts a word.
`hasValidLyricAnchors` checks these lyric invariants. `findSyllableAtNeume`
looks up an exact anchor; `findSyllableForNeume` derives membership from the
nearest preceding anchor. Neither stores derived spans. Before the first
anchor, music has no lyrics; the last syllable extends to document end.
Explicit lyricless tails and unanchored lyrics are future extensions.

Text cannot be blank or contain whitespace, ASCII hyphens, or underscores.
Word structure is metadata, not literal entry delimiters. Continuous entry interprets these delimiters outside the domain. Generated
hyphens are derived engraving decorations, never semantic text.

Pitched order is the order of `ChantDocument.neumes`. Current layout preserves that
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
Climacus:  [highest, middle, lowest]
Porrectus: [first, lower second, higher third]
```

Podatus must ascend strictly, Clivis must descend strictly, and every
adjacent pair in Scandicus must ascend strictly. Torculus must rise from its
first note to its second and fall strictly from its second to its third; its
first and third pitches may differ or be equal. Climacus must descend
strictly between each adjacent pair. Porrectus must fall strictly from its
first note to its second and rise strictly from its second to its third; its
outer pitches may differ or be equal. Equal adjacent or reversed required
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

`ScoreInsertionBoundary` identifies a boundary by `beforeNeumeId` (null means
end) and `beforeDivisionId` (null means after all divisions there). A non-null
division ID must belong to that neume boundary. This distinguishes every slot
among adjacent divisions, including leading/trailing punctuation and an empty
score. A boundary never points inside a compact neume.

Legacy numeric insertion indexes remain valid only at division-free boundaries;
occupied boundaries reject ambiguous numeric insertion with the original document.
Stage 5B will provide graphical and keyboard side selection.

Insertion is independent of lyrics: any valid whole-neume boundary is legal,
and inserting music never moves existing syllable anchors. Toolbar insertion
uses musical selection; graphical insertion uses the clicked system boundary.

## Deletion and normalization

Deleting a complete neume removes it, its notes, and its anchored syllable,
if any, atomically. Other anchors remain unchanged. Deleting the final note
uses the same policy. Syllable deletion preserves crossed word boundaries:
the successor starts a word if either it or the deleted syllable started one;
the first surviving syllable always starts a word.

Deleting an individual note normalizes the owning neume:

- deleting the note of a Punctum removes the neume;
- deleting either Podatus or Clivis note produces a Punctum;
- deleting any Scandicus note produces a Podatus from the two survivors.
- deleting the first Torculus note produces a Clivis;
- deleting the third Torculus note produces a Podatus;
- deleting the middle Torculus note produces a Podatus when the outer notes
  ascend, a Clivis when they descend, or no edit when they are equal because
  the survivors cannot form a supported two-note neume.

Climacus becomes Clivis after deletion of any constituent. For Porrectus,
deleting the first note produces Podatus, and deleting the third produces
Clivis. Deleting the middle produces Podatus when the outer notes ascend,
Clivis when they descend, or no edit when they are equal, matching Torculus.

Normalization preserves the neume ID, its lyric anchor, and the IDs of
surviving notes. Stable identity therefore remains valid for surviving
selection and history references.

## Validation boundaries

Insertion commands check whole-neume boundaries, identity collisions and
kind/cardinality/pitch invariants without requiring lyrics. Lyric commands
validate their target and lyric invariants. Invalid or unchanged commands
return the original document. Stable neume IDs retain anchors through normalization.

See [ADR 0008](adrs/0008-anchor-lyrics-to-neumes.md) for the relationship decision.

## Lyric engraving preferences (Stage 4A)

`ChantDocument.lyricLanguage` is required: `la` (Latin), `en` (English),
`el` (Greek), or `und` (Unspecified). New chants, including the example, explicitly
use Latin. This is a document-wide engraving preference, never a text restriction
or inferred language. Missing/invalid runtime values are handled as `und` at
layout and control boundaries. There is no persisted format or migration today.

A syllable may have `alignment: { start, end }`, a half-open range of Unicode
extended grapheme indexes into its exact text. It overrides automatic alignment,
including in `und`; it stores no pixels and never changes `startsAtNeumeId`.
Ranges must be nonempty, integer, and within the current grapheme count.
Every accepted text change removes the override, even if the old indexes would
still fit. Exact unchanged text preserves it; undo restores the original text
and range together. This prevents silently shifting editorial intent.
See [ADR 0009](adrs/0009-document-lyric-language.md).

## Semantic divisions (Stage 5A)

`ChantDivision` has a stable nonblank `id`, a `kind` (`minima`, `minor`, `maior`,
`finalis`), and `beforeNeumeId` referencing a surviving neume or null for end.
Finalis is legal anywhere. Divisions have no notes, pitch, lyrics or geometry.
Their IDs must be unique across divisions and existing semantic entities.
`hasValidDivisions` rejects missing/malformed collections, unsupported kinds,
extra entity fields, duplicate IDs and dangling anchors. There is no persisted
schema or save/load migration today; existing fixtures explicitly supply `[]`.

`deriveScoreOrder` returns a tagged stream of neumes and divisions, or null for
invalid division data. Neume order determines boundary order; division-array
order determines order only within each boundary. There is no persisted second
full-score ordering authority. Consumers must not treat the raw division array
as global score order.

Inserting a neume at an explicit slot reanchors only the divisions preceding
that slot to the new neume. Thus A D B becomes A X D B before D, or A D X B
after D. Lyrics and surviving neume IDs remain unchanged. Deleting a neume
rehomes its divisions to the next neume or end. Rehomed divisions precede those
already at the destination in their prior derived order; none are discarded.
Normalization preserving a neume ID preserves its division anchors.

[Accepted ADR 0012](adrs/0012-divisions-at-semantic-boundaries.md) records the
owner-approved semantic model and alternatives. Rendering, accessible division controls, and any effect
on lyric compaction/hyphenation remain Stage 5B work; current layout ignores
divisions and the accepted lyric contracts are unchanged.

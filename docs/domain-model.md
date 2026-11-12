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
- `clef` is the required initial C (do) or F (fa) clef on staff line 1–4,
  numbered bottom to top; this singleton value object has no ID;
- `syllables` is the semantic lyric order;
- `neumes` is the pitched semantic order;
- `divisions` is a required collection of non-pitched punctuation;
- `clefChanges` is a required collection of stable-ID authored clef events.

The document contains no pixel coordinates, connector geometry, system
assignment, placeholder glyph shape, selection, tool, focus, or history data.
Those concerns are derived or transient.

## Syllables, neumes, and notes

A lyric syllable has a stable `id` unique across all semantic collections
(including authored clefs), nonblank single-syllable `text`, a
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

## Note rhythmic modifiers (Stage 8A)

Each stable-ID note optionally owns `mora: 1` and `episema: true`; omission
means off. Mora is presence, not a count or duration. Punctum allows none/sole;
Podatus and Clivis none/first/second/both; Scandicus, Torculus, Climacus and
Porrectus none/final/final two. The shared pure pattern validator governs
commands and native decoding. A final pair marks two distinct note IDs and
derives an auctum duplex; no second persisted sign object exists. Episema stays
independent. Movement and normalization retain marks on surviving note IDs.
See [ADR 0018](adrs/0018-conventional-mora-patterns.md) and
[persistence](persistence.md) for protected recovery of incompatible draft v2.

## Lookup and identity

`findNeume` resolves a neume ID and its current global semantic index.
`findNote` resolves a note ID, its owning neume, the neume's global index, and
the note's tuple index. Missing IDs return `null`.

These helpers do not search rendered systems. System membership is derived and
may change after any edit that changes horizontal flow.

## Semantic insertion boundaries

`ScoreInsertionBoundary` names `beforeNeumeId` (null means end),
`beforeDivisionId` (null means the final division slot), and optional
`beforeClefId`. A clef ID must belong to exactly that neume/division slot;
explicit null means after its clef run. Omitting the clef field is compatible
only with an empty clef slot. Legacy numeric insertion is valid only at
boundaries with neither divisions nor clefs. Stale and ambiguous intents reject.
See [ADR 0015](adrs/0015-order-clef-changes-at-score-boundaries.md).

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
layout and control boundaries. The native persistence boundary instead rejects
missing or invalid language values; see [persistence](persistence.md).

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
extra entity fields, duplicate IDs and dangling anchors. Native v1 files require
these collections, including `[]` for empty collections; see [persistence](persistence.md).

`deriveScoreOrder` returns a tagged stream of neumes, divisions and clef changes, or null for
invalid boundary data. Neume order determines boundary order; division-array
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
owner-approved division model. Its boundary operations are narrowly extended by
ADR 0015; graphical divisions and the ADR 0013 compaction exception are implemented.

## Initial clef editing (Stage 6A)

`domain/clef.ts` owns runtime `isValidClef` validation and the shared C (do) /
F (fa) names used by accessible descriptions. Commands and UI boundaries consume
these helpers; the semantic value remains defined in `chant-document.ts`.

Changing the initial clef preserves relative diatonic melody by translating the
initially governed passage atomically (before the first explicit change). The implemented mapping and its limits are
recorded in [Accepted ADR 0014](adrs/0014-preserve-melody-on-initial-clef-edit.md),
accepted by the owner on 2026-11-04. This introduces no absolute octave,
chromatic pitch, playback or new pitch field. Neume kinds, internal intervals,
IDs, lyric anchors and division order remain unchanged. Outside-staff positions
remain legal. Automatic clef repetitions and custodes are derived graphics.

## Explicit clef changes (Stage 6B)

`ClefChange` stores `id`, a C/F `clef`, `beforeNeumeId`, and
`beforeDivisionId`. The latter refers to the next division at the same boundary,
not an owner. IDs are unique across all semantic entities. Required collections,
clef values, anchors and slot membership are validated together by
`hasValidDivisions`; invalid runtime data is never treated as empty.

`deriveScoreOrder` visits each neume boundary, emits clefs before each division,
then the final clef run and the neume. Only order within a clef's own slot is
authoritative in `clefChanges`; division-array order controls divisions sharing
a boundary. The last preceding clef governs a whole neume. Leading, trailing,
consecutive and redundant clefs retain their IDs, including in empty scores.

`reanchorScoreOrder` reconstructs only boundary anchors from a temporary derived
walk after split/merge commands. Survivors retain their former derived order,
including when formerly distinct slots merge despite reversed collection order.
There is no persistent event stream, absolute pitch field or clef ownership by bars.
See [ADR 0015](adrs/0015-order-clef-changes-at-score-boundaries.md) for the full
ordering and relative-pitch contract, and [commands](commands-and-history.md#explicit-clef-transactions-stage-6b)
for its transaction boundary.

## Native interchange boundary (Stage 7A)

The [native v1 codec](persistence.md#native-version-1) validates complete runtime
objects before they enter the semantic model, preserving valid IDs and order.
The semantic model itself still contains no schema, history or browser fields;
the version belongs to the external envelope. Future schema evolution follows
Accepted ADR 0016 and the persistence guide.

## Authored note forms (Stage 8B)

`ChantNote.form?: 'virga' | 'inclinatum' | 'quilisma'` stores an authored
non-default form. Omission preserves the existing context-derived head.
`domain/note-forms.ts` owns the whitelist shared by semantic validation,
commands and native v3 decoding: Punctum accepts Virga/Inclinatum; Podatus
accepts Quilisma on its lower note; Scandicus accepts Quilisma on its middle
note. Strict ascending contours remain required. Other contexts reject.

An independent quilismatic Podatus may begin a score. This is an intentional
authoring allowance, not a claim of conventional unpreceded-quilisma usage;
context may be added later. There is no cross-neume, lyric or division condition.
Climacus's derived virga/inclinata remain implicit. No new semantic kind or
fusion flag exists. See [Accepted ADR 0019](adrs/0019-authored-note-forms-and-neume-contours.md).

## Authored vertical episema (Stage 8C)

A note may additionally own `verticalEpisema?: true`; omission means off.
It is independent of mora, horizontal `episema` and authored `form` on every
constituent of all seven kinds. It records an authored ictus sign, never an
inferred rhythmic count, accent, duration or playback instruction. The sign
has no separate identity. Moves, clef translations, form edits and accepted
normalization preserve it on the same surviving note ID; deleting that note
removes it. Placement is derived, with no saved side or coordinates.
See [Accepted ADR 0020](adrs/0020-vertical-episema-presence-and-derived-placement.md)
and [native v4](persistence.md#vertical-episema-in-native-v4-stage-8c).

## Authored B accidentals (Stage 8D)

`ChantDocument.accidentals` contains stable-ID `flat`/`natural` entities owned by
existing B notes. A repeated B in one neume/register has one sign, canonically
owned by its earliest B. Signs are independent of note forms and rhythmic marks.
Optional `placement: { kind: 'above-note', noteId }` identifies an earlier engraving
anchor; omission means before the entire owning neume.

The pure `domain/accidentals.ts` resolver derives effective diatonic degrees,
register-specific alterations and source-sign provenance in score order. Default
signs take effect at the neume prefix; explicit signs at their written note.
Word starts and all four divisions reset scope; clefs and system wrapping do not.
The owner determines the affected B register, while the effective clef at the
written location determines sign height. Placement requires the first following
matching B owner, with no intervening reset or conflicting same-register sign.
This isolated interpretation policy follows [ADR 0021](adrs/0021-author-b-accidentals-at-neume-boundaries.md).

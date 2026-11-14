# 24. Extend Scandicus and Climacus to bounded three- to five-note tuples

Date: 2026-11-13

## Status

Accepted (owner-approved 2026-11-13 after review of PR #76 at `34e7bb7`),
including the three decisions that were open gates: the extended Scandicus
engraving profile, the `{none, final}` mora matrix for four- and five-note
groups, and the narrow amendment to Accepted
[ADR 0023](0023-bounded-tuple-union-for-pes-subpunctis.md) recorded below.
Implemented under the Stage 9B-2
[plan](../plans/stage-9b2-extended-scandicus-climacus.md); final owner review
of the PR is pending.

Narrowly extends the bounded-tuple qualification of
[ADR 0004](0004-use-explicit-neume-types-and-ordered-tuples.md) that ADR 0023
introduced to two more named families. ADRs 0004 and 0023 remain Accepted and
are not superseded. Extends ADRs 0007, 0016, 0018 and 0019. ADR 0021's
accidental ownership and scope are unchanged.

## Context

Mocquereau (_A Study of Gregorian Musical Rhythm_, printed p. 152, Note b)
states that "the scandicus and the climacus can be made up of four, five, or
even more notes" and prints both lengths in Fig. 34. Sister Demetria (_Basic
Gregorian Chant_, p. 40) defines the Climacus as "three (or more) descending
notes" and prints a four-note example. The editor has only three-note
`scandicus` and `climacus` kinds.

New kinds such as `scandicus-4` would duplicate every rule and make deletion
from five to four notes a change of kind. ADR 0023 already established the
pattern for one family: one explicit kind whose notes are a small union of
fixed tuples, with no stored count. These two families are the same melodic
contour at more lengths, so they use the same pattern.

## Decision

- `scandicus` and `climacus` keep their kind names. Their `notes` is the union
  of exactly three fixed tuples: three, four or five `ChantNote`s
  (`MonotonicNotes`). Scandicus strictly ascends and Climacus strictly
  descends at every step. Runtime validation checks length and contour,
  including holes in malformed arrays. No count, variant or grouping field is
  stored; names derive from the tuple length ("four-note scandicus").
- The tuple is built only through a bounded helper (`monotonicNotes`) that
  rejects other lengths rather than truncating, padding or casting. Commands
  rebuild correlated tuples through one shared helper (`mapNeumeNotes`), which
  removes the earlier fallback branches that assumed three notes.
- Entry variants `scandicus-4`, `scandicus-5`, `climacus-4` and `climacus-5`
  map to the existing kinds; they are tool state, never persisted. Their
  default contours are stepwise from the clicked pitch.
- **Forms are cardinality-aware.** `allowedNoteForms(kind, index, noteCount)`
  keeps the ADR 0019 quilisma on the middle of a three-note Scandicus only.
  Four- and five-note groups have no authorable forms. Validation, commands,
  the note toolbar, native decoding and authored geometry share this rule, so a
  longer group with a quilisma is rejected instead of being drawn as three
  notes.
- **Mora is cardinality-aware (owner-approved).** `moraChoices(kind,
noteCount)` keeps none, final and final-two for three-note groups. Four- and
  five-note Scandicus and Climacus allow exactly **none** or **final note**,
  where the final note is the last note of the actual tuple. Final-two and
  earlier-note patterns are deferred. No direct printed example of a final mora
  on an extended group was found. The policy rests on analogy with the
  existing Podatus and descending-diamond conventions (including the approved
  Pes subpunctis final mora) and on unambiguous Gregorio rendering; see the
  [verification record](../verification/extended-scandicus-climacus/README.md#mora-gate).
  The mark belongs to its stable note: deleting an earlier constituent keeps
  it, and deleting the marked note removes it rather than transferring it.
- **Engraving.** Three-note geometry, including the authored quilismatic
  Scandicus, is byte-identical to the previous output.
  - Climacus: the approved virga plus one detached diamond per later note,
    using the existing interval-sensitive tail helpers. No new connectors.
  - Scandicus (owner-approved initial profile): the staircase printed in
    Mocquereau Fig. 34. Four notes are Pes + Pes; five notes are Pes +
    Punctum + Pes. The approved Podatus and Punctum sit in successive
    12-unit columns. Elements are not joined to each other, so no connector
    is implied between them. It is not a chain of three-note Scandicus glyphs.
    Applying this grouping to every interval combination is the chosen
    initial deterministic profile. It is **not** a claim that all historical
    extended Scandicus figures use this construction. Gregorio's default
    partitioning (Punctum first) remains a documented alternative, not the
    selected profile.
  - Pointer regions are partitioned at element column edges. Vertical-sign
    obstacles use only the actual Podatus joins.
- **Deletion** keeps the family from five to four and from four to three,
  preserving the neume ID, the surviving note IDs and their marks. Three to
  two keeps the established Podatus/Clivis rule. A surviving mark that the
  shorter group does not allow rejects the deletion rather than being dropped
  or transferred.
- **Native v8.** Exact v1–v7 readers keep the original three-note contract for
  these kinds and reject four- or five-note instances. v8 validates
  cardinality, contour and the count-aware form/mora policy.

## Amendment to ADR 0023 (owner-approved 2026-11-13)

Deleting one Pes subtripunctis constituent normalizes to a four-note Climacus
whenever the four survivors strictly descend and every surviving authored
modifier is valid there. The result is decided from the actual surviving
contour, not from the deleted index. This covers first-note deletion, and
apex deletion when the survivors strictly descend. Survivors that still rise
to an apex stay a Pes subpunctis.

The neume ID, surviving note objects and order, modifier ownership (including
a final mora on its own note), ADR 0021 B ownership and placement, lyric
anchors and structural boundaries are preserved. Equal adjacent survivors
remain rejected, as does any surviving mark the four-note Climacus does not
allow. No other normalization rule is broadened, including the equal outer
notes of Torculus/Porrectus.

## Consequences

### Positive

- Longer groups keep one stable identity through transposition, deletion
  between lengths and history.
- Cardinality stays bounded and visible to TypeScript and runtime validation.
  The shared tuple helper removed silent three-note truncation paths.
- Form and mora rules can no longer leak from three-note groups to longer ones.

### Negative

- Older builds cannot read v8 files, including files without longer groups.
- Consumers handle a union tuple for two more kinds.
- The Scandicus staircase rests on one printed figure per count. Other
  interval-dependent groupings may exist and would need new evidence.
- Final-two and earlier-note morae on longer groups cannot be authored.

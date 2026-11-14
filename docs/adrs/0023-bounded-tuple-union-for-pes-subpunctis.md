# 23. Allow a bounded union of fixed tuples for Pes subpunctis

Date: 2026-11-13

## Status

Accepted (owner-approved 2026-11-13, including the mora matrix below).
Narrowly qualifies the fixed-cardinality rule of
[ADR 0004](0004-use-explicit-neume-types-and-ordered-tuples.md) for one named
family; ADR 0004 remains Accepted and its explicit-kind contract is not
superseded. Extends ADRs 0007, 0016 and 0018. ADR 0021's accidental ownership
and scope are unchanged. Implemented in PR #75 under the Stage 9B-1
[plan](../plans/stage-9b1-pes-subpunctis.md); the implementation was
owner-accepted on 2026-11-13 at `0e521b6`. Acceptance rests on automated
Chromium/Firefox verification and qualitative historical comparisons.
Foreground owner interaction, actual screen-reader testing and a measured
typographic comparison were not performed.
Narrowly amended on 2026-11-13 by [ADR 0024](0024-bounded-tuple-union-for-scandicus-and-climacus.md):
four strictly descending survivors now normalize to a four-note Climacus
(see [Amendment](#amendment-stage-9b-2-owner-approved-2026-11-13)).

## Context

Pes subbipunctis (four notes) and Pes subtripunctis (five notes) are one
traditional family: a Podatus followed by two or three descending diamonds
(Mocquereau, Fig. 37–38; Sister Demetria, Lesson 22). ADR 0004 gives each kind
one fixed tuple. Two separate kinds would duplicate every domain, command,
layout and persistence rule and would make deletion from five to four notes a
change of kind. One arbitrary note array would lose the visible, bounded
cardinality that ADR 0004 protects.

## Decision

- Add one explicit kind, `pes-subpunctis`, whose `notes` is the union of
  exactly two fixed tuples: four or five `ChantNote`s. The contour is
  p0 < p1 > p2 > p3 (> p4); the tail may end below, at or above p0. Runtime
  validation checks length and contour. No count or variant field is stored;
  the displayed name derives from the tuple length.
- Construct the tuple only through a bounded helper (`pesSubpunctisNotes`) that
  rejects other lengths rather than truncating, padding or casting.
- Keep the semantic family separate from its two entry-tool variants
  (`pes-subbipunctis`, `pes-subtripunctis`), which map to the one kind.
- Discriminated kinds, stable note/neume identities and exhaustive handling
  stay as in ADR 0004. All other kinds keep a single fixed tuple. This ADR does
  not allow arbitrary-length neumes or generalize any other family.
- Deletion normalizes from the surviving contour: five to four stays this kind
  when valid, four to three becomes Torculus or Climacus when valid; anything
  else (equal adjacent pitches) is rejected. _Amended 2026-11-13:_ four strictly descending survivors become a four-note Climacus
  (see the amendment below); the original rule rejected them.
- Geometry reuses the approved Podatus and the Climacus diamond tail with
  pairwise disjoint pointer regions; no connector or apex stem is added.
- Mora (owner-approved): exactly **none** or **final note** for both
  cardinalities. The final note is the last note of the actual tuple (index 3
  or 4); the mark stays on that stable note ID. Final-two and every other
  nonempty subset are deferred until sufficient historical evidence and
  unambiguous engraving exist. Commands and native decoding reject them. Mora
  scope indexes are derived from the tuple length, so every prior pattern is
  unchanged. Evidence: a direct printed example for the four-note form
  (Mocquereau Fig. 37 no. 21); the five-note form follows the same final-note
  convention, supported by Gregorio and the shared descending-tail
  construction rather than a printed five-note example. See the
  [verification record](../verification/pes-subpunctis/README.md#mora-gate).
- Deletion never moves a mora: deleting an earlier note keeps a surviving
  final mark (valid in Pes subpunctis, Torculus and Climacus), and deleting
  the marked note removes the mark rather than transferring it.
- Native v7 introduces the kind; exact v1–v6 readers reject it.

## Consequences

### Positive

- One stable identity survives five-to-four deletion and transposition.
- Cardinality stays bounded and visible to TypeScript and runtime validation.
- The narrow scope leaves other families' fixed tuples untouched.

### Negative

- Consumers must handle a union tuple for this kind instead of indexing a fixed
  length; switches use the bounded helper.
- Older builds cannot read v7 files, including files without the new kind.
- Final-two and earlier-note morae cannot be authored for this family.

## Amendment (Stage 9B-2, owner-approved 2026-11-13)

[ADR 0024](0024-bounded-tuple-union-for-scandicus-and-climacus.md#amendment-to-adr-0023-owner-approved-2026-11-13)
introduces four-note Climacus. Deleting one Pes subtripunctis constituent now
normalizes to a four-note Climacus whenever the actual survivors strictly
descend and every surviving modifier is valid there. This covers first-note
deletion, and apex deletion with descending survivors. Identity, note order,
marks (including a final mora on its own note), B ownership and anchors are
preserved. Equal adjacent survivors remain rejected. The rest of this ADR is
unchanged.

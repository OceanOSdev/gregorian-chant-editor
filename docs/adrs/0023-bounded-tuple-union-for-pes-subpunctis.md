# 23. Allow a bounded union of fixed tuples for Pes subpunctis

Date: 2026-11-13

## Status

Proposed. Narrowly qualifies the fixed-cardinality rule of
[ADR 0004](0004-use-explicit-neume-types-and-ordered-tuples.md) for one named
family; ADR 0004 remains Accepted and is not superseded. Extends ADRs 0007,
0016 and 0018. ADR 0021's accidental ownership and scope are unchanged. The
owner agreed to begin this bounded-family approach in the Stage 9B-1
[plan](../plans/stage-9b1-pes-subpunctis.md); acceptance follows PR review.

**Open gate:** the mora matrix below is provisional (none-only) until the owner
decides the [mora gate](../verification/pes-subpunctis/README.md#mora-gate).

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
  else (four descending notes, equal adjacent pitches) is rejected.
- Geometry reuses the approved Podatus and the Climacus diamond tail with
  pairwise disjoint pointer regions; no connector or apex stem is added.
- Mora (provisional): none-only. Mora scope indexes are derived from the tuple
  length, so every prior pattern is unchanged. The proposed sourced matrix is
  {none, final note}; final-two is unresolved. See the gate record.
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
- Mora authoring is unavailable for the family until the gate is resolved.

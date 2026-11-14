# 25. Add four fixed compound directional four-note neumes

Date: 2026-11-13 (accepted 2026-11-14)

## Status

Accepted (owner-approved 2026-11-14 after review of draft PR #80 at
`9bb4564`). The owner approved all three gates of the Stage 9B-3
[plan](../plans/stage-9b3-compound-directional-neumes.md):

- **Gate A:** the recommended engraving profiles;
- **Gate B:** `{none, final}` mora, explicitly by analogy and Gregorio, not
  direct marked print;
- **Gate C:** the four fixed tuples, the deletion matrix, six split toolbar
  families and strict native v9.

The evidence, decisions and verification are in the
[reference record](../verification/compound-directional-neumes/README.md).
Implemented on the same branch; implementation acceptance is pending owner
review of the PR.

Extends [ADR 0004](0004-use-explicit-neume-types-and-ordered-tuples.md)
with four more single fixed-tuple kinds, so no qualification is needed. It
also extends ADRs 0007, 0016, 0018 and 0019. It does not amend or supersede
ADRs 0021–0024.

## Context

The Vatican-edition notation table (_Liber Usualis_, p. xxj) and Sister
Demetria (Lessons 18–21) name four common four-note figures. Each adds one
note to an existing three-note figure:

- Torculus resupinus;
- Porrectus flexus;
- Scandicus flexus;
- Climacus resupinus.

Liber repertoire contains them (pp. 361, 403, 1002). Their written forms
compose existing elements, except for two new porrectus joins.

## Decision

- Add four explicit kinds, each with one fixed four-note tuple in semantic
  order and strict **adjacent** directions:

  | Kind                 | Contour        |
  | -------------------- | -------------- |
  | `torculus-resupinus` | up, down, up   |
  | `porrectus-flexus`   | down, up, down |
  | `scandicus-flexus`   | up, up, down   |
  | `climacus-resupinus` | down, down, up |

  Nonadjacent pitches are unconstrained, as for Torculus/Porrectus. No count,
  variant, grouping or fusion field is stored. Existing kinds are unchanged.

- **Engraving (approved, Gate A).** Each kind uses one deterministic profile
  for all intervals, as printed in Roman/Solesmes sources:
  - Torculus resupinus: Punctum + porrectus (the punctum joined at the left
    stem's foot);
  - Porrectus flexus: porrectus whose terminal becomes a right-stemmed Clivis
    head;
  - Scandicus flexus: Pes + Clivis;
  - Climacus resupinus: three-note Climacus + detached Punctum.

  Torculus resupinus derives its stem from the actual pitches. The Porrectus
  left stem runs from the stroke's first pitch down to the leading Punctum's
  underside, whether the third note lies above, at or below the first. The
  ribbon itself may pass below the Punctum. There is no fixed stem-length
  adjustment. The ordinary Porrectus recipe is used unchanged when no
  Punctum precedes it.

  Existing geometry stays byte-identical. Documented alternatives (the Liber
  table's four-square Torculus resupinus and its Punctum + Torculus Scandicus
  flexus) are not selected.

- **Derived placement extension (owner-reviewed in PR #80 review, not a Gate
  A–C decision).** A crowded compound column may leave no ordinary
  vertical-episema candidate. Only in that case, and only for these four
  kinds, may the tick sit left of the note heads. Every placement the
  ordinary rule finds is unchanged. As with prefix accidentals,
  `buildNeumeGeometry` translates the group so that no ink lies left of the
  requested origin. Compaction, inter-neume spacing, lyric reflow, first-system
  placement and accidental clearance therefore see the tick as ordinary ink.

- **Forms and mora (approved, Gate B).** No authorable forms. Mora is
  `{none, final}`; final-two and earlier notes are deferred. No print shows a
  marked instance, so the rule rests on analogy and Gregorio. Existing episema
  contracts apply to every note.
- **Deletion (approved, Gate C).** Removing one constituent yields the
  three-note kind named by the surviving adjacent contour:

  | Surviving contour | Result    |
  | ----------------- | --------- |
  | `++`              | Scandicus |
  | `--`              | Climacus  |
  | `+-`              | Torculus  |
  | `-+`              | Porrectus |

  Any adjacent unison rejects. The neume ID, surviving note IDs, order and
  marks, lyric anchors, divisions and ADR 0021 accidental ownership are
  preserved. A mark is removed only with its own note. Older kinds' rules are
  unchanged.

- **Entry (approved, Gate C).** Torculus and Porrectus become split families
  (adding Torculus resupinus and Porrectus flexus). Scandicus flexus and
  Climacus resupinus join the existing Scandicus and Climacus menus. Entry
  variants are tool state, never persisted.
- **Native v9 (approved, Gate C).** v1–v8 readers reject the new kinds and are
  otherwise unchanged. v9 validates tuples, contours, marks and IDs.

## Consequences

### Positive

- Common figures become one atomic, selectable, lyric-anchored neume with
  traditional names. The model needs no new tuple machinery.

### Negative

- Every exhaustive seam gains four cases.
- Torculus resupinus and Porrectus flexus need new porrectus-derived geometry.
- Older app versions cannot read v9 documents.
- Deleting a note changes the kind, which is visible in labels and controls.

## Alternatives considered

- **Bounded unions on Torculus/Porrectus**, as in ADR 0024. Rejected: these
  figures change contour, not merely length, and Scandicus flexus/Climacus
  resupinus would cross families.
- **Separate adjacent neumes on one syllable.** Rejected: there is no
  intra-syllable grouping model, and it loses the single named figure.

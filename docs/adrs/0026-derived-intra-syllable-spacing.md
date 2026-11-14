# 26. Derive close spacing between independent neumes of one syllable

Date: 2026-11-14

## Status

**Accepted (owner-approved Gates A–D, 2026-11-14), after review of PR #82
at `d1665bb`.** Checkpoint 9C-1 alone is authorized for implementation.
Checkpoint 9C-2 and visual acceptance remain pending separate owner review.

Narrowly qualifies [ADR 0010](0010-derive-wrapping-from-music-and-lyric-geometry.md)'s
ordinary musical minimum and [ADR 0011](0011-word-aware-chant-engraving.md)'s
exclusion of melismatic neumes from contextual compaction. Extends
[ADR 0013](0013-divisions-interrupt-word-compaction.md)'s division barrier to
this new case. Those ADRs remain Accepted; none is superseded.

## Context

[ADR 0008](0008-anchor-lyrics-to-neumes.md) already derives membership from
ordered `startsAtNeumeId` anchors. The missing capability is close engraving
of independent neumes in that span, not a syllable domain model.

The [research record](../verification/intra-syllable-grouping/README.md)
includes actual Solesmes print crops, matched Gregorio excerpts, editing
walkthroughs, limitations and owner recommendations. Requiem's `et(hh)` is two
independent puncta with first-note lyric alignment and a clear gap around
0.33–0.46 head widths in print/reference evidence. Kyrie XI's Christe and last
Kyrie have independent dotted figures around an existing Pes subtripunctis.
Requiem's pé melisma contains a division without a new syllable. These examples
support closer independent engraving without requiring cross-neume fusion.
They do not establish one universal historical gap or exhaust authored cuts.

## Decision

- Retain anchor-derived membership, all 14 existing kinds and independent
  stable neume/note/syllable identities. No semantic fields, native version,
  migration, cache key change or automatic source rewrite. Preserve strict
  v1–v8 readers/recovery and current v9 output.
- Within a system, adjacent independent neumes with the same **non-null**
  derived syllable ID use a **6-unit minimum between complete measured ink bounds**.
  This engineering starting metric remains subject to visual acceptance,
  not an assertion that all printed pairs share its spacing. Complete
  modifier/sign/text clearance remains mandatory.
- Block this new compaction across divisions, explicit clefs and boundaries
  touching a neume with written accidental ink, including an earlier-note
  placement. Carried effective alteration alone is not written ink. Preserve
  independent score slots and ADR 0021 ownership, placement and scope.
- Keep ordinary gaps at new words and lyricless music. Keep ADR 0011's
  separate consecutive-syllable compaction and conditional hyphens intact.
  Require its complete measurement readiness; otherwise retain ordinary
  music-only fallback. Never merge two puncta into Bistropha implicitly.
- Preserve kind-specific lyric/vowel/manual anchors, internal contours and
  joins. Do not add cross-neume connectors or center the lyric over its span.
- Keep whole-neume wrapping, including across long syllables; repeat neither
  lyrics nor hyphens inside a melisma. Retain existing continuation behavior
  for a genuine later syllable, including the mark on the source lyric's
  system, exact-fit/oversized progress and custodes.
- Use one derived layout for measured ink/text, wrapping, midpoint-clipped
  pointer padding/selection, insertion slots and previews. Tight spacing must
  preserve constituent targets and stable focus. No post-render repositioning.
- Preserve commands, anchored-neume deletion, normalization and history.
  Existing Skip and explicit reassignment suffice initially; reassigning a
  lyric before deleting its former anchor remains two deliberate operations.
  No grouping tool, new selection hierarchy or group-wide operation.

## Alternatives considered

**Anchor model plus persisted boundary intent:** could preserve deliberate
large cuts such as Requiem's `//`. Defer until an approved authoring/facsimile
requirement identifies exact semantics, stable endpoints, mutation and stale
reference rules, UI and strict migration. Source syntax alone does not justify
new native data.

**Explicit collections or ownership replacement:** duplicates membership,
creates synchronization obligations and burdens independent music entry.
None of the inspected examples requires it.

**General fusion or arbitrary-length tuples:** conflates musical membership
with connected ink and bypasses existing kind invariants. A future fusion
proposal needs sourced pair/interval eligibility and explicit graphical/hit
ownership retaining stable identities. It is unnecessary for this first scope.

## Consequences

### Positive

Melismas become more compact using existing semantic capabilities. Native
compatibility and authoring remain stable, while one layout continues to own
rendering and interaction.

### Negative

Systems will repartition. Tight pointer targets and modifier clearance need
integrated verification. A single conservative gap will not reproduce every
editorial neumatic cut; accidentals deliberately limit initial eligibility.
The small raster corpus cannot settle all-kind proportions or fusion rules.

## Approval and follow-through

The owner approved A (unchanged semantics/v9), B (6-unit complete-ink metric,
barriers and wrapping), C (existing editing contracts) and D (two checkpoints
on the existing draft PR #82). Checkpoint 9C-1 covers pure classification/layout
and focused unit verification. Stop for review before 9C-2, which owns integrated
browser verification and the final repository gate. See the
[retained plan](../plans/stage-9c-intra-syllable-grouping.md) for current status.
Design acceptance does not establish visual or implementation acceptance.

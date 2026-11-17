# 28. Compose systems horizontally before resolving vertical lyric clearance

Date: 2026-11-16

## Status

**Accepted — owner-approved 2026-11-16.** Stage 11B is implemented on
`feat/dynamic-vertical-layout` (see the
[verification record](../verification/dynamic-vertical-layout/README.md));
foreground owner acceptance is pending. This narrowly qualifies the engraving
rules of [ADR 0021](0021-author-b-accidentals-at-neume-boundaries.md);
ADRs [0007](0007-share-derived-neume-engraving-geometry.md),
[0010](0010-derive-wrapping-from-music-and-lyric-geometry.md),
[0011](0011-word-aware-chant-engraving.md),
[0013](0013-divisions-interrupt-word-compaction.md) and
[0026](0026-derived-intra-syllable-spacing.md) remain Accepted. No semantic
or persistence decision is superseded.

## Context

Stage 11A introduced derived neume ledgers and bounded canvas containment.
The completed owner-authored Dominican Salve Regina (PR #92) still has a low
A at Je of Et Jesum that crowds the lyric row. Fixed 220-unit systems,
24-unit gaps and a 180-unit local lyric baseline cannot accommodate every
off-staff note, sign or guide.

Today the horizontal walker passes an AccidentalLyricBox into musical
geometry, shifts accidental-bearing neumes past preceding lyrics and uses
lyricBandAccidentals to reserve lyric and hyphen clearance. The assumed
baseline thus affects musical width and system membership. If the baseline
were computed from the resulting membership and fed back into the walker,
wrapping could change again. An iterative fixed-point solver is unnecessary
if the clearance responsibility is separated.

## Decision

- Compose horizontally with measured lyric widths, musical bounds, existing
  compaction, word boundaries, divisions, clefs, custodes and continuation
  marks. Musical geometry does not depend on the lyric baseline. A sign
  clears other musical ink, not lyric rectangles. The lyric row clears
  musical ink vertically instead of shifting a sign or its group horizontally
  solely for lyric clearance. This qualifies ADR 0021's requirement to respect
  lyrics without weakening its musical clearance or stable owner/anchor rules.
- Preserve music-to-music and text-to-text constraints, including existing
  continuation and oversized-text policy. Low accidental cases can intentionally
  become horizontally more compact; ordinary composition not affected by
  the removed exclusions retains its existing geometry and system membership.
- Resolve one shared lyric baseline per system below the complete renderable
  musical extent with explicit minimum clearance. Retain the ordinary local
  baseline of 180, staff geometry, minimum height of 220 and gap of 24 where
  no expansion is needed. High ink can require additional room above the staff;
  low ink can require a lower baseline and additional room below. Include
  staff, clefs, divisions, custodes, all authored appearances, ledger runs and
  modifiers. Reserve lyric ascent/descent and hyphen bounds, even in
  provisional layout. Use the existing conservative 20-unit ascent and 5-unit
  descent initially; verify the actual font and extend measured bounds if
  necessary.
- Compose in a common system-local coordinate frame, measure vertical
  requirements, then position systems sequentially from their resolved heights.
  No later phase changes the horizontal composition. Retain score-absolute
  public layout geometry and a single authoritative geometry path for rendering,
  pointer/keyboard interaction and previews. Do not scatter correction offsets
  through UI components.
- Preserve Stage 11A's 1,200-unit containment safeguard. Measure bounded
  renderable musical extents relative to the canonical staff/system, not an
  unbounded pitch-derived rectangle; distant valid notes must not allocate
  arbitrarily tall systems or paint into another system or its lyrics. Clip
  exceptional ink and associated pointer regions to a consistent per-system
  render band. Preserve the underlying semantic notes, full derived geometry
  where useful, compact ledger representation and keyboard access. This is a
  rendering safeguard, not a pitch restriction or a claim of faithful
  engraving at arbitrary safe-integer coordinates. The horizontal
  text-relative containment policy remains unchanged.
- No persisted vertical coordinates, schema version, semantic edits, history
  or clipboard changes. All metrics are derived. No change to the score width
  or staff scale.

## Consequences

### Positive

- No dependency cycle between lyric baseline, accidental placement and wrapping.
- Shared lyric rows remain legible and adjacent systems can clear each other.
- The layout has distinct composition, vertical measurement and positioning
  responsibilities without changing its public coordinate convention.
- Ordinary scores do not acquire unnecessary vertical whitespace.

### Negative

- Exceptional low accidentals can change horizontal spacing, hyphen decisions
  and system breaks compared with the former lyric-exclusion policy.
- Geometry, hit testing, placement, focus and printing must all use resolved
  per-system metrics; fixed-height assumptions cannot remain in consumers.
- Conservative lyric metrics may over-reserve space, and extreme coordinates
  still require clipping rather than unlimited expansion.

See the [Stage 11B plan](../plans/stage-11b-dynamic-vertical-layout.md) for
implementation and verification requirements.

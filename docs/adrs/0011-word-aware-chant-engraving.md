# 11. Word-aware compact spacing and derived continuation marks

Date: 2026-11-01

## Status

Accepted (2026-11-02), after the owner's visual review of
[Stage 4C PR #45](https://github.com/OceanOSdev/gregorian-chant-editor/pull/45).

This decision **qualifies only ADR 0010's fixed musical minimum between
eligible consecutive same-word syllables**. [ADR 0010](0010-derive-wrapping-from-music-and-lyric-geometry.md)
remains Accepted; it is **not superseded**. All other ADR 0010 contracts,
including derived whole-neume wrapping, measured lyric clearance, exact fit,
oversized progression and scrollable exceptional overhang, remain in force.
The owner accepted the current geometry-derived word composition as a
good-enough baseline, not a promise of publication-quality hyphenation or
a requirement to reproduce every GregoBase editorial choice. PR #45 remains
open until normal merge checks and owner merge.

## Context

Stage 4B ensured that separate lyric syllables did not overlap and that
musical layout/wrapping responded to their measured extents. Its 33-unit
ordinary inter-neume ink gap is conserved even when two short consecutive
syllables belong to one word. The results can look like `le lu ia`
when the user expects `leluia`. The semantic model already knows
`boundaryBefore: 'word' | 'continuation'`, and each syllable is anchored
to a neume ID; no other word entities are necessary.

In addition, music can force syllables of one word far apart, and the
editor currently has no conditional hyphens or outgoing continuation
marks when a word crosses a system break.

## Decision

- **Conditional compaction:** For consecutive neumes starting consecutive
  syllables of the _same semantic word_ (no intervening unanchored
  melismatic neumes), allow a contextual minimum horizontal separation
  smaller than the ordinary 33-unit ink gap. Derive that minimum from
  valid musical ink bounds, vowel-anchored lyric text extents, and a
  safe nonambiguous hit-testing policy. Keep neume internal geometry
  and lyric-to-musical anchors unchanged. Never compress unrelated
  neumes, melismas, word boundaries or lyricless scores. Fallback
  deterministically to the music-only rule without measurements.
- **Honest joining:** Aim for adjoining word text without overlap,
  using the same font and grapheme measurements as the rendered SVG.
  When safe neume separation prevents joining, do not force music to
  intersect or displace text from its musical anchor. Preserve the
  resulting gap and indicate continuation with a hyphen when warranted.
- **Conditional marks:** Generate punctuation only for two consecutive
  semantic syllables in the same word. Within one system, use actual
  measured distance and a documented font-relative joining threshold:
  contiguous text has no hyphen; visibly separated text receives a
  measured, pointer-inert hyphen. A real new word always has a
  space and no continuation hyphen. Neume count alone never determines
  hyphenation.
- **Across systems:** When the next syllable of the same word belongs
  to another system, render an outgoing hyphen on the preceding
  system, with measured room reserved in the wrapping process. No
  redundant incoming mark. A melisma spanning systems **without a
  new syllable** is not automatically split into syllables.
- **One authoritative layout:** Derived spacing, word relationships,
  rendered punctuation and system membership come from the same
  layout used for drawing and interaction. Measure hyphen glyphs in
  the existing font; reserve room as needed without post-render
  shifts or cyclic layout. Render decorations as aria-hidden and
  pointer-inert; keep each lyric separately focusable and editable.
  No persisted punctuation or additional semantic ownership.
- **Accessibility and reflow:** Keep stable neume/note/syllable IDs,
  hit target ownership, tab and semantic selection independence,
  drafts/history, pointer/ghost interaction, font loading
  fallback, and the existing exceptional scrollable overflow
  behavior. Visual selection cues remain behind, not between,
  glyphs and must not block an adjacent syllable.

The owner authorized implementation and visual exploration on the Stage 4C
branch, then accepted the resulting policy after reviewing the tested
rendering. A future change to the universal gap, hit-target distinction,
semantic model or materially different layout policy requires a new review.

## Consequences

### Positive

- Words can be read as words when the music permits.
- Hyphens indicate genuine musical separation and across-system
  continuation without altering the semantic chant document.
- Font/lyric measurements remain authoritative for both visible
  glyphs and layout.

### Negative

- Contextual musical advances and hyphen reservation add complexity
  and can alter system partitions compared with Stage 4B.
- Not every same-word sequence can be visually joined without
  compromising musical geometry and controls; the UI must show
  continuation rather than fake an impossible join.
- An interaction-safe minimum between neumes needs dedicated
  tests for every supported shape, at narrow viewport widths,
  and after font changes.
- Hyphen reservation interacts with wrapping. It requires a
  demonstrably bounded, stable placement algorithm.

## Alternatives considered

Keep the universal minimum and add hyphens everywhere: safe but
fails the owner's `leluia` continuity goal. Merge syllables into
one text element: obscures separate editor targets and may sever
vowel-to-neume alignment. Shift displayed text independently of
its musical anchor: contradicts the accepted lyric alignment
contract. Compress all neumes globally: alters music-only scores
and melismas and risks overlapping interactive contours. Store
hyphens or manual pixel offsets in the semantic document:
mistakes a layout choice for a chant fact.

## Acceptance and implementation evidence

After reviewing the Stage 4C PR #45 implementation, browser screenshots,
regression corpus and reference examples, the owner explicitly accepted this
geometry-derived baseline on 2026-11-02. The owner considers the visuals
**good enough for now**, while leaving further engraving polish open.

The [layout guide](../layout-and-rendering.md#stage-4c-word-composition)
documents exact spacing, pointer ownership, threshold, bounded reservation,
and overflow behavior. The [verification record](../verification/word-composition/README.md)
and [corpus review](../verification/word-composition/corpus-review.md)
document test coverage and measured rendering, including eight word examples
under five musical arrangements. This decision does not implicitly authorize
Stage 4D or change the semantic representation of syllables.

Two improvements are deliberately **deferred, not approved changes**:

1. A general editorial continuation/hyphen preference, or improved
   proportion-based punctuation, if future review warrants distinctions such
   as GregoBase `audi-ti-óne` versus our `auditi-óne`.
2. Tighter spacing/grouping between successive notes **within one syllable**,
   exemplified by `et(hh)` in the Requiem gradual; first-note vowel
   alignment remains the current rule.

See [auditione analysis](../verification/word-composition/auditione-review.md)
and [et/lux analysis](../verification/word-composition/et-lux-review.md).
Neither refinement is implemented or promised for this PR. Its remaining
step is the normal merge process; acceptance does not itself merge it.

# 10. Derive wrapping from combined music and lyric geometry

Date: 2026-11-01

## Status

Proposed. Intended to supersede [ADR 0005](0005-derive-wrapping-from-rendered-geometry.md)
**only if accepted by the owner** after implementation review. ADR 0005 remains
Accepted until then. This proposal is part of the approved Stage 4B design
direction, not an accepted change to the main branch yet.

## Context

ADR 0005 established whole-neume, measured-geometry wrapping. The current
implementation uses the shared derived neume ink bounds and advances
([ADR 0007](0007-share-derived-neume-engraving-geometry.md)); only afterward
does it attach separately measured, vowel-aligned lyric syllables. Consequently,
even valid text can collide, look disconnected, or extend beyond a system.
Stage 4A provided explicit lyric language, grapheme alignment overrides, and
measured SVG advances without moving music.

The owner approved lyric-aware spacing/wrapping in Stage 4B, followed by
conditional hyphenation and system-break marks in Stage 4C. The guiding
engraving principle is: *music determines alignment, lyrics influence minimum
spacing, and hyphens appear when needed to keep words readable*.

## Proposed decision

Use **one derived horizontal placement and wrapping process** that considers
(1) complete-neume shared ink geometry and existing musical minimum advances
and (2) measured lyric extents relative to their existing vowel/musical
anchors, including distinct-word minimum clearance. Extra room is introduced
between complete neumes as necessary, never by shifting a lyric off its
musical alignment anchor or changing a neume's internal engraving contour.

- Preserve ordered, indivisible neumes and the current kind-specific
  `lyricAnchorX` musical targets; preserve musical minimum spacing. Group
  neumes without a new lyric anchor remain in their syllable's melisma; do
  not introduce spacing between them solely because one syllable's text is
  wide.
- Evaluate lyric bounds with the same measured advances/segments and font
  policy used to render the text. Enforce a readable minimum gap between
  **distinct words**. For syllables of the **same word**, allow adjoining
  typography when geometry permits, but prevent overlap. Do not force words
  together by shrinking musical gaps; Stage 4C decides when remaining
  separation requires a hyphen.
- Reflow with the resulting combined occupied extents. Keep exact-fit,
  nonempty-system wrapping and oversized-single-item progress rules explicit;
  do not loop indefinitely, split a neume, or create a trailing empty system.
  Establish deterministic behavior for overlong/unbreakable syllables and
  staff-edge text overhangs, with no unannounced clipping.
- Use one shared pure layout decision for committed rendering, score-based
  hit testing, and semantic insertion-boundary resolution. Render previews
  as local caret/ghost feedback on the *actual displayed* committed layout;
  do not promise hypothetical full-system reflow on hover.
- All coordinates, word extents, system assignments, padding and optional
  future hyphen reservations remain **derived**; never persist them in
  `ChantDocument` or semantic history. Stable neume/note/syllable IDs,
  `startsAtNeumeId`, and explicit `boundaryBefore` remain unchanged.
- If browser font metrics are unavailable or not yet loaded, fall back to a
  deterministic music-only placement without guessed lyric widths; recompute
  from the current document when valid metrics become available. The actual
  renderer and its interaction resolvers must use the same layout snapshot,
  avoiding stale click coordinates.
- Do **not** generate hyphens, outgoing continuation marks, or new word
  entities in Stage 4B. Make the resulting lyric-edge and system-boundary
  information usable by Stage 4C without committing its policies early.

## Consequences

### Positive

- Horizontal layout uses actual text requirements rather than placing lyrics
  after music has already wrapped.
- Lyricless scores retain the current musical layout, and neumes preserve
  the approved ink/selection/anchor geometry.
- Word gaps and collision avoidance form a reliable basis for later
  conditional hyphenation and outgoing system-break marks.
- Music and lyrics reflow without changes to semantic identity or undo history.

### Negative

- Reflow can change when text, language, manual alignment or platform font
  metrics change; selection/focus and graphical placement must follow actual
  displayed systems.
- Async font measurement and conservative fallback create an intentional
  transition from provisional to measured layout.
- Long syllables may exceed a normal system even after wrapping. Their
  deterministic overflow and visibility behavior must be documented and tested.
- Combined geometry adds engraving complexity and requires visual browser
  verification beyond pure layout tests.

## Alternatives considered

Retain music-only wrapping and merely shift lyrics: cannot prevent text
collisions. Give the renderer authority to reposition text: breaks pure
derived-layout ownership and pointer/preview agreement. Persist per-syllable
pixel offsets or system membership: would make typography-dependent reflow
a semantic edit. Shrink the approved inter-neume gap to join syllable text:
alters accepted musical spacing to solve a lyric problem. Wrap whole words
as indivisible units: breaks ordinary chant melisma and the current
whole-neume interaction contract.

## Acceptance procedure

Stage 4B may be implemented **on its isolated feature branch** against this
clearly Proposed ADR, because the owner approved the Stage 4B direction. That
does not accept or supersede ADR 0005. During PR review the owner must confirm
the resulting engraving and architectural choice. Only **after** explicit
acceptance should this ADR be changed to Accepted, ADR 0005 be marked
Superseded with reciprocal links, and affected guides/ADR 0007 references be
reconciled, before merging. If the intended model changes materially during
implementation, stop and report the alternatives for approval.

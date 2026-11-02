# 10. Experiment with measured lyric clearances in derived layout

Date: 2026-11-02

## Status

Proposed. Implemented as an explicitly enabled experiment on `one-shot-test`.
[ADR 0005](0005-derive-wrapping-from-rendered-geometry.md) remains Accepted; this
record does not supersede it or claim adoption on the main branch.

## Context

The owner requested an autonomous, throwaway implementation probe into the future
editor, with no decision gates during this run. Existing independent lyric anchors
and measured vowel alignment can place long syllables on top of one another when
music alone determines horizontal advances. The Stage 4 plan identified lyric
clearance and continuation marks as future work requiring deliberate ADR review.

The probe must make that behavior concrete without silently redefining the
accepted layout API or persisting viewport geometry in the semantic document.

## Proposed decision

Explore a separate `lyricSpacing` layout option. The probe app enables it by
default and exposes a comparison toggle; `layoutChant` without that option and
`wrapNeumes` keep the music-only policy. Both policies share neume ink geometry and
the terminating whole-neume placement walk.

Under the experimental policy, measured aligned text adds minimum horizontal
clearances at its musical anchor. Word boundaries select distinct word gaps.
The same placement walk determines advances and wrapping; system membership,
text offsets and generated continuation hyphens remain derived. Oversized items
still advance the input and render in an expanded score viewBox; vertical bands
can expand for extreme pitches. Browser printing can break between those systems.
Graphical insertion must recompute against the same measurement lookup and option
used for the visible score.

Detailed constants, fallback behavior and derived data contracts belong in
[layout and rendering](../layout-and-rendering.md#experimental-lyric-aware-layout),
not this record. Review of the probe can lead to acceptance, revision or removal;
no change to the accepted ADR's status is implied by this implementation.

## Consequences

### Positive

- The branch can demonstrate music/lyric collision avoidance and readable word
  continuations without introducing word entities or persisted system ownership.
- Stable semantic identities and whole-neume insertion/history boundaries remain
  usable through lyric-driven reflow.
- Keeping the original API policy available enables comparison and regression
  checks against the accepted behavior.

### Negative

- Font measurement and language/alignment changes can now move music and systems
  when the option is enabled, increasing layout and interaction testing needs.
- The probe's simple clearances and hyphen thresholds are not a complete chant
  justification or publication-quality typography system.
- Oversized content can widen the entire score and shrink print scaling; this
  fallback preserves content but does not establish a final pagination design.
- The extra policy is experimental complexity that should be removed or adopted
  deliberately after evaluating the probe, rather than maintained indefinitely.

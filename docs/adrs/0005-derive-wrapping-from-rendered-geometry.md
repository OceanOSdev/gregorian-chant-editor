# 5. Derive wrapping from rendered geometry

Date: 2026-07-26

## Status

Superseded (2026-11-01) by [ADR 0010: Derive wrapping from combined music and lyric geometry](0010-derive-wrapping-from-music-and-lyric-geometry.md).

## Context

Different neume kinds use compact internal spacing, connectors, and raw
rendered bounds. Equal semantic note counts do not imply equal horizontal
width. System membership must also change when insertion or deletion changes
the available horizontal space.

This ADR was written retrospectively to record a decision already reflected in
the original implementation. Its whole-neume, exact-fit and stable-identity
invariants continue under ADR 0010; its music-only basis for system spacing
and wrapping has been replaced by combined music and measured-lyric geometry.

See [layout and rendering](../layout-and-rendering.md#automatic-whole-neume-wrapping)
for the current algorithm.

## Decision

Automatic wrapping is derived by measuring each complete neume with the same
raw geometry model used by committed notation and graphical previews.

Neumes remain indivisible. An exact fit stays on the current system. If a
candidate overflows a non-empty system, it begins the next system. If one
oversized candidate cannot fit on an empty system, it is placed alone and the
input advances, guaranteeing progress.

System ownership is not stored in `ChantDocument`. Layout preserves semantic
order and stable IDs while deriving each system and its global
`startNeumeIndex`.

## Consequences

### Positive

- Compact neumes and separately spaced notes wrap according to actual current
  engraving width.
- No neume is split between systems.
- Hypothetical placement previews can reuse the geometry and wrapping model to
  show the candidate's post-reflow destination.

### Negative

- Engraving changes can affect reflow and require wrapping regression tests.
- Insertion and deletion may move stable entities between systems.

## Alternatives considered

Wrapping by semantic note count would ignore compact spacing and connectors.
Persisting system ownership would make responsive reflow an edit to semantic
data. Splitting a neume would violate the current semantic and interaction
boundary that insertion positions exist only between complete neumes.

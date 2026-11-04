# 14. Preserve relative melody on initial clef edits

Date: 2026-11-03

## Status

Proposed. Records the Stage 6A implementation for owner review; it does not
accept or decide the future Stage 6B mid-score boundary model. No accepted ADR
is superseded.

## Context

The document stores staff-relative note positions and one initial clef value.
Changing the clef without moving noteheads would reinterpret the melody.
The Stage 6A owner-approved UX instead preserves relative diatonic identity.
This needs an explicit mapping without adding absolute octaves, chromatic pitch,
playback or a generalized event stream. ADRs 0002/0003 keep semantic data,
identity and derived graphics separate; ADR 0012 retains explicit division
boundaries and ADR 0013 governs their layout effects.

## Decision

For Stage 6A, retain a required singleton `Clef` value with type C or F and
staff line 1–4, numbered bottom to top. Give it no semantic ID. Repeat it as
derived system-start engraving and expose only its first copy as a score control.

Use one consistent relative diatonic register: base(C)=0 and base(F)=3.
Reference position is `2 * (staffLine - 1)`. A note's relative degree is
`base(type) + staffPosition - reference`. Preserve that degree with:

```text
newPosition = oldPosition
            + (oldBase - oldReference)
            - (newBase - newReference)
```

Translate all notes of every neume by this offset in the same immutable command
and history entry as the clef change. Retain IDs, kinds, intervals, lyrics,
anchors and division order. C3→C4 adds two steps; C3→F3 subtracts three.
No-op/invalid input returns the exact source document. Validate all pitches
before constructing the candidate, reject unsafe integer arithmetic and do not
clamp outside-staff positions. There is no pitch-reinterpretation mode in 6A.

## Deferred questions

Stage 6B must separately propose and obtain owner acceptance for ordering clef
events relative to divisions/neumes at the same boundary, adjacent events,
reanchoring on deletion, trailing/empty events, and the downstream range affected
by insertion/movement/removal. Effective wrapped-system clefs must eventually
follow semantic order, not rendered system indexes. This proposal establishes
none of those event fields or rules. Stage 6C insertion ghosts, horizontal
movement and dragging are also outside this decision.

## Consequences

### Positive

- Editing the initial clef preserves melody without introducing a second pitch
  representation or modifying existing division/lyric boundaries.
- One semantic snapshot makes undo/redo exact and atomic.
- Pure transforms can verify all clef pairs and every supported neume kind.

### Negative

- Stored staff positions change throughout the score, potentially producing
  pitches outside the staff and exposing existing missing-ledger-line and fixed
  vertical-bound limitations.
- Relative degrees are not absolute register, chromatic pitch or playback data.
- Mid-score changes still require architectural review and independent design.

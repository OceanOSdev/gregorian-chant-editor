# 6. Separate notation from playback

Date: 2026-07-28

## Status

Accepted (2026-11-17, with Audio 1 in PR #101). Proposed 2026-07-28.

## Context

One of the long-term goals of this project is to support audio playback of
Gregorian chant.

Unlike modern Western notation, Gregorian notation generally does not
prescribe precise rhythmic durations. Instead, the notation primarily conveys
melodic movement, while the exact performance depends on interpretive
tradition, textual accentuation, phrasing, and other musical considerations.

As the project grows, it is likely that multiple playback strategies will be
desirable. For example, a simple deterministic playback mode may be useful
during development, while more sophisticated playback modes could better
approximate real chant performance.

This raises an architectural question:

> Should playback timing be stored directly in the document model, or should
> it be derived from the notation?

## Decision

The `ChantDocument` domain model should remain purely notational.

The document should describe concepts such as:

- Clefs
- Staff positions
- Neumes
- Lyric syllables
- Bar lines
- Rhythmic markings (e.g. morae, episemata)

The document should **not** directly encode playback-specific information such
as:

- Absolute note durations
- Millisecond timestamps
- Tempo
- MIDI tick positions
- Any other implementation-specific timing information

Instead, playback should be performed by interchangeable **playback engines**
that interpret a `ChantDocument` and produce a performance suitable for audio
rendering.

Conceptually:

```text
           ChantDocument
                  │
                  ▼
          Playback Engine
                  │
                  ▼
        Performance Timeline
                  │
                  ▼
           Audio Renderer
```

Each playback engine is responsible for determining how the notation should be
interpreted for performance.

## Initial implementation (Audio 1)

The first engine is **Equal Note Playback** (`interpretEqualNotes`), a pure
function from a `ChantDocument` to a `Performance` for melodic proofreading.
It prioritizes simplicity and determinism over musical realism:

- one event per authored note, in semantic score order and each neume's tuple
  order, carrying stable note and neume IDs;
- pitch and B flat/natural taken from the existing effective-pitch resolver,
  mapped to sound through a playback-only register convention;
- the same base duration for every note;
- a fixed silence at each division between notes, longer for heavier
  divisions, derived from the same semantic score order. These are playback
  aids, not claims about historical performance;
- no time for clefs, and no timing from mora, episemata, liquescence, note
  forms or lyrics.

A separate Web Audio renderer schedules the `Performance`. The
[playback guide](../playback.md) owns the exact values, register convention,
event shape and lifecycle, so they can change without amending this ADR.

## Future playback engines

Separating notation from playback should make it possible to experiment with
additional playback engines without changing the document model.

Potential engines include:

### Equal Note Playback

A deterministic engine intended primarily for development, testing, and basic
listening. Implemented in Audio 1 (see above).

### Semiological Playback

Interprets rhythmic markings such as morae and episemata while remaining
deterministic.

### Solesmes-inspired Playback

Introduces traditional phrase shaping and gentle tempo flexibility.

### Speech Rhythm Playback

Uses textual accents, punctuation, and phrase structure to influence timing.

### Conducted Playback

Allows the user to control pacing interactively while the engine distributes
notes within each syllable.

### Humanized Playback

Applies subtle timing variation and expressive nuance to approximate live
performance.

## Engine interface

Audio 1 has a single engine, so no `PlaybackEngine` interface, registry or
plugin mechanism is introduced. The engine already has the shape such an
interface would take (`ChantDocument → Performance`). Introduce the
abstraction when a second engine actually exists, and shape it from both.

## Consequences

### Positive

- Maintains a clean separation between notation and performance.
- Allows new playback algorithms without modifying stored chant documents.
- Keeps playback independent of any particular audio backend.
- Simplifies testing by separating interpretation from rendering.
- Encourages experimentation with different chant traditions.

### Negative

- Playback requires an additional interpretation step.
- Different playback engines may legitimately produce different performances
  of the same score.
- Introduces additional architectural components compared to embedding
  durations directly into the document model.

## Open questions

Answered by Audio 1:

- The `Performance` representation is an ordered list of per-note events with
  stable IDs, resolved pitch and start/duration in seconds; silence is
  represented by gaps between events.
- The initial engine operates on notes, with divisions contributing pauses.

Still open:

- How mora, episemata and other rhythmic signs are interpreted (a separate
  milestone will set an explicit rhythmic interpretation policy).
- Whether later engines operate on syllables or phrases.
- Where playback preferences, such as tempo, should be stored.
- How closely future playback should model specific chant traditions.
- Whether real-time conducted playback should be supported.

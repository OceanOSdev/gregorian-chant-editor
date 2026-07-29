# ADR-005: Playback Architecture for Gregorian Chant

- **Status:** Proposed
- **Date:** 2026-07-28

## Context

One of the long-term goals of this project is to support audio playback of Gregorian chant.

Unlike modern Western notation, Gregorian notation generally does not prescribe precise rhythmic durations. Instead, the notation primarily conveys melodic movement, while the exact performance depends on interpretive tradition, textual accentuation, phrasing, and other musical considerations.

As the project grows, it is likely that multiple playback strategies will be desirable. For example, a simple deterministic playback mode may be useful during development, while more sophisticated playback modes could better approximate real chant performance.

This raises an architectural question:

> Should playback timing be stored directly in the document model, or should it be derived from the notation?

## Proposal

The `ChantDocument` domain model should remain purely notational.

The document should describe concepts such as:

- Clefs
- Staff positions
- Neumes
- Lyric syllables
- Bar lines
- Rhythmic markings (e.g. morae, episemata)

The document should **not** directly encode playback-specific information such as:

- Absolute note durations
- Millisecond timestamps
- Tempo
- MIDI tick positions
- Any other implementation-specific timing information

Instead, playback should be performed by interchangeable **playback engines** that interpret a `ChantDocument` and produce a performance suitable for audio rendering.

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

Each playback engine is responsible for determining how the notation should be interpreted for performance.

## Initial Implementation

If this proposal is accepted, the initial playback engine is expected to prioritize simplicity over musical realism.

The current idea is to implement an **Equal Note Playback** engine that assigns a uniform base duration to notes while introducing only minimal rhythmic interpretation (such as pauses at bar lines).

The specific behavior of this engine is intentionally left unspecified by this ADR and can evolve independently as implementation begins.

## Future Playback Engines

Separating notation from playback should make it possible to experiment with additional playback engines without changing the document model.

Potential future engines include:

### Equal Note Playback

A deterministic engine intended primarily for development, testing, and basic listening.

### Semiological Playback

Interprets rhythmic markings such as morae and episemata while remaining deterministic.

### Solesmes-inspired Playback

Introduces traditional phrase shaping and gentle tempo flexibility.

### Speech Rhythm Playback

Uses textual accents, punctuation, and phrase structure to influence timing.

### Conducted Playback

Allows the user to control pacing interactively while the engine distributes notes within each syllable.

### Humanized Playback

Applies subtle timing variation and expressive nuance to approximate live performance.

## Possible Interface

One possible abstraction could resemble:

```ts
interface PlaybackEngine {
  generatePerformance(document: ChantDocument): Performance;
}
```

where `Performance` represents a timeline of musical events consumed by an audio renderer.

The exact shape of this interface is intentionally left open until playback work begins.

## Consequences

### Advantages

- Maintains a clean separation between notation and performance.
- Allows new playback algorithms without modifying stored chant documents.
- Keeps playback independent of any particular audio backend.
- Simplifies testing by separating interpretation from rendering.
- Encourages experimentation with different chant traditions.

### Trade-offs

- Playback requires an additional interpretation step.
- Different playback engines may legitimately produce different performances of the same score.
- Introduces additional architectural components compared to embedding durations directly into the document model.

## Open Questions

The following questions remain intentionally unresolved:

- What intermediate representation should `Performance` use?
- Should playback engines operate primarily on notes, syllables, phrases, or a combination?
- Should playback preferences be stored per user, per document, or elsewhere?
- How closely should future playback attempt to model specific chant traditions?
- Should real-time "conducted" playback eventually be supported alongside automatic playback?

# Playback

## Scope

This guide owns the playback contract: how a `ChantDocument` becomes an
ordered performance, the playback-only register convention, the Web Audio
lifecycle, and the deliberate simplifications of Audio 1. Playback is for
melodic proofreading. It does not claim to reproduce an authentic chant
performance.

## Related documents

- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Editor interactions](editor-interactions.md#playback-controls-audio-1)
- [Testing](testing.md)
- [ADR 0006: Separate notation from playback](adrs/0006-separate-notation-from-playback.md)
  (Accepted)
- [ADR 0014: relative diatonic degrees](adrs/0014-preserve-melody-on-initial-clef-edit.md),
  [ADR 0015: score order](adrs/0015-order-clef-changes-at-score-boundaries.md),
  [ADR 0021: B accidentals](adrs/0021-author-b-accidentals-at-neume-boundaries.md)
- [Audio 1 plan](plans/audio-1-basic-melodic-playback.md)

## Data flow

```text
ChantDocument
    ↓  interpretEqualNotes (pure; reuses resolveEffectivePitches)
PerformanceResult → Performance (ordered PerformanceNote timeline)
    ↓  PlaybackController (one AudioContext, one session at a time)
schedulePerformance (Web Audio, scheduled on AudioContext.currentTime)
```

Playback reads the current document and never changes it. Nothing is added to
`ChantDocument`, its native schema, document history or the editor session.
Playback never reads layout, SVG or the DOM.

## Modules

All playback code lives in `src/editor/playback/`.

| Module                      | Owns                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `performance.ts`            | `Performance`/`PerformanceNote`/`PerformanceResult` types and the register convention      |
| `equal-note-performance.ts` | Equal Note Playback: the pure document-to-performance interpreter                          |
| `web-audio-synth.ts`        | Scheduling one performance on a minimal structural subset of the Web Audio API             |
| `playback-controller.ts`    | Audio context creation/resume, session invalidation, stop, dispose and reported state      |
| `use-playback.ts`           | React glue: interprets the current document, stops on document change, disposes on unmount |

`components/PlaybackControls.tsx` renders Play, Stop and the status text just
above the sticky toolbar, in normal page flow, and pins them to the viewport
while playing if that place is scrolled away (see
[editor interactions](editor-interactions.md#playback-controls-audio-1)).
`ChantEditor` only passes it the current document.

## Performance model

A `Performance` is an ordered list of `PerformanceNote`s and a total duration.
Each note carries its stable `noteId` and `neumeId`, the resolved relative
`degree` and `alteration`, an audition `midiNote`, and `startSeconds` and
`durationSeconds` relative to the start of the performance.

`interpretEqualNotes(document)`:

- emits exactly one event per authored note, in semantic score order
  (`deriveScoreOrder`) and each neume's `notes` tuple order, so repeated-note
  neumes give distinct consecutive events. It handles every neume kind
  generically through its tuple;
- takes degree and alteration only from `resolveEffectivePitches`, so initial
  and mid-score clefs, register-specific B flats/naturals, scope resets at
  words and divisions, and earlier-placed signs match the editor exactly;
- gives every note `equalNoteDurationSeconds` (0.4 s);
- does not sound clefs or divisions. Clefs add no time; divisions add a
  pause, below.

### Division pauses

Walking the same `deriveScoreOrder`, each division between two notes adds
silence before the next note, in note lengths (`divisionPauseNotes`):

| Division         | Pause (note lengths) | At 0.4 s per note |
| ---------------- | -------------------- | ----------------- |
| Minima (quarter) | 0.5                  | 0.2 s             |
| Minor (half)     | 1                    | 0.4 s             |
| Maior (full)     | 2                    | 0.8 s             |
| Finalis (double) | 3                    | 1.2 s             |

- Several divisions at one boundary pause once, for the longest of them.
  Separate boundaries each add their own pause.
- Divisions before the first note or after the last note add nothing, so
  playback starts and ends without silence.
- A pause always falls between neumes, never inside one.

These are deterministic playback aids that make phrase structure audible.
They are not claims about historical performance practice.

It returns an explicit failure rather than a partial or adjusted performance:

- `invalid-score` when accidentals are invalid, score order or pitches cannot
  be resolved, or the resolved notes do not match the authored notes one for
  one;
- `pitch-out-of-range` (with the note ID) when a note falls outside MIDI 0–127.
  Pitches are never clamped or transposed.

An empty score is a valid, empty performance; the UI reports "No notes to
play." and Play does nothing.

## Register convention

The notation fixes only relative diatonic pitch ([ADR 0014](adrs/0014-preserve-melody-on-initial-clef-edit.md)):
`degree = staffPosition + clefOffset(clef)`, with degree 0 = do. Playback maps
degrees onto a C-major lattice, `[0, 2, 4, 5, 7, 9, 11]` semitones per octave,
with **degree 0 = C4 (MIDI 60)**, so fa (degree 3) is F4 and the B register
(degree 6) is B4. Octaves use floor division, so degree −1 is B3 and −8 is B2.
The effective alteration (−1 for a flat) is applied after the diatonic step.
Frequencies use equal temperament with A4 = 440 Hz, computed only in the
audio renderer.

This is a stable audition register, not a claim that the source fixes an
absolute pitch. Any change to the convention must be stated explicitly in its
PR.

## Audio rendering

`schedulePerformance` schedules the whole performance up front on the audio
clock, 50 ms after `currentTime`. It uses one monophonic triangle oscillator:
each note sets the frequency at its start and has its own envelope (15 ms
attack, hold, 50 ms release, then 40 ms of silence before the next note), so
repeated pitches are heard separately. Envelope gain feeds a constant output
gain. There is no per-note browser timer; the oscillator's scheduled `stop`
and `ended` event mark the natural end.

Stop cancels the output gain's schedule and fades it to silence over 30 ms,
then stops the oscillator.

## Lifecycle

- The `AudioContext` is created lazily and resumed inside the Play click, so
  browsers' autoplay rules are met. One context is reused for later plays and
  replaced only if it was closed.
- Play first stops any current session; at most one session sounds. Play is
  inert while playback is starting or playing.
- Every play or stop invalidates earlier sessions, so a late `resume()` or
  `ended` callback cannot start sound or change the status.
- Any change of the current document (edit, undo/redo, load, import or New)
  stops playback.
- Unmounting stops playback and closes the context.
- A missing Web Audio API, a refused `resume()`, a context that stays
  suspended, or a scheduling exception is reported as a status message.
  Nothing is thrown to the editor.

## Audio 1 simplifications

Deliberately not interpreted: mora, horizontal and vertical episemata,
liquescence, quilisma and other note forms, lyric accents, phrasing and tempo.
Mora and other rhythmic signs await a separate milestone with an explicit
rhythmic interpretation policy. There is no speed control, pause/resume, seek, play from
selection, note highlighting, looping, or stored audio preference.

If the operating system or browser suspends a running context mid-playback,
the status remains "Playing" until Stop is pressed.

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
- [Editor interactions](editor-interactions.md#playback-controls)
- [Testing](testing.md)
- [ADR 0006: Separate notation from playback](adrs/0006-separate-notation-from-playback.md)
  (Accepted)
- [ADR 0014: relative diatonic degrees](adrs/0014-preserve-melody-on-initial-clef-edit.md),
  [ADR 0015: score order](adrs/0015-order-clef-changes-at-score-boundaries.md),
  [ADR 0021: B accidentals](adrs/0021-author-b-accidentals-at-neume-boundaries.md)
- [Audio 1 plan](plans/audio-1-basic-melodic-playback.md) and
  [Audio 2 plan](plans/audio-2-navigation-and-follow-along.md)

## Data flow

```text
ChantDocument (+ editor selection, read when Play is pressed)
    ↓  interpretProofreadingPlayback (pure; reuses resolveEffectivePitches)
PerformanceResult → Performance (ordered PerformanceNote timeline)
    ↓  performanceFrom + performanceAtSpeed (pure; Audio 2)
Performance actually played
    ↓  PlaybackController (one AudioContext, one session at a time)
schedulePerformance (Web Audio, scheduled on AudioContext.currentTime)
    ↓  elapsedSeconds() on the audio clock → activeNoteAt (pure)
SoundingNoteStore → note cue (NoteControl) and follow scrolling
```

Playback reads the current document and selection and never changes them.
Nothing is added to `ChantDocument`, its native schema, document history or
the editor session. Musical timing never reads layout, SVG or the DOM; only
the follow scrolling measures rendered note geometry, by stable note ID.

## Modules

All playback code lives in `src/editor/playback/`.

| Module                        | Owns                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `performance.ts`              | `Performance`/`PerformanceNote`/`PerformanceResult` types and the register convention                                                                   |
| `proofreading-performance.ts` | Proofreading Playback: the pure document-to-performance interpreter                                                                                     |
| `web-audio-synth.ts`          | Scheduling one performance on a minimal structural subset of the Web Audio API                                                                          |
| `playback-controller.ts`      | Audio context creation/resume, session invalidation, stop, dispose and reported state                                                                   |
| `performance-navigation.ts`   | Pure Audio 2 transforms: start from a selection, rebase, speed scaling, sounding-note lookup                                                            |
| `sounding-note.ts`            | Per-editor presentation store of the sounding note ID and the per-note subscription hook                                                                |
| `use-playback.ts`             | React glue: interprets the current document, plays a rebased/scaled performance, samples the audio clock, stops on document change, disposes on unmount |

`components/PlaybackControls.tsx` renders Play, Stop and the status text at
the end of the sticky toolbar's Quilisma figure row (see
[editor interactions](editor-interactions.md#playback-controls)).
`ChantEditor` passes it the current document through the palette's
`figureRowEnd` slot.

## Performance model

A `Performance` is an ordered list of `PerformanceNote`s and a total duration.
Each note carries its stable `noteId` and `neumeId`, the resolved relative
`degree` and `alteration`, an audition `midiNote`, and `startSeconds` and
`durationSeconds` relative to the start of the performance.

`interpretProofreadingPlayback(document)` (**Proofreading Playback**):

- emits exactly one event per authored note, in semantic score order
  (`deriveScoreOrder`) and each neume's `notes` tuple order, so repeated-note
  neumes give distinct consecutive events. It handles every neume kind
  generically through its tuple;
- takes degree and alteration only from `resolveEffectivePitches`, so initial
  and mid-score clefs, register-specific B flats/naturals, scope resets at
  words and divisions, and earlier-placed signs match the editor exactly;
- gives every note one base note (`baseNoteSeconds`, 0.4 s), or two when that
  note carries a mora (below);
- does not sound clefs or divisions. Clefs add no time; divisions add a
  pause, below.

### Division pauses

Walking the same `deriveScoreOrder`, each division between two notes adds
silence before the next note, in base note lengths
(`divisionPauseNoteLengths`):

| Division         | Pause (base notes) | At 0.4 s per note |
| ---------------- | ------------------ | ----------------- |
| Minima (quarter) | 0.5                | 0.2 s             |
| Minor (half)     | 1                  | 0.4 s             |
| Maior (full)     | 2                  | 0.8 s             |
| Finalis (double) | 3                  | 1.2 s             |

- Several divisions at one boundary pause once, for the longest of them.
  Separate boundaries each add their own pause.
- Divisions before the first note or after the last note add nothing, so
  playback starts and ends without silence.
- A pause always falls between neumes, never inside one.

These are deterministic playback aids that make phrase structure audible.
They are not claims about historical performance practice.

### Mora

A note with `mora: 1` lasts `moraNoteLengths` (2) base notes, 0.8 s. Marks
belong to individual note IDs ([ADR 0018](adrs/0018-conventional-mora-patterns.md)),
so the interpreter reads each note's own flag:

- an auctum duplex (a final pair of marked notes) lengthens each of its two
  notes individually. There is no additional group multiplier, and the
  unmarked notes of the neume are unchanged;
- a division pause after a lengthened note follows its full doubled length;
- pitch, order and identities are unchanged;
- a neume whose mora data is outside the supported profile (`getMoraScope`
  returns null, e.g. `mora: 2` or an unsupported pattern) makes the score
  `invalid-score`. It is never coerced.

The document still stores only the presence flag; the doubling is a
playback-only policy owned here.

The engine is named **Proofreading Playback**: a deterministic interpretation
for checking a melody, not the semiological or performance-practice engines
ADR 0006 anticipates.

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
- Play first stops any current session; at most one session sounds. While
  playback is starting or playing, the toggle is Stop and "Play from
  beginning" is inert.
- Every play or stop invalidates earlier sessions, so a late `resume()` or
  `ended` callback cannot start sound or change the status.
- Any change of the current document (edit, undo/redo, load, import or New)
  stops playback.
- Unmounting stops playback and closes the context.
- A missing Web Audio API, a refused `resume()`, a context that stays
  suspended, or a scheduling exception is reported as a status message.
  Nothing is thrown to the editor.

## Navigation and follow-along (Audio 2)

### Starting point

`resolvePlaybackStart(document, selection)` reads the editor selection once,
when Play is pressed:

| Selection                   | Starts on                                                   |
| --------------------------- | ----------------------------------------------------------- |
| Note                        | That note, even in the middle of a neume                    |
| Neume                       | Its first note                                              |
| Neume range                 | The first note of its earliest neume in score order         |
| Lyric syllable              | The first note of the neume it is anchored to (`findNeume`) |
| Anything else, or stale IDs | The beginning                                               |

`performanceFrom(performance, noteId)` keeps the events from that note on and
rebases them so it starts at 0 s. Nothing before it sounds, including a
division pause that preceded it. Later notes keep their exact relative
timing (mora lengths and division pauses).

The Playback options include "Play from beginning", which ignores the
selection. Changing the selection during playback does not move the audio;
Stop and Play picks up the new start. A document change still stops playback.

### Speed

The options offer 0.5×, 0.75×, 1× (default), 1.25× and 1.5×.
`performanceAtSpeed` divides every start, duration and the total by the
speed, so notes, mora lengths and division silences scale together; pitches
and IDs are unchanged.

- The speed is chosen before Play. While playing, the choice is disabled with
  a note; nothing is time-stretched mid-playback.
- It is transient UI state: not stored in the document, history,
  localStorage or anywhere else.

### Sounding note

- **Timing source.** `ScheduledPerformance.startTime` is the audio-clock time
  of the performance's 0 s. It is the only place the 50 ms scheduling
  headroom lives.
- **Elapsed time.** `PlaybackController.elapsedSeconds()` returns
  `currentTime − startTime` for the current session, or null when nothing is
  scheduled. After stop, natural end, failure or dispose it is null.
- **Sampling.** While playing, `usePlayback` runs one `requestAnimationFrame`
  loop that samples this time and calls `activeNoteAt(performance, elapsed)`
  on the performance actually played.
- **Lookup.** `activeNoteAt` is a binary search over half-open note
  intervals. It returns null before the first note, in silences between
  events (division pauses) and after the end. A 1 ns tolerance closes
  floating-point seams between back-to-back notes, so the cue never blinks
  off there.
- **Store.** The result goes into a per-editor `SoundingNoteStore`, which
  notifies only on change. Each `NoteControl` subscribes, through
  `useSyncExternalStore`, to whether _it_ is sounding, so a change re-renders
  only two notes and never recomputes the layout. Repeated notes advance by
  stable note ID.
- **Clearing.** Stop, natural end, document change, failure and unmount end
  the loop and clear the store. A later session cannot revive an old cue,
  because time comes only from the current session.

The cue is a broad translucent halo on the notehead, drawn under the thin
selection outline, so the two remain distinct when they coincide. It has
`pointer-events: none` and `aria-hidden`, and adds no role, focus,
`aria-pressed` or history entry. It is hidden in print.

### Follow scrolling

`useFollowSoundingNote` (rendering layer) reveals the sounding note with the
shared `revealElement`. The same measured, minimal, container-by-container
reveal underlies keyboard focus, but it never focuses or selects.

- **Usable area:** the page area below the sticky toolbar (when it sticks)
  and the horizontally scrollable score viewport.
- **First note:** the first sounding note of each playback is revealed.
- **Later notes:** the next note is revealed only while the previous sounding
  note is at least partly on screen (`isElementOnScreen`). If the reader
  scrolls the sounding note away, following pauses instead of fighting them,
  and resumes when it is visible again. Division-pause silences do not reset
  this.
- **Behaviour:** reveals are instant, so there is no animation for
  reduced-motion preferences to affect. Notes already visible cause no scroll.

`revealElement` converts a container's client box with its measured CSS
`zoom` factor. Without zoom the factor is 1 and behaviour is unchanged. This
also corrects keyboard focus reveal inside a zoomed score viewport.

## Simplifications

Deliberately not interpreted: horizontal and vertical episemata, liquescence,
quilisma and other note forms, lyric accents, phrasing and rubato. Mora is
limited to the doubling above. There is no pause/resume, seeking, looping,
mid-playback speed change, playback position persistence or stored audio
preference.

If the operating system or browser suspends a running context mid-playback,
the status remains "Playing" until Stop is pressed.

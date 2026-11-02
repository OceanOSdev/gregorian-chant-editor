# Experimental playback

## Scope

The `one-shot-test` probe includes browser playback as a listening aid for the
supported seven-neume notation profile. This follows the separation explored in
[Proposed ADR 0006](adrs/0006-separate-notation-from-playback.md) without marking
that proposal accepted for the main project. The sound is a synthesized,
organ-like tone. It is not sung chant, a recording, or a historically informed
rhythmic performance.

## Controls and browser behavior

Press **Play** to start audio. Playback requires this explicit user gesture;
loading the page does not start sound. **Pause** and **Stop** control the current
run. Pause retains the exact audio-clock offset; Resume continues from that
position within the note. Stop resets to the beginning. Completion leaves the
playhead at the total duration and the interface Ready; the next Play starts at
zero. Tempo controls equal notes per minute, with an interface range of 40–180;
volume changes loudness. **Register** offers Lower octave, Written octave and
Higher octave (−12, 0 and +12 semitones) without rewriting the score.

The moving playback highlight identifies the sounding note independently of
semantic selection and keyboard focus. The optional **Follow** behavior keeps
that note visible. It does not select or edit notes. Playback controls and the
playhead are transient browser-session state: they do not enter document history,
chant JSON, browser document recovery, or GABC export.

Changing the semantic document, including history navigation or opening another
chant, stops the current run. Changing tempo or octave also stops it, so the next
Play uses one consistent interpretation of the current score and controls. Visual
reflow alone does not change the musical note order. Unsupported browser audio
or start failures are reported in the interface. A muted tab, muted device, or
unavailable audio output remains outside the editor's control.

## Pure performance interpretation

`src/editor/playback/performance.ts` owns the pure `createPerformance` function.
It consumes `ChantDocument`, tempo and semitone transposition and returns derived
events; it has no dependency on React, SVG, the DOM, Web Audio or system layout.
Each `PerformanceNote` carries the original `noteId` and `neumeId`, MIDI pitch,
frequency, start time and duration. `Performance` carries the ordered events and
total duration. Time values are seconds.

The current engine:

- flattens the semantic neume order and each neume's note tuple without grouping
  by rendered staff or syllable;
- identifies the C-clef line as middle C (MIDI 60), then maps written staff steps
  to natural diatonic pitches above and below that line;
- uses A4 = 440 Hz in equal temperament, with the listening transposition applied
  in semitones after the diatonic mapping;
- assigns each written note `60 / tempo` seconds, including repeated pitches;
- assigns event starts from `index * duration`, with no inferred word/syllable
  pauses or rhythmic weighting;
- returns no events and zero duration for an empty score.

The pure API accepts finite tempos from 30 through 240 and integer transpositions
from −24 through +24, a wider range than the initial interface exposes. The
resulting MIDI pitch must be in A0–C8 (21–108). Invalid settings, malformed pitches
or unsupported clefs produce explicit errors rather than silently changing a
pitch. These playback limits are independent of the broader file/notation limits.
The input document and its stable identities remain unchanged.

## Audio and notation boundary

`playback/audio-player.ts` consumes this derived performance and schedules sound
using the Web Audio clock and a short lookahead window. It owns the oscillators,
gain envelopes, transport clock and audio context. Pausing/stopping cancels active
voices; disposal also closes the context. `playback/use-playback.ts` coordinates
the React transport state and invalidates a run when the document or playback
interpretation changes. `components/PlaybackControls.tsx` renders its controls. `ChantEditor` supplies the
current semantic score and renders the playhead as presentation state. No browser
audio objects or timing data belong in `ChantDocument`, commands, layout data or
semantic history.

This keeps written notation reusable by a later playback interpretation without
changing file schema version 1. The tone's attack/release envelope is an audio
rendering choice and does not author note durations into the score. Passive
SVG/print output remains a notation export rather than a record of transport
state.

## Limits and verification

The current engine does not infer chant rhythm, accent, breath, phrase shape,
liquescence, morae, episemata, accidentals or expressive timing. There is no vocal
synthesis, imported recording, MIDI-file export or audio-file export. Unsupported
notation is not fabricated by playback.

`performance.test.ts` checks C-clef mapping, natural pitches across octaves,
semantic ordering and IDs for all seven neume kinds, repeated-note timing,
transposition, empty scores, rejection paths and nonmutation. Browser audio,
transport and highlight verification must be reported separately through the
[testing workflow](testing.md); the pure tests do not establish that a physical
speaker produced sound. Background-tab throttling or unavailable output devices
can also affect a browser listening session. Broader browser and assistive-technology acceptance
remains separate from this probe.

Playback pauses when the tab becomes hidden, avoiding gaps from background timer
throttling. Returning to the tab does not restart sound automatically; press
Resume. A browser interruption preserves the position when possible and reports
a visible error.

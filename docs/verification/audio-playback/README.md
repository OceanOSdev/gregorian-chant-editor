# Audio playback verification (Audio 1)

The [playback guide](../../playback.md) owns the contract. This record covers
what automated checks prove, what they cannot prove, and the dated results.

## Automated checks

Vitest (no browser, no audio device):

- `src/editor/playback/equal-note-performance.test.ts`: the degree→MIDI
  register across octave boundaries and negative degrees; one event per note in
  tuple order for every neume kind, with stable IDs; repeated notes as distinct
  equal events; divisions and clefs are not sounded; initial and mid-score C/F
  clefs; melody-preserving initial and mid-score clef edits; scoped B flats and
  naturals, register isolation, word and every division reset, no reset at a
  clef change, and earlier-placed signs; explicit failures for invalid order,
  duplicate IDs, invalid accidentals, unsafe and out-of-range pitches; every
  bundled example note for note.
- `web-audio-synth.test.ts` and `playback-controller.test.ts` use recording
  fakes of the Web Audio objects. They cover scheduling on the audio clock,
  per-note envelopes returning to silence, prompt fading stop, natural end,
  context creation and resume in the gesture, restart without overlap, stop
  before resume, stale-session callbacks, empty performances, an unavailable
  or refused/suspended context, dispose, and replacing a closed context.

Browser driver `audio-playback/browser-check.mjs` (runner driver
`audio-playback`; production preview; Chromium/CDP and Firefox/BiDi):

- It wraps `AudioContext` to record the scheduled oscillator frequencies and
  start/stop calls, and taps the signal reaching `AudioDestinationNode` with
  an `AnalyserNode`.
- Play and Stop are clicked with real pointer input, so the browser grants
  user activation.
- Kyrie XI: the context is `running`; one oscillator has one frequency event
  per authored note, all finite; output peak is above 0.02 while playing.
  Play is inert while playing and creates no second oscillator.
- Stop: the status is idle at once, the oscillator has ended, and the output
  peak is exactly 0 afterwards. Restart reuses the single context with one
  active oscillator.
- Changing the initial clef during playback stops it with silent output; Undo
  restores the score. Loading Dies Irae during playback stops it; Dies Irae
  then plays with one event per note and non-silent output, without
  horizontal scrolling at 320px.
- A one-note chant schedules one note and returns to idle by itself.
- After New, the status reads "No notes to play." and Play creates nothing.
- With `AudioContext` removed on a fresh page, Play reports "not available"
  without page errors or unhandled rejections.

A peak above zero proves the browser rendered a signal. It does not prove
that the pitches, timbre or envelope sound right to a listener.

```sh
npm run verify:browser -- --driver audio-playback --browser both
```

## Results (2026-11-17)

Linux x64, Node 24.12.0, Chromium 157.0.8103.38 (snap), Firefox 146.0,
headless, runner-owned preview servers, on the Audio 1 working tree that was
committed as the implementation.

- `audio-playback`: **Chromium pass, Firefox pass.** Output peak while
  playing ≈ 0.199 for both Kyrie XI and Dies Irae in both browsers; peak after
  Stop 0. Status became idle 21 ms (Chromium) and 52 ms (Firefox) after the
  Stop click, measured as driver round-trip time.
- Vitest: 109 files, 2,499 tests pass (69 in `src/editor/playback/`).
- `format:check`, `lint`, `build` and `git diff --check` pass.
- Full matrix (`--preset full --browser both -j 2`, 720 s): 45 passed,
  7 failed, 6 unsupported. Six failures are pre-existing and fail
  identically on clean `master` (`f033976`): `lyric-move`, `lyric-spacing`
  and `note-modifiers` in Chromium, `lyric-spacing-selection-cue` in Firefox,
  and `word-composition` in both.
- **New failure: `dynamic-vertical-layout` in Firefox, `safe-integer 320: rect
hit`.** It passes on `master` and in Chromium. At 320px, headless Firefox
  resets the driver's `scrollBy` to the position left by its native Tab focus
  scroll. This also happens on `master` for the ordinary and high cases. For
  the extreme safe-integer clef, that position is on-screen on `master` but
  off-screen once the playback row adds height above the score. A 1 s wait
  and disabling `overflow-anchor` did not change the result. The driver is
  left unchanged pending owner review.
- An earlier revision placed Play/Stop inside the sticky toolbar. That made
  the toolbar one row taller at 320px and broke `extended-scandicus-climacus`
  (both browsers), whose hover points fell under it. The controls now sit
  above the sticky toolbar, and that driver passes.

## Listening (manual)

**Not run by the implementing agent**, which cannot hear audio. Owner
listening is pending, in Chromium and Firefox:

- Kyrie XI and Pater Noster: the melody sounds as written. B flats are heard
  where the score shows them, and repeated notes are audibly separate.
- Dies Irae: plays to the end, or until Stop, without stuck notes, clicks or
  overlap.
- Play, Stop, Play again; edit or load another example during playback. Each
  stops cleanly.

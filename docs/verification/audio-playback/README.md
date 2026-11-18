# Audio playback verification (Audio 1)

The [playback guide](../../playback.md) owns the contract. This record covers
what automated checks prove, what they cannot prove, and the dated results.

## Automated checks

Vitest (no browser, no audio device):

- `src/editor/playback/equal-note-performance.test.ts`: the degree→MIDI
  register across octave boundaries and negative degrees; one event per note in
  tuple order for every neume kind, with stable IDs; repeated notes as distinct
  equal events; divisions and clefs are not sounded; division pauses per
  kind (0.5/1/2/3 note lengths), the longest pause at a shared boundary,
  separate boundaries accumulating, no leading or trailing silence, clefs
  adding no time, and pauses only between neumes; initial and mid-score C/F
  clefs; melody-preserving initial and mid-score clef edits; scoped B flats and
  naturals, register isolation, word and every division reset, no reset at a
  clef change, and earlier-placed signs; explicit failures for invalid order,
  duplicate IDs, invalid accidentals, unsafe and out-of-range pitches; every
  bundled example note for note.
- `web-audio-synth.test.ts` and `playback-controller.test.ts` use recording
  fakes of the Web Audio objects. They cover scheduling on the audio clock,
  per-note envelopes returning to silence, silence through a division pause,
  prompt fading stop, natural end,
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
  restores the score. Loading Dies Irae during playback stops it.
- Dies Irae then plays with one event per note and non-silent output. Every
  gap between scheduled notes is exactly 1, 1.5, 2, 3 or 4 note lengths (a
  note, or a note plus one division pause), and some gaps are pauses.
- Stop stays reachable during Dies Irae at 1440×1000 and 320×900. Scrolled to
  the top, the Playback group is in place. Scrolled to the bottom, it is
  pinned, and Stop is fully in the viewport and topmost at its centre. The
  sticky toolbar height is unchanged and there is no horizontal scroll. Stop
  is then pressed with a real click at its pinned position, and the group
  unpins.
- A one-note chant schedules one note and returns to idle by itself.
- After New, the status reads "No notes to play." and Play creates nothing.
- With `AudioContext` removed on a fresh page, Play reports "not available"
  without page errors or unhandled rejections.

A peak above zero proves the browser rendered a signal. It does not prove
that the pitches, timbre or envelope sound right to a listener.

```sh
npm run verify:browser -- --driver audio-playback --browser both
```

## Results (2026-11-17, owner-review revision)

Linux x64, Node 24.12.0, Chromium 157.0.8103.38 (snap), Firefox 146.0,
headless, runner-owned preview servers, on the working tree committed as the
owner-review revision of PR #101.

- `audio-playback`: **Chromium pass, Firefox pass.**
  - Output peak while playing ≈ 0.199 for Kyrie XI and Dies Irae; 0 after
    Stop.
  - Status idle 12 ms (Chromium) and 46 ms (Firefox) after the Stop click
    (driver round-trip).
  - Dies Irae schedules 57 division pauses.
  - Pinned Stop is visible, topmost and clickable at 1440 px and 320 px.
  - Sticky toolbar height is unchanged while pinned: 238/468 px in Chromium
    and 246/476 px in Firefox at 1440/320.
- Vitest: 109 files, 2,508 tests pass, 78 of them in `src/editor/playback/`.
- `format:check`, `lint`, `build` and `git diff --check` pass.
- Full matrix (`--preset full --browser both -j 2`, 727 s): **46 passed,
  6 failed, 6 unsupported.** All six failures are pre-existing and fail
  identically on clean `master` (`f033976`): `lyric-move`, `lyric-spacing` and
  `note-modifiers` in Chromium, `lyric-spacing-selection-cue` in Firefox, and
  `word-composition` in both. `dynamic-vertical-layout` passes in both
  browsers; its earlier Firefox failure was a stale CSS-zoom scroll range in
  the test environment
  ([analysis](../dynamic-vertical-layout/README.md#firefox-stale-scroll-range-under-150-css-zoom-audio-1-follow-up)).
- History: the first revision placed Play/Stop inside the sticky toolbar.
  That added a row at 320 px and broke `extended-scandicus-climacus` (both
  browsers), because its hover points fell under the toolbar. Placing the
  controls above the toolbar, with pinning during playback, avoids this, and
  that driver passes.

## Listening (manual)

**Not run by the implementing agent**, which cannot hear audio. The owner
listened to the first revision before asking for division pauses (PR #101
review). The pause and pinning revision has not been listened to yet.
Pending, in Chromium and Firefox:

- Kyrie XI and Pater Noster: the melody sounds as written. B flats are heard
  where the score shows them, repeated notes are audibly separate, and
  division pauses fall where expected.
- Dies Irae: plays to the end, or until Stop, without stuck notes, clicks or
  overlap.
- Play, Stop, Play again; edit or load another example during playback. Each
  stops cleanly.

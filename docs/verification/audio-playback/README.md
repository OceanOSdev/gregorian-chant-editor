# Audio playback verification (Audio 1)

The [playback guide](../../playback.md) owns the contract. This record covers
what automated checks prove, what they cannot prove, and the dated results.

## Automated checks

Vitest (no browser, no audio device):

- `src/editor/playback/proofreading-performance.test.ts`: the degree→MIDI
  register across octave boundaries and negative degrees; one event per note in
  tuple order for every neume kind, with stable IDs; repeated notes as distinct
  back-to-back events; divisions and clefs are not sounded; division pauses per
  kind (0.5/1/2/3 note lengths), the longest pause at a shared boundary,
  separate boundaries accumulating, no leading or trailing silence, clefs
  adding no time, and pauses only between neumes; mora doubling a marked note,
  the first/second/both notes of Podatus and Clivis, an auctum duplex on
  Torculus, Porrectus, Scandicus and Climacus lengthening each marked note
  once with no group multiplier, parity with the editor's mora-scope
  command, a pause after a lengthened note, pitch and order unchanged,
  episemata/forms/liquescence still ignored, and unsupported mora data
  rejected; every bundled example's mora notes lasting two base notes; initial and mid-score C/F
  clefs; melody-preserving initial and mid-score clef edits; scoped B flats and
  naturals, register isolation, word and every division reset, no reset at a
  clef change, and earlier-placed signs; explicit failures for invalid order,
  duplicate IDs, invalid accidentals, unsafe and out-of-range pitches; every
  bundled example note for note.
- `web-audio-synth.test.ts` and `playback-controller.test.ts` use recording
  fakes of the Web Audio objects. They cover scheduling on the audio clock,
  per-note envelopes returning to silence, a mora-length note held for its
  whole duration, silence through a division pause,
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
  gap between scheduled notes is the previous note (1 base note, or 2 with a
  mora) plus at most one division pause, and some gaps include a pause.
- Play/Stop are inside the sticky toolbar at 1440×1000, 390×1100 and 320×900.
  Scrolled to the end of Dies Irae, Stop is fully in the viewport, topmost at
  its centre and clickable, and the toolbar height is unchanged with no
  horizontal scroll. Where the toolbar sticks (1440, 390), Stop stays inside
  it and is not pinned. Where the toolbar's too-tall safeguard makes it
  static (320×900), the fallback pins the group. Stop is pressed with a real
  click and the group returns to its row.
- A one-note chant schedules one note and returns to idle by itself.
- A seeded plain, mora, plain score is scheduled with gaps of exactly 0.4 s
  and 0.8 s and a total of 1.6 s. Dies Irae has no morae; Kyrie XI (13) and
  Pater Noster (10) do, and the unit tests check every bundled mora note.
- After New, the status reads "No notes to play." and Play creates nothing.
- With `AudioContext` removed on a fresh page, Play reports "not available"
  without page errors or unhandled rejections.

A peak above zero proves the browser rendered a signal. It does not prove
that the pitches, timbre or envelope sound right to a listener.

```sh
npm run verify:browser -- --driver audio-playback --browser both
```

## Results (2026-11-18, second owner-review revision)

Linux x64, Node 24.12.0, Chromium 157.0.8103.38 (snap), Firefox 146.0,
headless, runner-owned preview servers, on the tree committed as the second
revision of PR #101.

- `audio-playback`: **Chromium pass, Firefox pass** (run twice after the last
  driver change).
  - Output peak while playing ≈ 0.199 for Kyrie XI and Dies Irae; 0 after
    Stop.
  - The seeded mora score gaps are 0.4 s and 0.8 s.
  - Dies Irae gaps: 555 of one note, 37 of two (a note plus a minor pause),
    20 of four (a note plus a finalis).
  - Stop is inside the sticky toolbar at 1440×1000 and 390×1100, and pinned
    at 320×900, where the toolbar's too-tall safeguard makes it static.
  - Toolbar heights: Chromium 238/423/468 px and Firefox 246/431/476 px at
    1440/390/320.
- **Toolbar height compared with `master` (`f033976`):** a temporary probe ran
  in both browsers at 1440, 1024, 768, 600, 480, 390, 352 and 320 px, with the
  starter score and Kyrie XI.
  - Every height is identical to `master`.
  - The Quilisma label stays on one line (19 px Chromium, 25 px Firefox) and
    its select keeps its natural width (84/92 px).
  - Play/Stop clear the palette above and the action bar below in both
    browsers; there is no horizontal scroll.
- Vitest: 109 files, 2,522 tests pass, 92 of them in `src/editor/playback/`.
- `format:check`, `lint`, `build` and `git diff --check` pass.
- Full matrix (`--preset full --browser both -j 2`, 724 s) on the final
  application code: 45 passed, 7 failed, 6 unsupported.
  - Five failures are pre-existing and fail identically on clean `master`:
    `lyric-move` and `lyric-spacing` in Chromium, `lyric-spacing-selection-cue`
    in Firefox, and `word-composition` in both. `note-modifiers` in Chromium,
    which failed on `master` earlier, passed in this run.
  - The other two were `audio-playback` in both browsers, which ran a stale
    copy of this driver. The current driver then passed in both, as above.
- Found and fixed during this revision. The first in-toolbar layout used
  36 px buttons. In Firefox at 320 px it pushed the label onto two lines,
  making the toolbar 26 px taller than on `master`; Chromium's narrower text
  fitted. This broke `extended-scandicus-climacus` (Firefox) and
  `vertical-episemata-context` (Chromium). The 32 px buttons and the
  one-line label rule fixed it; both drivers pass in the run above.
- Earlier revisions placed the controls inside the toolbar (an extra row at
  320 px) and then above it with pinning. Both are superseded by this
  layout. The pinning remains only as the non-sticky fallback.

## Listening (manual)

**Not run by the implementing agent**, which cannot hear audio. The owner
listened to the first revision before asking for division pauses (PR #101
review). The division pause, mora and toolbar revisions have not been
listened to yet.
Pending, in Chromium and Firefox:

- Kyrie XI and Pater Noster: the melody sounds as written. B flats are heard
  where the score shows them, repeated notes are audibly separate, division
  pauses fall where expected, and mora notes are audibly longer.
- Dies Irae: plays to the end, or until Stop, without stuck notes, clicks or
  overlap.
- Play, Stop, Play again; edit or load another example during playback. Each
  stops cleanly.

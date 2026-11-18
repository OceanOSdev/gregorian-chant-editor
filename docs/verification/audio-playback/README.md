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

## Audio 2 follow-along

Vitest:

- `performance-navigation.test.ts`:
  - start resolution for a note, mid-neume note, neume, forward and reverse
    range, anchored syllable, nonmusical selections and stale IDs, plus a
    range across a Dies Irae system boundary;
  - rebasing: prompt start, no inherited pause, later mora and pauses kept,
    last-note start, identities kept;
  - all five speeds scaling every start, duration and total, with mora and
    pauses at 0.5×;
  - sounding-note lookup before the first note, at half-open boundaries,
    across pauses, during a mora hold, at the end, for repeated pitches,
    for an empty performance and for a rebased slowed performance.
- `sounding-note.test.ts`: change-only notification and the playback count.
- `follow-sounding-note.test.ts`: the follow policy's decision.
- `focus-visibility.test.ts`: `zoomFactor` (exactly 1 without zoom,
  including sub-pixel rounding, and 1.5 under 150% CSS zoom).
- `sticky-visibility.test.ts`: `unobstructedViewportBottom`, which applies
  only under the pinned controls' columns.
- `playback-controller.test.ts` and `web-audio-synth.test.ts`:
  `elapsedSeconds` on the audio clock for the current session only (null
  after stop, natural end and dispose), and the scheduler's `startTime`.

Browser driver `audio-playback/follow-along-check.mjs` (runner driver
`audio-follow-along`; production preview; Chromium/CDP and Firefox/BiDi).
It uses real pointer clicks and key presses throughout, with one exception:
three selection changes use a dispatched click on the note, because the
selected note's context panel can cover neighbouring notes.

- **Reference.** A seeded one-system score (a, Podatus p0–p1, minor pause,
  mora m, b, finalis pause, c) plays from the beginning with scheduled gaps
  of 1, 1, 2, 2 and 4 base notes.
- **Announcements.** Selecting and clearing a selection cause no mutation of
  the live status. The toggle's `aria-describedby` includes a non-live hint
  that reads "Plays from the selection" only while a start applies.
- **Start from a mid-neume note.** The scheduled frequencies are exactly the
  tail from p1, with gaps 2, 2 and 4 and no inherited pause. Focus stays on the
  toggle, the selection stays, and the selected sounding note shows both the
  selection outline and the cue. The cue takes no pointer hits and has no
  role.
- **Cue against the audio clock.** A MutationObserver on the score records
  the audio-clock time of every cue change. The cue must:
  - visit each scheduled note in order;
  - never run ahead (allowing 10 ms of clock granularity);
  - lag each note's scheduled start or end by a median of at most 25 ms.

  A cue offset by the full 50 ms scheduling headroom fails; this was checked
  by temporarily subtracting it a second time, which gives a median of
  57 ms. The finalis pause is checked explicitly: after b the cue clears,
  and nothing is cued until c, 1.2 s later. The cue clears at the natural
  end and when the document is replaced during playback.

- **Play from beginning** in the options plays the whole score while the
  selection stays. Selecting another note during playback does not restart
  it. Stop clears the cue.
- **Speed.** At 0.5× every gap doubles, the speed choice is disabled while
  playing, and the cue keeps to the slowed audio clock under the same
  timing rules. An initial-clef edit
  during playback stops it and clears the cue.
- **Follow scrolling.** At 1.5× from the last note of the third system, whose
  next notes start below the viewport, in four cases:
  - Dies Irae 1440×1000;
  - Dies Irae 320×900;
  - Salve Regina 320×900;
  - Dies Irae 1440×1000 at 150% CSS zoom.

  In each case the cue's note on the next system ends up fully in the usable
  viewport (below the sticky toolbar when it sticks) and topmost at its
  centre. There is no page overflow, the toolbar height is unchanged, the
  selection and toggle focus are kept, and after a manual scroll to the top
  the page is not pulled back for 1.5 s.

- **Sideways score at 320px.** A one-syllable-wider-than-a-system score
  scrolls sideways, and every note starts off to the right. Play reveals the
  first sounding note inside the score viewport (`scrollLeft > 0`) without
  page overflow or moving focus.
- **Pinned controls at 320×600.** The toolbar is too tall to stick, so the
  controls pin during playback. Playing Dies Irae from the seventh system:
  - a note beside the pinned controls keeps the full height (its bottom is
    below their top);
  - a note under their columns is revealed above them and is topmost.
- **Reveal under 150% CSS zoom** in the sideways score at 320px:
  - keyboard focus reveal (select a note, then transpose it so the app
    restores focus);
  - follow reveal.

  Both leave the note 8 ± 2 px inside the score viewport's right edge. That
  is minimal: no overshoot, and not hidden.

- **Options dismissal:**
  - a score click in select mode and with a placement tool armed (nothing
    selected, placed or edited; focus kept);
  - Tab and Shift+Tab departure;
  - plain Escape (selection kept);
  - Escape during a clef draft, a pending accidental placement and a lyric
    move: the first Escape closes only the options, and the editor's next
    Escape cancels the pending interaction.

The Audio 1 driver (`audio-playback`) was updated for the toggle and the
options. During playback, "Play from beginning" is inert and creates no
second session.

### Audio 2 results, first submission (2026-11-18)

Superseded by the [review follow-up results](#audio-2-review-follow-up-results-2026-11-18).
Linux x64, Node 24.12.0, Chromium 157.0.8103.38 (snap), Firefox 146.0,
headless, runner-owned preview servers, at implementation commit `2c3ad16`
(with docs `6825930`).

- `audio-follow-along`: **Chromium pass, Firefox pass** in three consecutive
  runs after the last driver change.
  - About 100 cue samples per run matched the audio clock, with about 45 in
    silences. The sampling allowed 50 ms of lag, equal to the scheduling
    headroom, so it could not detect a headroom offset. The review
    follow-up replaced it.
  - All five follow cases revealed the next note: Dies Irae at 1440 and 320,
    Salve Regina at 320, Dies Irae at 150% zoom, and the sideways score.
- `audio-playback` (updated): **Chromium pass, Firefox pass**. Toolbar
  heights are Chromium 238/423/468 px and Firefox 246/431/476 px at
  1440/390/320.
- **Toolbar height vs current `master` (`6209eec`):** a one-off manual
  measurement with an uncommitted temporary probe, in both browsers at 1440, 1024, 768, 600, 480, 390, 352 and 320 px, with the
  starter score and Kyrie XI, found 0 differences in 32 comparisons. The
  Quilisma label stays on one line, the controls clear the palette and the
  action bar, and there is no horizontal scroll.
- Vitest: 112 files, 2,565 tests pass. `format:check`, `lint`, `build` and
  `git diff --check` pass.
- Full matrix (`--preset full --browser both -j 2`, 756 s) at `6825930`:
  **49 passed, 5 failed, 6 unsupported.** All five failures fail identically
  on current `master` `6209eec`: `lyric-move`, `lyric-spacing` and
  `word-composition` in Chromium, and `lyric-spacing-selection-cue` and
  `word-composition` in Firefox. The new `audio-follow-along` and every
  focus, scrolling and toolbar driver (`dynamic-vertical-layout`,
  `score-focus-reparenting`, `editor-toolbar`, `contiguous-selection`,
  `extended-scandicus-climacus`, `vertical-episemata-context`) pass in both
  browsers.
- Found and fixed during implementation:
  - The options button's block wrapper added a line box (+1.2 px in
    Chromium); it is now a flex container.
  - The follow policy treated a note within 8 px of the viewport edge as
    "scrolled away"; it now uses on-screen overlap.
  - Under CSS zoom, reveal mixed zoomed rects with unzoomed client metrics;
    container metrics are now converted by the measured zoom factor.

**Listening and visual sync: not done by the implementing agent.** Owner
checks in Chromium and Firefox:

- the start note is correct (including mid-neume);
- 0.5× and 1.5× sound slower and faster without pitch change;
- the cue moves with the sound, including mora holds and pauses;
- following feels right on a long score and when you scroll away.

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

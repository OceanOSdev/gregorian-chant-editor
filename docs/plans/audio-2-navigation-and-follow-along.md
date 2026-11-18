# Plan: Audio 2 — Playback navigation and follow-along

Branch: feat/audio-2-follow-along
Target: master
Status: Implemented in the Audio 2 PR; awaiting owner review (this plan records intent, not verification)

## Problem and user-visible goal

Audio 1 (merged PR #101) can play an authored chant with accurate semantic pitches, per-note mora doubling, and division-specific pauses, but playback always starts at the beginning and gives no indication of which written note is sounding. Proofreading a long chant such as _Dies Irae_ requires repeatedly listening from the start and manually finding the passage.

Audio 2 should let an author select a passage, start playback at that spot, slow down the audition, and follow the sounding note in the score as it progresses through wrapped systems. It is still **melodic proofreading**, not authentic Gregorian performance or audio export.

Keep this one reviewable feature PR, preserving the accepted Audio 1 architecture and existing editing UX.

## Read first / authoritative contracts

- [AI collaboration workflow](../ai-workflow.md) and repository [AGENTS.md](../../AGENTS.md).
- [Playback guide](../playback.md), [Accepted ADR 0006](../adrs/0006-separate-notation-from-playback.md) and [Audio 1 plan](audio-1-basic-melodic-playback.md).
- [Editor interactions](../editor-interactions.md), [architecture](../architecture.md), [domain model](../domain-model.md), [layout and rendering](../layout-and-rendering.md), and [testing guide](../testing.md).
- [Stable-ID ADR 0003](../adrs/0003-use-stable-semantic-identities.md), [mora ADR 0018](../adrs/0018-conventional-mora-patterns.md), and the existing clef/accidental decisions referenced by the playback guide.
- Inspect the _current_ code before editing: playback Performance, Proofreading Playback, controller, Web Audio scheduler, React hook and controls; editor selection helpers; ChantEditor; ScoreSvg/NeumeControl; focus/reveal helpers; sticky toolbar and verification runner.

## Agreed product behavior

### A. Start playback at a selected passage

- Pressing **Play** starts at the current musical selection when there is one; otherwise it starts at the beginning.
- A selected **note** starts on that exact note, including a middle note within a multi-note neume.
- A selected **neume** starts at its first note.
- A selected **neume range** starts at the earliest neume of the range in canonical score order, regardless of the anchor/endpoint direction.
- Unrelated selections (clef, division, accidental, unanchored lyric, none) use the beginning; do not guess a score position from visual proximity. Handling an explicitly anchored syllable via its neume is acceptable if it reuses the existing semantic resolver and is documented.
- The first selected note sounds promptly, with **no preceding division pause or preceding notes**. Later notes keep exactly their Audio 1 timing relationships (mora and division gaps), rebased to the new starting point. No new persisted playhead or score edits.
- Keep an accessible, discoverable path to **Play from beginning even when a musical selection remains active**. A compact menu or secondary action is acceptable; do not force repeated Esc or deselection. Avoid adding a toolbar row at 320px.
- Changing editor selection while already playing does not silently jump the audio or change its active score location; Stop and Play picks up the newly chosen start. Any actual document change still stops playback under Audio 1 rules.

### B. Follow-along score highlighting

- During playback, visually distinguish the **currently sounding authored note** by its stable note ID; multi-note and repeated-note neumes should advance note by note.
- The playback cue must be **separate from editor selection, focus and caret**. It must never dispatch editing commands, enter history, affect autosave, alter aria-selected/pressed editing semantics, or trigger click/drag/pointer events.
- A selection and the playback cue can coexist. Use a visible treatment that remains distinguishable with or without an existing selection, and do not rely on color alone where a stroke/outline or shape can help.
- No note should appear actively sounding during actual gaps between performance events (especially division pauses). Clear the cue on Stop, natural completion, document edit/replacement, invalid score, failed start, and unmount; prevent stale old-session callbacks from reviving it.
- Derive the active note from the scheduled **audio clock and the actual performance timeline**, not from independent accumulated browser setTimeout calls. The 50-ms Audio 1 scheduling headroom must have one authoritative source, not duplicate offsets guessed in the UI. A small requestAnimationFrame or bounded presentation polling loop may sample the audio clock and publish only meaningful note-ID changes.
- Keep pure timeline lookup/mapping logic testable outside React, SVG and Web Audio. Do not introduce an alternate musical interpretation or a second source of playback timing.

### C. Follow visibility across long/wrapped scores

- When playback moves to a note that is outside the usable viewport, reveal it, including across systems and within a horizontally scrollable score region.
- Respect the actual sticky-toolbar obstruction and current zoom/viewport, using or adapting existing measured visibility/reveal conventions. **Do not focus the sounding note**, move keyboard focus, or overwrite user selection.
- Avoid continuous jittery centering and repeatedly scrolling for notes already visible. Favor minimal reveal near a viewport boundary; if the user manually navigates during playback, do not fight that interaction.
- Do not change the engraving, wrapped layout, SVG hit ownership or DOM note identity to implement scrolling. The semantic note ID identifies the target; rendered geometry is consulted only to reveal it on screen.
- Honor reduced-motion preferences for any optional animated scrolling. Immediate reveal is acceptable and simpler.

### D. Adjustable audition speed

- Provide a small, accessible playback speed choice: **0.5×, 0.75×, 1× (default), 1.25×, 1.5×**.
- This is a **playback-only multiplier**: scale note durations _and_ their relative start times, mora lengthening, division silence and total duration consistently. Pitches do not change.
- Selecting the speed **before Play** is sufficient for Audio 2. Do not attempt mid-play time stretching or redesign AudioContext scheduling. While playing, keep the control visibly disabled or explicitly make changes take effect only on the next playback, with clear feedback.
- Speed is transient UI preference only. No document, native-schema, localStorage or history changes.
- Keep Play/Stop reachable in the sticky toolbar. The speed control and any secondary start action must not create height/overflow or keyboard-navigation regressions, especially at 320px. A compact responsive arrangement is preferable to changing existing palette focus navigation.

## Architectural boundaries and preferred seams

The current separation remains authoritative:

**ChantDocument → pure Proofreading Playback → Performance timeline → PlaybackController → Web Audio.**

- Extend by pure selection-to-start resolution and timeline trimming/rebasing and speed scaling, rather than copying score interpretation, accidental or mora logic.
- Treat stable note IDs from PerformanceNote as the mapping into the rendered note/NeumeControl tree.
- Expose an audio-clock-based progress/playhead observation seam at the playback controller/scheduler boundary for UI integration; make a start timestamp available where needed. Keep presentation state in the playback/UI layer, not ChantDocument, the session reducer or the layout model.
- Choose cohesive boundaries that preserve the readability gains of the editor refactor. No global event bus, generic engine registry, new dependency, alternate document representation, DOM-based musical ordering, or broad component rewrite.
- Preserve Audio 1's lifecycle: gesture-start AudioContext, prompt Stop, no overlapping sessions, stale session cancellation, safe dispose/failed resume, and stop on document mutation. Avoid leaking animation frames/observers.

## Acceptance and verification

### Pure logic

- Selection mapping: note within neume, whole neume, forward/reverse range, none and nonmusic selections; stale/deleted IDs fall back safely.
- Rebased start: first selected event at 0; no inherited pre-selection pause; downstream note positions, mora and multiple division pauses remain correct; last-note selection plays one note; no invented/silently dropped remaining notes.
- Speed scaling: all five choices preserve pitches and identities and scale all start offsets, mora durations, division gaps and total length. No drift or malformed/negative times.
- Active-note lookup: before first scheduled sound, ordinary notes, repeated pitches with distinct IDs, mora-length holds, division pauses, terminal end and empty performance. Boundaries should not flicker or misidentify notes.

### Controller, integration and browser

- Start/Stop/restart, pending resume, failed context, natural end, edit/replacement and unmount clear the presentation cue and cannot leak old-playhead callbacks.
- A selected note in the middle of a neume plays from that note; a selection across a system boundary starts and tracks in semantic order. An existing selection remains intact and keyboard focus does not jump.
- The score-follow cue is visible, noninteractive and distinct from the editing selection in Chromium and Firefox. It advances on the **actual audio time**, including pauses and mora extension.
- In _Dies Irae_ and another long example, auto-reveal crosses system boundaries and handles a narrow 320px viewport with horizontal score overflow, sticky toolbar, and browser zoom. It does not obscure the target beneath the toolbar or break existing pointer hit-testing and keyboard focus recovery.
- Play/Stop remain reachable; test compact speed/start controls at narrow and normal widths and verify no unintended sticky-toolbar growth or horizontal page overflow.
- Do not claim audible correctness from merely checking DOM or waveform output. The owner should manually listen and confirm correct start, slower/faster rate, timing continuity and visual synchronization in Firefox and Chromium.

Follow [testing](../testing.md) and the browser [runner guide](../verification/runner/README.md). During development run focused Vitest and targeted browser checks; at completion run format:check, lint, npm test, build, git diff --check, and affected browser drivers in both engines. Because this milestone changes score scrolling, focus-adjacent behavior and the sticky toolbar, a final full Chromium/Firefox browser matrix is warranted; compare failures with current master, not an old PR base, and report the exact revision tested.

## Explicit exclusions / stop conditions

- No pause/resume, seeking/scrubbing, loop regions, playback from arbitrary pixel positions, or persistent playback position in Audio 2.
- No new chant rhythm system, tempo rubato, accents/episemata rules, new audio timbre, MIDI/WAV export, voice synthesis, pitch-policy changes, or notation-format migration.
- No changes to selection semantics, editing/history commands, hit geometry, focus behavior or automatic score wrapping to serve the playback cue.
- No unrelated test-runner migration, palette/lyric shortcut redesign, or layout refactor.
- Stop and present concrete alternatives for a material conflict with accepted ADRs, if the user-visible start-from-selection behavior cannot be implemented without corrupting selection/keyboard behavior, or if sticky-toolbar constraints require a substantial UX compromise. Ordinary engineering implementation choices do not need separate approval.

## Deliverable and owner review

Implement **on feat/audio-2-follow-along**, commit and push, then open one focused PR against **master**. Update the playback and editor-interactions guides and verification index/record; review whether an ADR needs revision (do not add one solely for an implementation detail). Report actual automated and manual browser checks, test failures versus master, limitations and user decisions. Do **not** merge.

This committed plan records intent, **not** completed implementation or verification.

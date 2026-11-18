# Audio 1 — Basic melodic playback

Branch: `feat/audio-1-basic-playback`
Target: `master`
Status: implemented in PR #101; scope revised twice after owner review (see
[Owner review revision](#owner-review-revision-pr-101) and
[second revision](#second-owner-review-revision-pr-101))

## Problem and user-visible goal

ChantPad can author, edit, save, and render increasingly long chants, but authors
cannot hear whether the entered melody is correct. Deliver the first deliberately
simple **melodic proofreading** experience: open a chant, press **Play**, hear
each authored note in order, and press **Stop** to end playback.

This is **not** a claim to reproduce authentic Gregorian chant performance.
Prioritize deterministic musical correctness, a small usable UI, testability, and
clean subsystem boundaries.

## Architectural context and prior decisions

Read `AGENTS.md`, `docs/ai-workflow.md`, and the relevant music, editor, and
testing guides before implementation.

- [ADR 0006](../adrs/0006-separate-notation-from-playback.md) already proposes
  the intended boundary: semantic notation -> playback interpretation/timeline ->
  audio renderer. **It is still marked Proposed.** Review whether the owner's
  approval of Audio 1 is sufficient for formal acceptance and explicitly flag
  any unresolved policy before changing its status; do not silently mark it
  Accepted or create a conflicting playback model.
- [ADR 0014](../adrs/0014-preserve-melody-on-initial-clef-edit.md) defines a
  **relative diatonic degree**, not absolute concert pitch:
  `degree = staffPosition + clefOffset(clef)`.
- [ADR 0015](../adrs/0015-order-clef-changes-at-score-boundaries.md) governs
  semantic clef and division order.
- [ADR 0021](../adrs/0021-author-b-accidentals-at-neume-boundaries.md) governs
  register-specific, scoped B flats/naturals and earlier graphical placement.
- `src/editor/domain/divisions.ts`: `deriveScoreOrder(document)` determines
  semantic event order, independent of layout.
- `src/editor/domain/accidentals.ts`: `resolveEffectivePitches(document)`
  already resolves each note's degree and effective chromatic alteration
  (`-1 | 0`) with clef changes and accidental scopes.
  **Reuse it** rather than implementing accidental state a second time.
- `src/editor/domain/chant-document.ts`: each neume's `notes` tuple is in
  semantic performance order; stable note IDs can accompany timeline events.
- `src/editor/components/ChantEditor.tsx` is not an appropriate home for
  musical interpretation or Web Audio scheduling. Keep its integration thin.

## Agreed product behavior — Audio 1

- Play the **whole score from the beginning** in semantic order, including
  individual notes of connected, compound, and repeated-note neumes.
- Correct pitch relationships across initial and mid-score C/F clefs and
  effective B flats/naturals (including independent earlier-placement signs).
- **Equal base duration per note**, with a small, consistent tone envelope
  so repeated notes are audibly distinct. A default on the order of 400 ms
  is suitable; exact value is an implementation choice. Do not infer durations
  from mora, horizontal/vertical episema, liquescence, lyric accent, or glyph
  shape in this milestone.
- **Simple deterministic pauses at divisions** (added in owner review): each
  division kind adds a fixed silence between the surrounding notes, longer for
  heavier divisions. These are playback-only proofreading aids, not historical
  performance claims. Timing walks the existing semantic score order
  (`deriveScoreOrder`); no second interpretation of divisions.
- Minimal **Play** and **Stop** controls in an appropriate editor UI location;
  show playback state and prevent overlapping sessions. Stop must stay
  conveniently reachable while listening to a long chant without making the
  sticky toolbar taller on narrow screens (added in owner review). Do not add conflicting
  keyboard shortcuts in Audio 1. Tempo/speed control is optional only if it can
  be included without complicating this slice; otherwise defer.
- The browser **Web Audio API** is the audio backend. Prefer a simple,
  monophonic, sustained synthesizer with short attacks/releases. No soundfont,
  external service, sample library, backend, or new audio package is required.
- Schedule audio against `AudioContext.currentTime`, not one browser timer per
  note. Create/resume the context following a user gesture; stop promptly;
  clean up on unmount and document replacement; prevent obsolete callbacks
  or old notes from resuming playback. Manage any browser autoplay restrictions
  and unavailable/failed audio context with helpful, noncrashing feedback.
- Disabled/empty-score behavior is clear. Invalid or unplayable documents must
  not produce fabricated notes, NaN frequencies, runaway playback, or an uncaught
  exception. Prefer an explicit error/unsupported outcome over silently
  transposing, truncating, or clamping a malformed score.

## Pitch-to-audio interpretation

Notation retains **relative diatonic pitches**. Audio 1 requires a consistent,
explicit **playback-only register convention**; do not add pitch, octave, tempo,
or timestamp fields to `ChantDocument` or its native JSON schema.

Recommended default convention: relative degree 0 = C4 (MIDI 60), so F on the
same degree lattice is F4; this is merely a stable audition register and not a
claim that the source notation fixes an absolute octave. Derive natural semitone
offsets for a C-major diatonic lattice `[0,2,4,5,7,9,11]`, with correct floor
division and positive modulus for **negative** relative degrees; apply
`EffectivePitch.alteration` afterward. Convert to an audible frequency in the
audio backend. Any change to this convention should be explicit in the PR.

Use an intermediate performance representation with ordered event positions,
stable note/neume IDs and effective pitches/durations, independent of React,
the DOM/SVG, pixel layout, and `AudioContext`. The interpreter should be a
**pure function**. Avoid overengineering a public plugin framework in Audio 1;
retain an obvious seam for alternative interpretation engines later.

## In scope

1. Pure notation-to-performance interpreter with deterministic timing and
   explicit error handling.
2. Browser-local audio scheduler/synthesizer with safe lifecycle and stop.
3. Minimal React controls and state integration, separated from editor
   document/history commands.
4. Focused tests, targeted browser validation, and accurately updated
   architecture/playback documentation.
5. Review/resolve the status of Proposed ADR 0006 through the repository's
   existing ADR workflow, without changing unrelated accepted contracts.

## Out of scope

- Vocal/monastic choir synthesis, syllable singing, speech synthesis, samples,
  audio export, MIDI export, live microphone or conducted performance.
- Authentic rhythm, duration inference from episemata, phrase rubato,
  ornament interpretation or expressive timing. Mora is limited to the simple
  doubling in the second revision.
- Play from selection, pause/resume, seek, note-by-note highlighting, scrolling
  during playback, looping, and persistence of audio preferences.
- Native-format/schema migrations, new notation concepts, and broad editor
  refactoring.
- Migrating the existing browser verification infrastructure to Playwright.

## Acceptance criteria

- A one-note chant sounds once, and Stop terminates an active playback promptly.
- Multi-note neumes and successive repeated notes generate **distinct** ordered
  events, preserving authored order and identities.
- Tests cover relative degree -> semitone conversion across octave boundaries,
  **negative degrees**, C/F clef changes, and melody-preserving clef edits.
- Tests cover scoped B-flat/natural behavior, octave/register isolation, reset
  at word/division boundaries, and _earlier-placed_ accidental signs.
- Divisions and explicit clef events are not synthesized as notes. Each
  division kind adds its deterministic pause between notes; clefs add no time.
  Playback ordering and timing come from semantic score data rather than SVG or
  layout.
- Every valid supported neume kind is handled generically through its ordered
  `notes` tuple (not an incomplete `switch` over seven original kinds).
- Start/Stop/restart, empty score, document change, unmount, and audio-context
  failure have deterministic behavior and cleanup without overlapping sound.
- Audio is initiated through an actual user action in Chromium and Firefox;
  manual listening verifies at least a bundled Kyrie/Pater Noster and a longer
  example such as Dies Irae. Distinguish automated timeline/scheduler checks
  from what was **actually heard** in manual tests.
- A focused PR describes the implementation, audio register convention,
  verification run/results, limitations, and owner acceptance needs.

## Verification and delivery

Follow `docs/testing.md` and `docs/ai-workflow.md`. Run focused Vitest
tests while developing; at completion run `npm run format:check`,
`npm run lint`, `npm test`, `npm run build`, `git diff --check`,
plus relevant Chromium/Firefox browser checks. Add an audio-specific browser
check only if useful for real user-action/audio lifecycle coverage; do not
falsely claim audible correctness from a DOM-only test.

Implement **on this branch**, commit and push, then open a PR against
`master`. Do not merge. Stop and present evidence/options for material ADR or
architectural conflicts rather than silently changing the agreed scope.

## Owner review revision (PR #101)

Agreed after the owner reviewed and listened to the first implementation:

1. **Division pauses** are in scope (see Agreed product behavior). Values and
   boundary rules are owned by the [playback guide](../playback.md).
2. **Stop reachability:** keep Stop reachable during long playback with a
   small responsive solution that does not enlarge the sticky toolbar; no
   broad UI redesign.
3. **Firefox `dynamic-vertical-layout` at 320px:** determine whether it is an
   interaction regression or a test scrolling problem and resolve it without
   weakening hit-testing assertions, verified against `master` and the branch.
4. **Mora** remains without playback effect; deferred to a separate rhythmic
   interpretation milestone.
5. **ADR 0006** is accepted for its separation of notation, performance and
   rendering, updated to describe the agreed Audio 1 behavior without adding
   premature abstractions (no engine interface or registry yet).

## Second owner review revision (PR #101)

Agreed after the owner reviewed the first revision. Each supersedes the
corresponding item above.

1. **Division pauses** keep the implemented 0.5 / 1 / 2 / 3 base-note values.
2. **Mora** is in Audio 1 (superseding item 4 above): a note with `mora: 1`
   lasts twice the base duration. An auctum duplex lengthens each of its two
   marked notes individually, with no additional group multiplier. This is
   derived only in the pure playback interpreter, respecting
   [ADR 0018](../adrs/0018-conventional-mora-patterns.md): marks stay
   note-owned presence flags, and no timing enters the document. The engine
   is renamed **Proofreading Playback**, because notes are no longer equal.
3. **Play and Stop belong in the sticky editor toolbar** (superseding item 2
   above), in a compact responsive arrangement that adds no row at narrow
   widths. The toolbar's height safeguards, accessibility and score
   hit-testing are preserved.

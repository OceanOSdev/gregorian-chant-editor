# Plan: Stage 8C — authored vertical episemata (ictus marks)

Branch: `feat/stage-8c-vertical-episema`
Target: `master`
Status: **Implemented for review; owner visual acceptance and closeout pending.**

## Problem / intended experience

The owner transcribed and bundled the Gregorian chant
[Pater noster (A)](https://gregobase.selapa.net/chant.php?id=3326)
but noticed short vertical strokes under certain Puncta in its Solesmes
reference. The editor offers note-specific mora and horizontal episema but
cannot author a **vertical episema (ictus sign)**. Provide a contextual
selected-note **Vertical episema: Off/On** control and traditional,
measured SVG engraving. A marked note retains its sign during ordinary
editing, undo/redo, native export/import and browser refresh.

This is a narrow next notation feature, **not** a rhythm interpretation
engine or a blanket re-engraving of the bundled example.

## Research and decision record

Read [Proposed ADR 0020](../adrs/0020-vertical-episema-presence-and-derived-placement.md)
and the existing Accepted ADRs 0002, 0003, 0004, 0007, 0016, 0018, 0019.
Reference documentation:

- [Gregorio GABC: rhythmic signs](https://gregorio-project.github.io/gabc/details.html):
  apostrophe after a pitch marks vertical episema. The renderer chooses above
  or below by context, while `'0` forces below and `'1` forces above.
  Multiple notes of a neume may be marked, each at most once.
- [GregoBase Pater noster (A)](https://gregobase.selapa.net/chant.php?id=3326):
  Solesmes edition; note both small under-note vertical strokes and their
  interaction with horizontal episemata and morae. This is the owner's
  chosen chant for acceptance. Its source history documents adjustments to
  episema height/placement.
- [Gregorio tutorial on marking an individual note](https://gregorio-project.github.io/tutorial/tutorial-gabc-01.html)
  (the vertical episema example on “clamor”).
- [Current Stage 8A](../verification/note-modifiers/conventional/README.md)
  and [Stage 8B](../verification/note-shapes/implementation.md)
  evidence for shared geometry, signs and v3 strictness.

**Research first:** record a small reproducible visual matrix comparing actual
Gregorio/Solesmes specimens and our contours: a Punctum on a staff line and in
a space; a Punctum carrying vertical plus horizontal episema; vertical plus
mora; a two-note compound; a three-note/connected or ribbon shape; nearby
divisions, clefs and a system end. Include signed-neume and unmarked baseline
screenshots. If a traditional tick cannot be faithfully and legibly drawn
with context-derived placement under our current geometry, _stop that
specific geometry decision_ and present reference evidence and alternatives
to the owner before introducing a new field or artistic convention.

## Agreed initial scope / proposed ADR

- **Authored presence, not inferred rhythm.** Add optional
  `verticalEpisema?: true` to the existing note-level modifier semantics.
  Omitted = off. Existing `episema?: true` remains the _horizontal_
  episema; do not rename or change it. `mora?: 1`, `form`, pitch,
  syllable relationships, neume kind and note IDs remain independent.
- Support this marking on a constituent note of **all seven supported
  neume kinds**, including the existing authored Virga, Inclinatum and
  Quilisma forms where they occur. Do not add a pattern whitelist or
  automatic rhythmic count. Only an actual marked note gets an SVG tick.
- **Automatic side choice:** derive a short note-relative vertical tick,
  conventionally below when legible and above otherwise, with a bounded,
  deterministic local placement strategy. Respect staff lines, the note
  head/ribbon/stem, nearby other heads, divisions, mora dots and horizontal
  episemata. The sign must remain visually close to its own note;
  do not use large unbounded displacement, clipping, silent omission or
  a substitute symbol. Store no manual coordinates or orientation in v4.
  An author-controlled Above/Below override is **deferred**. Do not claim
  this first iteration is a full facsimile of all Solesmes editions.
- Use the existing `buildNeumeGeometry` → `addNoteModifiers` shared
  geometry pipeline, paint and measured bounds. Modifier ink participates
  in `NeumeGeometry.bounds`, `advanceX`, note modifier bounds and
  previews; preserve existing note hit contours, lyric anchors and head
  silhouettes. Do not implement a second positioning engine or SVG-only
  unmeasured decoration.
- Extend the always-mounted selected-note modifier controls with an
  independent “Vertical episema” field, keeping their existing layout
  stable when selection changes. An Off→On/On→Off change is one undoable
  semantic action; unchanged edits are referential no-ops. Respect pending
  workflow guards; controls remain navigable by keyboard, announced clearly
  by screen readers, and usable at 320px. Native controls are preferred.
- Preserve vertical sign on move, transpose, clef change, surviving-note
  normalization/deletion and note-form change unless the targeted note
  itself is removed. Never retarget to another note. A sign may coexist
  with both existing rhythmic marks. No extra sign identity is needed.
- **Strict native version 4:** writes now produce v4, while exactly
  validated v1, finalized v2 and v3 continue reading. Only v4 accepts
  optional `verticalEpisema: true`. Unknown note keys, explicit false,
  zero, null and wrong types must reject; a v3 file carrying the v4
  field must reject. Other fields, IDs, order and values stay intact.
  Keep withdrawn draft-v2 incompatibility recovery, 1 MiB bounds, same
  browser storage key, byte conflict detection and confirmed replacement.
  An untouched v1/v2/v3 cache must not be rewritten on hydration; a
  later committed edit writes v4 once. Preserve the bundled owner-authored
  Pater Noster as its **unchanged v3 source**.
- If ADR 0020 needs material revision or conflicts with an Accepted ADR,
  stop and report the conflict to the owner. Keep ADR 0020 **Proposed**
  during implementation, and request explicit owner acceptance before
  changing it to Accepted at milestone closeout.

## Owner-approved contextual editing follow-up (PR #67)

Approved in the [owner review comment](https://github.com/OceanOSdev/gregorian-chant-editor/pull/67#issuecomment-6740210401).
This addition is implemented for review; owner acceptance remains pending.
The scope approval is not engraving acceptance or permission to merge.

- In Select mode, show a small contextual editing surface near the selected
  note for **Mora scope**, **Horizontal episema** and **Vertical episema**.
  Reuse `moraChoices`/`getMoraScope` and the existing `updateMoraScope` /
  `updateNoteModifiers` dispatch, history and synchronous autosave paths.
  No duplicate modifier state, new schema, validation or note-form rules.
- Preserve the always-mounted comprehensive inspector, including Form. Both
  editing surfaces derive their values from the same current semantic note /
  neume and stay synchronized.
- Use an overlay that consumes no score layout space. Follow the selected
  note's current rendered bounds on reflow, score/window scrolling and resize;
  flip/clamp to the visible viewport, remain outside SVG clipping and avoid
  covering the selected note. At 320px or zoomed widths, a compact accessible
  viewport-aware presentation may be used to preserve local editing.
- Provide accessible names and equivalent native control state, visible focus,
  native keyboard operation, Tab navigation and Escape dismissal. Opening or
  using controls must not deselect the note, change pitch or invoke notation
  shortcuts. Closing preserves already committed edits and returns focus
  appropriately without trapping it. Respect placement and pending-workflow
  guards; do not introduce a general toolbar redesign.
- Verify several systems down in the bundled Pater Noster: receive/remove each
  sign without returning to the inspector, mixed signs, legal compound mora
  scopes, synchronized inspector values, atomic Undo/Redo, synchronous autosave
  and immediate refresh. Check pointer/keyboard note focus, dismissal, scroll,
  resize/reflow and 320px in Chromium and Firefox against production preview.
  Retain before/after and narrow contextual screenshots and update the owning
  interaction/testing guides and verification record.

ADR 0020 remains Proposed pending separate owner acceptance. This is a transient
interaction addition within the existing semantic/layout/rendering boundaries;
report any material architectural conflict before implementing divergent behavior.

## Exclusions

Do not introduce playback, implied tempo/accent/duration, automatically
counted ictuses, GABC import/export, other Solesmes marks, horizontal-episema
bridges/overrides, manual sign orientation, new semantic neumes, a backend
or a generalized engraving/glyph system. Do not silently annotate every
note of the bundled Pater Noster: the owner should be able to add signs
manually and compare them against the reference after the feature works.
Use temporary derivative fixtures or test-only samples where necessary.
The blocked-autosave warning and extreme-pitch canvas issues remain
separate tracked follow-ups, except direct regressions caused by 8C.

## Implementation investigation

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/domain-model.md`,
`docs/commands-and-history.md`, `docs/layout-and-rendering.md`,
`docs/engraving-metrics.md`, `docs/editor-interactions.md`,
`docs/persistence.md`, `docs/testing.md`.

Relevant starting points to investigate, not mandatory file prescriptions:
`src/editor/domain/chant-document.ts`,
`src/editor/domain/neume.ts`,
`src/editor/commands/update-note-modifiers.ts`,
`src/editor/layout/note-modifiers.ts`,
`src/editor/layout/neumes/shared.ts`,
`src/editor/components/ChantEditor.tsx`,
`src/editor/persistence/native-document.ts`,
`src/editor/examples/pater-noster.chant.json`.

Avoid introducing a second note appearance model or reclassifying the
existing horizontal `episema` field.

## Verification / acceptance

1. Selected-note Off→On→Off updates only the targeted note. Independently
   toggle a vertical episema alongside horizontal episema and mora, including
   all-on cases. Verify repeated edits are no-ops; Undo/Redo restores exactly
   one semantic snapshot per accepted change, including after moving a note.
2. Compare authentic samples with derived geometry on standalone Punctum,
   Virga, Inclinatum; connected Podatus/Scandicus including Quilisma;
   and Clivis, Torculus, Climacus and Porrectus constituent notes. Test
   staff lines/spaces, range extremes normally supported by engraving,
   adjacent pitches, mixed signs, first/last neumes, divisions, clefs and
   custodes. Verify _no_ authored tick disappears or overlaps unrelated
   musical ink, and that shared measured bounds encompass all painted ink.
3. Verify committed SVG, ghost preview, hit/focus bounds, lyric anchoring,
   system wrapping, responsive 320px widths and stability of score's screen
   position on selection/deselection. Test keyboard Tab/selection and labels
   for both visual users and assistive technology.
4. Native v4 round-trip preserves exact semantic note IDs, pitch, lyric
   boundaries, division/clef order and all independent modifiers. Load the
   actual owner Pater Noster **v3** fixture unchanged, add one vertical
   episema, export v4, reimport and refresh; verify no source mutation.
   Include real v1 and finalized v2 fixtures. Strictly reject v1/v2/v3
   envelopes with the v4-only field; reject bad v4 types, unknown versions,
   malformed nested objects, invalid forms and oversize payloads.
5. Re-run previously protected incompatible draft-v2, corrupt-cache and
   cross-tab scenarios. A valid older cache hydrates without writes; a
   committed modifier edit saves v4 synchronously; failed import, storage
   error or conflict never silently overwrites original bytes.
6. Run `npm run format:check`, `npm run lint`, `npm test`,
   `npm run build` and `git diff --check`. Run existing standalone
   browser verification plus a targeted 8C driver in disposable Chromium
   and Firefox profiles, including production preview under
   `/gregorian-chant-editor/`. Capture signed/not-signed before-and-after
   screenshots, explicitly separate manual checks not run.

## Documentation and delivery

Update the authoritative domain, engraving, persistence and testing guides
for the additional modifier and v4 compatibility; update roadmap and ADR log
with a link to Proposed ADR 0020 (do not label it Accepted yet). Document that
vertical episema is _authored notation_, not inferred rhythm, and that manual
above/below override is deferred. Keep evidence in
`docs/verification/vertical-episemata/`.

Commit focused changes to this branch and open a PR against `master`.
Report visual reference comparisons, actual CI/local test results, semantics
and compatibility evidence, open research questions and what remains for
foreground owner inspection. **Do not merge.** The owner will visually
accept the engraving and decide ADR status before merge.

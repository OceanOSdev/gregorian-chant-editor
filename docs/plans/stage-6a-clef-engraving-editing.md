# Plan: Stage 6A — traditional C/F clefs and editable initial clef

Branch: `feat/stage-6a-clef-engraving-editing`
Target: `master`
Status: **Active implementation handoff; Stage 6A only.** Stages 6B and 6C are future separate PRs; this plan is not authority to implement them.

## Problem and user-visible goal

The editor currently stores a single `ChantDocument.clef` with `type: 'c'` and a line number, repeats that same clef on all automatically derived systems, and paints a placeholder text letter "C". Authors cannot edit its type or staff line in the editor. The owner wants conventional modern square-notation **C (do)** and **F (fa)** clefs, editable vertical placement, later insertable mid-score clef changes, and a score that resembles actual printed chant rather than text placeholders.

Agreed Stage 6 direction:

- **6A (this PR):** proper C/F glyph engraving; select and edit the _initial document clef_ (type and line) with pitch-preserving transformations, undo/redo, and keyboard/controls access.
- **6B (future PR after focused semantic/ADR review):** stable-ID clef changes inserted at explicit musical boundaries, integrated with divisions, note interpretation, derived system-initial clefs and wrapping.
- **6C (future PR):** complete graphical clef-change insertion, horizontal repositioning, visual caret/ghost, drag-to-line interactions and cross-browser acceptance.

6A must be genuinely usable, but should not masquerade as complete mid-score insertion/dragging.

## Essential reading and source context

Follow `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`, `docs/domain-model.md`, `docs/commands-and-history.md`, `docs/layout-and-rendering.md`, `docs/editor-interactions.md`, `docs/testing.md`, `docs/roadmap.md` and `docs/adrs/README.md`.

Inspect the current `src/editor/domain/chant-document.ts`, `src/editor/layout/layout-chant.ts`, `src/editor/rendering/ScoreSvg.tsx`, `src/editor/components/ChantEditor.tsx`, `src/editor/state/{selection,editor-session}.ts`, and focused command/history and SVG tests. The current clef is a value object, not a stable-ID item; `StaffPosition` measures line-or-space steps above the bottom staff line. Automatic systems currently all use the same global clef.

Accepted constraints:

- ADRs 0002/0003: canonical semantic data and stable identities distinct from derived geometry/interaction state.
- ADR 0007: shared, pure engraving geometry patterns.
- ADR 0008: lyrics anchor only to neumes.
- ADRs 0010/0011/0013: one authoritative measured wrapping/lyric composition pipeline; divisions interrupt compaction without altering word structure.
- ADR 0012: ordered divisions at explicit semantic neume boundaries, not a unified persisted score-item stream. **Do not revise that model in 6A.**

Reference modern square notation, rather than modern five-line treble/bass clefs or arbitrary text glyphs:

- Gregorio GABC, clef syntax and staff-line numbering: https://gregorio-project.github.io/gabc/#the-clef
- LilyPond, Editio Vaticana Gregorian clefs: https://lilypond.org/doc/v2.25/Documentation/notation/typesetting-gregorian-chant
- Real modern chant examples and the project's existing `docs/engraving-metrics.md` and verification images. Use references to judge contours and scale, not as an instruction to copy potentially restricted glyph assets.

## Agreed 6A scope and behavior

### Actual C and F clef engraving

- Replace the letter-C placeholder with recognizable, consistent **traditional square-notation C/do and F/fa clef SVG geometry** suited to the project's modern Vatican/Solesmes-style notation.
- Use a pure geometry builder or equivalent measure/render contract; do not depend on fragile Unicode font availability, browser-specific font fallback or hard-coded DOM coordinates.
- Clef geometry is anchored to its reference staff line and should appear correct on all four lines. Geometry and padding must be scaled to existing staff-step and stroke metrics. Provide correct occupied bounds and sufficient visual separation from the first neume on each system; keep the SVG layout/rendering/interaction picture consistent.
- Support `type: 'c' | 'f'` and staff lines **1, 2, 3, 4**, numbered bottom-to-top, for both symbols. Avoid needlessly forbidding a legal line simply because it is uncommon in a particular edition.
- Each automatic system repeats the effective global clef in 6A. Repetition is _derived engraving_, not an additional persisted clef event. The initial clef is always present, including empty scores. An unchanged C3 sample remains readable and musically identical.

### Editing the document's initial clef

- Provide a discoverable way to select the initial clef in the score, plus accessible, explicitly labeled **C/F** and **staff line 1–4** controls. Prefer simple controls consistent with the current editor rather than a new floating panel framework.
- Vertical movement must be possible without deleting/recreating the clef: while focused/selected in Select mode, Arrow Up/Down should move the reference line one legal line, or an equivalent clearly discoverable keyboard route if existing keys conflict. Include visible selection and focus feedback, but do not introduce a separate semantic ID for this singleton value object.
- Repeated automatic clefs on later systems should not be misrepresented as separate, independently movable clefs. Decide a predictable focus policy (e.g., first-system initial clef is the interactive instance; later copies are decorative, with an always-available editing control). Ensure score summary and accessibility explain the current _type and line_ instead of speaking only of C clefs.
- Keep active neume/division placement tools, remembered neume kind, lyric draft lifecycle, keyboard shortcuts, pointer event ownership, and ordinary notation selection working. Escape exits/clears appropriately. Do not require pointer drag for 6A; that is deferred to 6C.

### Melody preservation on an initial-clef change

**Owner-approved UX default:** Changing a clef's type or staff line should _preserve the melody_, rather than keep noteheads stationary while changing what pitches they mean. Editing the initial clef in 6A therefore repositions all existing note staff positions by a diatonic displacement. A pitch-changing/reinterpret-notation command is **not** part of this stage.

Pure transform definition for 6A (consistent relative diatonic interpretation):

- The clef's referenced staff position is `2 * (staffLine - 1)`.
- A C clef indicates diatonic degree C = 0; an F clef indicates degree F = 3 (C, D, E, F), in one consistent relative register convention.
- Relative note degree under a clef: `baseDegree(clef.type) + note.staffPosition - referenceStaffPosition(clef.staffLine)`.
- On changing the global clef, calculate each note's new `StaffPosition` by preserving that degree: `newPosition = oldPosition + (oldBase - oldReference) - (newBase - newReference)`.

Thus C3 -> C4 moves each written note up two staff steps; C3 -> F3 moves each written note down three steps. No chromatic/key-signature, playback, absolute-octave or note-name schema is being introduced; this represents staff-relative **diatonic** identity. Move _all notes of each neume_ by the same offset, retaining its kind, internal intervals, nested note IDs, neume IDs, syllable anchors, division IDs/order and lyrics. The command and history update the clef and notes **atomically**.

Positions outside the staff remain legal per the present domain model; do not silently clamp, delete, change note kind, or misreport preservation. Existing extreme-pitch/ledger-line rendering limitations are acknowledged; if the change produces illegible clipping requiring a large new layout/ledger-line system, stop and bring options rather than expanding 6A into that separate feature.

A no-op (same type/line) and invalid values must return the exact original document reference, consistent with existing command conventions. Avoid partial edits when input is malformed; validate before constructing new documents.

## Stage 6A exclusions and future architecture boundary

Do **not** in this PR:

- Add a persisted `clefChanges` array, stable-ID mid-score clefs, a second ordered event stream, or generalized pitch-storage model.
- Allow clef insertion between neumes or relative to divisions, horizontal repositioning, or deletion of the required starting clef.
- Add graphical insertion/drag previews, additional neumes, accidentals, custos, ledger lines, manual system breaks, PDF/GABC import/export, persistence, or audio/playback.
- Modify ADR 0012 insertion-boundary meaning or ADR 0013 compaction rules without the owner's explicit approval.

**Stage 6B architectural review, not 6A implementation:** Adding an actual clef event mid-score must define unambiguous ordering among neumes and divisions at the same semantic boundary; adjacent clef changes; what happens to clefs anchored to deleted neumes; whether trailing/empty clef events are legal; and how insertion, movement and removal preserve the pitch of the relevant downstream notes while the active clef switches. The effective clef at an automatically wrapped system start must be derived from the preceding semantic score order, not keyed to rendered system numbers. Width, lyric clearance, hyphens, and before/after insertion slots require the existing single authoritative layout. Those decisions warrant a **separate proposed ADR and owner acceptance gate** before the future full 6B implementation; do not guess them into the 6A code.

If a material decision about the global clef's pitch transformation or inherited notation conflicts with an accepted ADR, stop the affected implementation and report evidence and options, per `docs/ai-workflow.md`. Ordinary SVG measurements and component choices do not require a second approval.

## Acceptance and verification for 6A

Demonstrate, using pure TypeScript tests where applicable and browser verification for visual/interactive behavior:

1. Both glyph types have conventional silhouettes and exactly follow the chosen line on a real four-line staff; all 8 combinations of C/F × lines 1–4 are renderable. Reference-line placement and occupied bounds are tested, including wrapping and empty scores.
2. The initial C3 fixture's melody and notes remain unchanged. Changing C3 -> C4 moves all notes by +2 steps. C3 -> F3 moves all notes by -3 steps. Round trips restore the exact original clef/pitch values; multiple-neume intervals and identities survive, including pitches outside the four staff lines.
3. C/F or line change is one semantic undo/redo step with no accidental lyric, division or selection mutation. Invalid and no-op commands preserve exact object identity. Existing division/neume editing and history continue to work.
4. The initial clef can be selected and changed through actual editor controls and keyboard (including vertical movement), with meaningful labels, focus/selection cues and no shortcut conflicts. Later auto-repeated clef graphics are not falsely exposed as independent semantic clef entities.
5. All automatically wrapped systems display the same effective clef; layout, other notational ink and lyrics remain readable. Verify at ordinary and narrow viewport widths, plus basic focus after reflow.
6. Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build` and `git diff --check`. Follow `docs/testing.md` for relevant headless browser evidence. Distinguish automated/headless checks from manual foreground use; do not claim tests that were not performed.
7. Capture meaningful screenshots or recordings for C and F at representative lines. Owner reviews visual correctness against real chant scores before final merge. Do not claim publication-quality typography solely from passing tests.

## Documentation and ADR discipline

Update the authoritative domain, architecture, editor-interactions, layout/engraving, testing and roadmap guides where their current descriptions become false (for example, "C clef" or "placeholder"). Keep existing historical plan and verification records historical, rather than retroactively rewriting acceptance claims.

Because preserving semantic note identity by converting stored staff positions is a significant future clef-change design constraint, draft **Proposed ADR 0014** (or next available ADR number if numbering has changed) to record the Stage 6A rule, its relative-pitch mapping and limits, and the explicitly deferred 6B ordering/pitch-change questions. Do not mark it Accepted or claim it decides the future 6B boundary model. Where a current guide states the implemented rule, distinguish that factual implementation from formal ADR acceptance. The owner will review the proposed ADR and the actual PR.

## Delivery

Implement **only Stage 6A** on this branch, preserving unrelated local changes. Commit code/tests/docs, open a PR against `master`, and return the PR URL with actual check results, representative visuals, any design deviations, and remaining 6B/6C questions. Do not merge. Leave this plan on the review branch until the owner chooses whether to retain it with accurate historical status or remove it before merge.

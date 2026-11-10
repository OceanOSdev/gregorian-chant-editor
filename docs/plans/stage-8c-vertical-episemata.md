# Plan: Stage 8C — authored vertical episemata (ictus marks)

Branch: `feat/stage-8c-vertical-episema`
Target: `master`
Status: **Completed (owner-accepted 2026-11-10).**

The owner accepted the final engraving, consolidated contextual note properties
and ADR 0020, including its narrow screen-rendering qualification to ADR 0007.
ADR 0007 remains Accepted. This retained plan records completed scope and its
implementation history; PR #67 remains unmerged for the owner. Deferred manual
orientation overrides, blocked-autosave warnings and extreme-pitch layout work
remain outside this milestone. See the [acceptance record](../verification/vertical-episemata/README.md).

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

Read [Accepted ADR 0020](../adrs/0020-vertical-episema-presence-and-derived-placement.md)
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

## Agreed initial scope / accepted ADR

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
- Provide contextual selected-note properties with an independent
  “Vertical episema” field, without consuming score layout space or shifting
  the score on selection. The latest owner feedback below supersedes the
  original always-mounted inspector design. An Off→On/On→Off change is one undoable
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
  stop and report the conflict to the owner. ADR 0020 was kept Proposed during
  implementation; explicit owner acceptance was received on 2026-11-10 and
  its status is now Accepted.

## Owner-approved contextual editing follow-up (PR #67)

Approved in the [owner review comment](https://github.com/OceanOSdev/gregorian-chant-editor/pull/67#issuecomment-6740210401).
The original convenience panel was implemented, then replaced by the completed
consolidation below. The initial scope approval was not
engraving acceptance; the owner subsequently accepted the final result on
2026-11-10. Merge remains the owner’s responsibility.

- In Select mode, show a small contextual editing surface near the selected
  note for **Mora scope**, **Horizontal episema** and **Vertical episema**.
  Reuse `moraChoices`/`getMoraScope` and the existing `updateMoraScope` /
  `updateNoteModifiers` dispatch, history and synchronous autosave paths.
  No duplicate modifier state, new schema, validation or note-form rules.
- The original instruction to retain a comprehensive top inspector is
  **superseded** by the later owner feedback below. All note-property controls
  will derive from the same current semantic note/neume in the contextual panel.
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
  scopes, Form authoring, atomic Undo/Redo, synchronous autosave
  and immediate refresh. Check pointer/keyboard note focus, dismissal, scroll,
  resize/reflow and 320px in Chromium and Firefox against production preview.
  Retain before/after and narrow contextual screenshots and update the owning
  interaction/testing guides and verification record.

ADR 0020 is Accepted (owner-approved 2026-11-10). This is a transient
interaction addition within the existing semantic/layout/rendering boundaries;
report any material architectural conflict before implementing divergent behavior.

## Owner feedback: consolidation and stroke weight (PR #67)

Approved in the [latest owner comment](https://github.com/OceanOSdev/gregorian-chant-editor/pull/67#issuecomment-6740779436).
This explicitly replaces the earlier request to keep the top inspector. The scope update was committed before implementation. The final changes were owner-accepted on 2026-11-10.

- Make the contextual panel the sole primary note-property editor, adding
  **Form** with the existing `allowedNoteForms`, default/disabled behavior and
  `updateNoteForm` validation alongside the legal Mora scope and two episema
  fields. Remove the redundant top Selected note form and modifiers fieldset.
  Keep note ownership and disabled/rejected-edit feedback clear.
- Preserve existing note-form/modifier commands, semantic state, one-step
  history, autosave and native v4 behavior. No duplicate property state,
  alternate validation, new form rules or toolbar framework. Selection must
  not shift the score. Retain accessible pointer/keyboard opening and reopening
  from the selected note after Escape/Close, including narrow/focus conditions.
  All four controls must remain reachable at 320px and in short viewports.
- Investigate reported tick-weight differences using actual rendered repeated
  standalone Puncta on lines/spaces, varied horizontal positions, responsive
  scales and zoom in Chromium and Firefox. Inspect enlarged raster crops and
  geometry/overlap measurements alongside actual Gregorio/Solesmes references.
  Distinguish antialiasing/subpixel phase from collisions or unequal geometry.
- Apply only an evidence-supported small geometry/rendering correction if
  warranted. Retain authored semantics, stable IDs, v4 encoding and shared
  measured paint. No blanket `shape-rendering: crispEdges`, arbitrary thickening,
  orientation fields or unmeasured screen-only ink. If comparison evidence
  conflicts materially with the proposed placement or an Accepted ADR, stop.
- Update interaction/testing/engraving guidance as needed. Run affected pure
  tests and Chromium/Firefox production-subpath verification for all four
  contextual controls, no duplicated top editor, legal forms/scopes, history,
  refresh, pointer/keyboard focus/reopening and lower-score/320px behavior.
  Retain updated UI screenshots, rendered tick before/after crops and numeric
  findings, explicitly separating unverified foreground/browser-menu checks.

ADR 0020 and Stage 8C were owner-accepted on 2026-11-10.

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
with a link to Accepted ADR 0020 (owner-approved 2026-11-10). Document that
vertical episema is _authored notation_, not inferred rhythm, and that manual
above/below override is deferred. Keep evidence in
`docs/verification/vertical-episemata/`.

Commit focused changes to this branch and open a PR against `master`.
Report visual reference comparisons, actual CI/local test results, semantics
and compatibility evidence, open research questions and what remains for
foreground owner inspection. **Do not merge.** The owner accepted the engraving
and ADR 0020 on 2026-11-10 and will handle merge after CI.

## Completed follow-up: uniform vertical-tick rasterization

The [latest owner feedback](https://github.com/OceanOSdev/gregorian-chant-editor/pull/67#issuecomment-6741412693)
reports one versus two dark pixel columns at the same zoom after the clearance
correction. Separation alone does not satisfy optical consistency. Investigate
vertical-tick-only rasterization hints, including scoped crisp edges, against
unchanged antialiasing at varying horizontal phases, ordinary display sizes,
320px, large scales and device pixel ratios in Firefox and Chromium. Retain
native-size before/after long-score screenshots and quantitative raster checks.
Choose a minimal evidence-supported approach that retains the shared vector
geometry, measured bounds, relative size, preview parity and staff clearance.
Do not apply global hints, change other ink, add persisted display state or
redesign editing. If uniformity requires material geometry/bounds compromises,
report alternatives before implementing that approach. Update the owning rendering
guide and run affected regression checks. This follow-up was owner-accepted
on 2026-11-10; merge remains the owner’s responsibility.

Owner clarification authorizes option 1: a vertical-episema-only screen
rasterization tolerance of at most half a physical device pixel. Canonical vector
geometry, anchors, print, wrapping and hit geometry stay unchanged. Qualify ADR
0007 narrowly in Accepted ADR 0020; do not weaken the general geometry contract.
Re-align on screen scale/origin changes, reset for print, and retain canonical
rendering where a safe bounded alignment cannot be made. Guard the existing
collision and canvas clearances rather than expanding layout. Commit actual
normal-size before/after browser and print/vector comparisons for owner review.

The completed implementation uses tagged ticks sharing a screen-only phase
adapter, with physical/clearance/clip guards and unchanged print/vector attributes.
The [comparison record](../verification/vertical-episemata/rasterization.md) retains
normal-size browser pairs, raster measurements and identical print-page evidence.
Owner visual acceptance and Stage 8C closeout were recorded on 2026-11-10.

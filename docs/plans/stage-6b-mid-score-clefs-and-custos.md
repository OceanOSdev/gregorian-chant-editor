# Plan: Stage 6B mid-score clefs and derived custos

Branch: `feat/stage-6b-mid-score-clefs-custos`
Target: `master`
Status: Implementation handoff; **ADR 0015 Accepted (2026-11-08)**

## Problem and user-visible goal

Authors can currently edit only the required initial C/F clef (Stage 6A).
They need to insert, edit and remove **explicit mid-score C/F clef changes**
at whole-neume score boundaries, with no required division/bar, and see
faithful, readable guides (_custodes_) at clef changes and staff endings.
The result must retain music and lyrics reliably across edits, wrapping,
selection and undo/redo. Build a usable Stage 6B feature, not an architecture
prototype or unfinished UX scaffold.

## Authoritative decisions and reading

Read `AGENTS.md`, `docs/ai-workflow.md`,
`docs/adrs/0015-order-clef-changes-at-score-boundaries.md`
(**Accepted, authoritative for this milestone**), Accepted ADRs 0012,
0013 and 0014, and `docs/{architecture,domain-model,editor-interactions,
commands-and-history,layout-and-rendering,testing,roadmap}.md`.
ADR 0015 narrowly qualifies ADR 0012's division-only boundary operations
and ADR 0014's initial-clef affected range. Preserve the remaining
accepted contracts, including ADRs 0010/0011 measured lyrical geometry.
The historical `docs/plans/stage-6a-clef-engraving-editing.md` and its
older Stage 6C horizontal movement assumption **do not override** ADR 0015.
Check the actual code and tests rather than assuming historical docs describe
the current implementation.

## Agreed semantics and domain work

1. Retain the initial document `clef` as an ID-less value. Add a required
   collection of stable-ID explicit clef changes, independent from
   `neumes` and `divisions`. Each change has C/F type and staff line 1–4,
   with validated score-boundary placement. No persistent unified
   `(Neume | Division | Clef)[]` event array; derive a tagged score walk.
2. Use the ADR 0015 slot semantics: a clef can be anchored by
   `{ id, clef, beforeNeumeId, beforeDivisionId }`. Neume array governs
   ordered neume boundaries; division array governs divisions within each
   boundary; clef array governs clefs **within each division slot only**.
   Extend insertion intent to include `beforeClefId`: a referenced ID means
   insert before that clef in the specified slot, explicit null means after
   that slot's clef run. Validate slot membership, anchors, unique IDs across
   semantic entities, supported values and malformed inputs.
3. Preserve existing two-field insertion intents when their chosen slot
   contains no clefs. If an occupied slot omits the clef-side choice, reject
   ambiguity instead of guessing. Existing legacy numeric neume insertion
   is rejected at boundaries occupied by either divisions or clefs.
4. Preserve **relative derived score order** of every surviving item through
   all insert/delete operations: inserting a division splits a clef run;
   inserting a neume splits mixed boundary events; deleting a division merges
   neighboring clef runs; deleting a neume transfers and merges boundary
   events before destination events in their former derived order;
   deleting a clef deletes only itself. Neume normalization with stable ID
   retains anchors. Recalculate any division-slot references as necessary.
   Do not rely on global clef-array order when merging formerly distinct
   slots. A division is never a clef owner; deleting/retyping one retains
   adjacent clefs.
5. Permit leading, trailing, redundant and consecutive explicit clefs,
   even in empty or division-only scores. Keep all authored stable IDs; the
   **last preceding explicit clef** governs the next note; the required
   initial clef can govern no notes. Neume pitch interpretations follow
   semantic order, **not system indexes**. A change has no linguistic effect.

Examples demanding focused regressions:

```text
A C1 C2 B + insert D between C1/C2 => A C1 D C2 B
A C1 B D C2 E - delete B         => A C1 D C2 E
C3(initial) A C4 B F3 C           => editing C4 must not move C
```

Also exercise multiple divisions and clefs at one anchored neume,
reversed/non-global collection order, boundary merges, end-of-score and
empty-score placement, and invalid/stale references.

## Clef editing, pitch interpretation and session UX

- Provide discoverable **working** controls to insert a C/F clef at an
  explicit score boundary; choose type and staff line; select an authored
  change by its stable ID; edit and delete it with pointer **and keyboard**
  access. Reuse existing score insertion slots, selection/focus patterns and
  component conventions where feasible. Distinguish interactive authored
  clefs from pointer-inert system repetitions.
- **No free horizontal dragging/moving of an existing clef**, in this stage
  or as an assumed Stage 6C feature. To relocate, remove and reinsert at
  another boundary. **A first-class graphical clef placement tool is now
  required for Stage 6B**, including measured insertion slots, a clef ghost,
  staff-line snapping, and click-to-insert. See the owner-approved UX
  correction below; only nonessential cosmetic polish may be deferred.
- For insert/edit/remove of an explicit clef, compare **effective clef
  offsets** for existing surviving notes between the committed before state
  and the candidate final state. A change in governing event ID alone does
  not count. Prompt only if an existing note's interpreted pitch will differ:
  **Preserve melody** (default; move affected staff positions) or
  **Preserve noteheads** (retain positions and reinterpret pitches).
  Never prompt when no notes are affected, for net no-ops, or for redundant
  same-offset changes; never silently discard a redundant authored event.
- Preserve melody uses ADR 0014's mapping:
  `offset(clef) = base(type) - 2*(staffLine-1)`, where C=0 and F=3;
  `newPosition = oldPosition + oldOffset - newOffset`.
  Limit any transposition to the notes whose effective offset changes;
  notes following the next surviving explicit change are unaffected.
  Preserve IDs, tuple shape, contours and lyric association. Prevalidate
  all candidate note positions, safe integer arithmetic and neume invariants;
  no partial mutation or staff clamping. Out-of-staff notes remain valid.
- Initial-clef editing **always preserves melody without asking**. Scope its
  shift to notes governed by the initial clef before the first explicit
  change; initial edits in documents without explicit changes behave exactly
  as in Stage 6A.
- For repeated edits of an explicit clef type/line, use a **transient draft**
  with clear Apply/Cancel; do not apply an intermediate semantic edit for each
  arrow/select change. When applying, evaluate the final candidate against
  the original committed state, show at most one preservation prompt, and
  commit one immutable document/history entry. Cancel and returning to the
  original value must leave document, undo/redo stack and redo branch
  untouched. Undo/redo of the final edit never prompts.
- Define Escape precedence, selection/focus restoration (including reflow,
  deletions and returning focus after a dialog), dirty lyric draft policy,
  and protection against stale confirmation and concurrent edits in the
  existing session/reducer pattern. Block conflicting semantic changes
  and history navigation while a transaction is pending. Avoid a
  general-purpose transaction framework.

## Engraving and custos

1. Integrate derived clef events into the **single authoritative measured**
   placement/wrapping walk. Carry effective clef with the semantic cursor,
   reserve clef/custos widths and bounds in music/lyric/hyphen/slot clearance,
   and include their interactive/selectable geometry where applicable.
   Keep derived glyphs and caret/hit zones synchronized; no renderer-only
   teleports or suppression after wrapping. Mixed oversized runs must
   make bounded progress, never drop symbols, and avoid infinite wrap.
2. At a **continuation-system start**, if its first semantic event is an
   authored clef, render that first clef in the normal leading-clef position
   with its ID/accessible control. Do not also repeat the old decorative
   clef. Preserve subsequent authored consecutive clefs individually,
   including redundant ones. If a division occurs first, repeat the
   incoming effective clef decoratively, then draw the division and
   later explicit change in semantic order. Always retain the required
   initial clef on the **first** system.
3. Allow a preceding bar to stay at the end of one staff when an explicit
   new clef begins the next, if measured fit supports it. Don't split a
   neume or rewrite semantic ordering to force this layout; preserve
   ordinary phrase-ending bar behavior where possible.
4. **Include automatically derived custos in Stage 6B.** Before a
   mid-staff clef change, show the upcoming pitched note under the
   clef effective at the guide's location. At a system ending, show the
   next pitched note under that outgoing clef, even if the next system
   begins with a new explicit clef. Use a single end-of-system guide
   rather than an extra detached guide for the same transition.
   Use the committed final music:
   ```text
   guidePosition = nextNotePosition
                 + offset(nextNoteEffectiveClef)
                 - offset(clefAtGuideLocation)
   ```
   The guide is derived, non-pitched, non-interactive SVG geometry and
   not an independently stored note or history item.
5. Suppress guides with no following note, for no-op/redundant offset
   changes, and redundant guide duplication at a staff break. For
   consecutive changes governing no intermediate notes, do not create
   a guide per unused clef; at most one meaningful guide anticipates
   the next pitched note. Support division-only/trailing cases.
   Don't infer new word boundaries, forced hyphens, or accidental
   cancellation. Follow ADR 0013's division-specific compaction
   exception; clef/custos spacing is geometry-driven.
6. Prefer existing approved C/F glyphs, staff metrics and pure geometry
   builders. Inspect the _Liber Usualis_ introductory guide examples
   for appearance/proportion; distinguish printed evidence from
   our accepted layout policy. Do not redesign approved C/F contours.

## Expected implementation and documentation

Work in existing domain, command, layout, rendering, interaction, session
and test layers as appropriate. Examples to inspect:
`src/editor/domain/{chant-document,divisions,clef}.ts`,
`src/editor/commands/update-clef.ts`,
`src/editor/layout/{layout-chant,clef-geometry}.ts`,
`src/editor/rendering/ScoreSvg.tsx`,
`src/editor/components/ChantEditor.tsx`, and
`src/editor/state/{editor-session,selection}.ts`.
Names are pointers, not an imposed file-by-file design. Avoid a sweeping
refactor or excessive facade files.

Update authoritative guides when their _implemented behavior_ changes,
especially domain-model, editor-interactions, commands-and-history,
layout-and-rendering and roadmap. Do not retroactively rewrite historical
Stage 6A plans or accepted ADRs; ADR 0015 already records their narrow
qualification. Keep durable references accurate.

## Owner-approved Stage 6B UX correction (2026-11-08; mandatory before PR #60 merge)

**This section supersedes the original allowance to defer graphical clef
insertion, and the temporary full-score event-index selector introduced in
PR #60.** The owner manually tested the implementation and rejected the
form-first workflow. Do not treat the underlying feature as complete until
placing a clef feels like placing a neume or division. This is a UX scope
correction within Accepted ADR 0015, **not** a new musical-domain decision:
retain bar-independent boundaries, stable IDs, scoped pitch choices, automatic
custodes, the measured layout model, and atomic history. Existing-clef type/
line **editing** must still obey ADR 0015's transient draft + Apply/Cancel.

### Owner-approved one-click insertion mode (2026-11-08)

This **supersedes** earlier wording in this handoff allowing a
post-click Preserve melody / Preserve noteheads dialog for **insertion**.
The subsequent owner-approved shared-mode amendment also removes the
post-Apply choice for **editing existing clefs**.
The owner explicitly wants the behavior chosen **beforehand** and a
genuinely one-click insertion interaction. Accepted ADR 0015 is narrowly
amended on this branch to match. Existing-clef **editing** continues to
use Apply/Cancel but adopts the same preselected mode, with no further
choice prompt. Existing-clef **deletion** retains conditional confirmation.

- While either **C clef** or **F clef** placement tool is selected,
  show a compact **Insertion behavior** control visibly near the
  toolbar: **Keep pitches (move existing notes)**, selected by
  default, and **Keep note positions (change pitches)**. Include a
  short description: the first shifts existing noteheads to keep
  pitches; the second retains notehead positions and changes
  interpreted pitches. Don't require users to interpret the
  jargon alone. This is a tool option, not a separate modal.
- Store the choice in **transient editor session state**, not in
  `ChantDocument`. Preserve it across consecutive placements and
  switching between C/F tools. Default to Keep pitches at editor
  initialization. The currently active choice must be easy to see
  **before** committing. A refresh may reset it to the default.
- **Click-to-insert** commits atomically under the selected mode,
  including when existing notes' interpretations change. No
  post-click dialog, no extra Apply button, no second confirmation.
  Pointer and keyboard insertion use the **same selected mode**
  and validated semantic boundary. Leave the placement tool armed
  after each successful click. No-note-affected insertion commits
  immediately under either mode.
- If the chosen mode cannot safely apply (for example Preserve
  melody overflows a safe staff position), do not auto-fallback
  to the other mode. Reject without history or document mutation
  and give an accessible nonmodal explanation near the tool;
  the author can choose the alternate mode and retry.
  Preserve existing lyric drafts, focus/selection rules and
  protection against stale/repeated clicks.
- The clef ghost and snapped caret remain required.
  An optional preview of the resulting shifted **existing notes**
  would make the mode's effect clearer, but is **not a blocker**
  if it requires a disproportionate measured-layout rewrite.
- **This mode governs insertion AND edits of an existing authored
  clef.** Existing-clef editing still stages type/line changes
  with Apply/Cancel; Apply uses the shared mode with **no further
  preservation dialog**. Deletion keeps its separate conditional
  pitch choice. Initial-clef editing remains always melody-preserving
  under ADR 0014. No horizontal relocation.
- **Tests:** both modes with affected notes, unaffected/trailing
  changes, repeated C/F clicks without any modal, persistence of
  selected mode across tool switches, keyboard parity, correct
  note positions/pitches, safe arithmetic rejection/no silent
  fallback, one history entry per insertion and exact undo/redo.
  Verify Chromium/Firefox and 320px containment. Record screenshots
  of mode control, ghost, and insertion before/after. Update the
  owning interaction guide and PR verification only when implemented.

### Owner-approved shared pitch mode for existing-clef editing (2026-11-08)

The owner wants **one consistent pitch-handling mode for insertion and
editing**. This narrowly amends Accepted ADR 0015's _post-Apply_
confirmation requirement for edits. It does not alter the semantic
representation, preserve-melody formula, or atomic history.

- **Reuse `clefInsertionPolicy`** (or rename it appropriately to
  reflect its shared role); do not introduce a duplicate policy state
  that can disagree. Keep the chosen mode transient and consistent
  between C/F placement tools, Select mode, and staged editing.
- Keep **Keep pitches (move existing notes)** and **Keep note
  positions (change pitches)** visible/accessible while an authored
  clef is selected and while its edit draft is open, not only while
  a placement tool is active. Choosing a mode never edits music
  or adds a history entry. No need for a global settings screen.
- Existing-clef editing flow: **select clef → choose behavior if
  desired → change type/line in a transient draft → Apply → done.**
  Apply determines affected existing notes from the original
  committed document and final draft, applies the selected mode,
  and commits exactly **one** undoable edit. **Never show the
  preservation popup after Apply**, even if note interpretations
  change. No-op Apply creates no history; Cancel/Escape preserves
  document, redo branch, dirty lyric drafts and focus semantics.
- On an unsafe Keep pitches result, leave the draft pending,
  announce a nonmodal validation error near the editor, and allow
  the user to switch to Keep note positions or revise the clef
  and retry Apply. Do not silently fall back, partially modify
  music, or incorrectly reject a safe Keep note positions result.
- **Do not change deletion yet:** removing an existing clef
  retains the current conditional pitch-choice confirmation.
  Changing the required initial clef remains automatically
  melody-preserving (Accepted ADR 0014).
- Add unit/browser regressions for editing type and line under
  both modes with affected notes, no popup, unchanged later
  clef-governed notes, safe overflow rejection, final no-op,
  cancel, one undo/redo entry, and mode persistence across
  insertion → edit → insertion. Test keyboard arrows and the
  contextual editor, Chromium and Firefox, and 320px.
  Update the interaction guide, browser verification record and
  screenshots, and report genuinely tested results.

### Primary interaction: direct in-score placement

1. **First-class C and F placement tools.** Put visibly labeled `C clef`
   and `F clef` choices alongside the existing neume placement tools in the
   main notation toolbar (or a tightly integrated adjacent toolbar group,
   not a big standalone clef form). They participate in the established
   selection/pressed state, roving keyboard navigation and Escape-to-Select
   patterns. The new mode is persistent like a neume/division tool. Switching
   away or pressing Escape clears the uncommitted preview.
2. **Pointer hover and snap.** While a clef tool is armed, hovering over a
   valid four-line staff previews the **real approved C/F clef silhouette**,
   translucent and pointer-inert, aligned to an existing semantic
   `ScoreInsertionBoundary` horizontally. Show the existing caret/slot
   indicator so the author can distinguish before versus after neighboring
   neumes, divisions and clefs (including at starts/ends of systems).
   Vertically snap to one of the **four staff lines**, derived from the
   pointer Y coordinate and current displayed system geometry: line 1 is
   bottom, line 4 is top. Never silently clamp an off-staff pointer to a
   valid line: outside a reasonable staff hit band, hide the preview and
   reject the click. Preserve precisely the previewed slot and line.
3. **Click-to-insert.** Clicking a previewed location inserts that C/F
   value and staff line at that semantic boundary, with no separate
   insertion-boundary dropdown, line selector, or generic `Apply` dialog.
   The preselected **Insertion behavior** mode determines how affected
   existing notes are treated. Commit immediately on click with no
   pitch-choice modal, even when notes are affected; an invalid result
   must reject the click without mutation. Unaffected/trailing
   insertion also commits directly. The placement tool remains armed
   after every successful click, as it does for neumes.
4. **Reuse authoritative mechanics.** Resolve both preview and click using
   the existing measured layout and stable score slots
   (`resolveScoreSlot`, `layoutChant`, approved `buildClefGeometry`);
   re-resolve the click against latest committed state using the pointer
   coordinate plus measurement snapshot, as current neume/division
   placement does. Staff line is derived from that same current system.
   Do not use a numerical event index as semantic authority. Invalid,
   stale or conflicting targets must not commit. No pixel coordinates,
   caret X values or tool mode belong in persisted `ChantDocument`.
5. **Simple, unobtrusive UI.** Remove the giant `Mid-score clefs` fieldset,
   its full-score index dropdown, and its two-step insertion wizard
   as the normal workflow. A visually compact selected-clef control
   (if needed) and the existing initial-clef controls may remain.
   Show concise instructional text and focus states, not domain internals
   like `beforeNeumeId` or event numbers. Show the preselected
   insertion mode near the C/F tools, not in a modal. The existing
   clef edit/removal prompt can reuse transaction infrastructure.
   Keep the required first-system initial clef separate.

### Selected-clef editing

- Selecting an authored clef in Select mode (pointer or keyboard) should
  expose a discoverable, compact way to change **C/F type** and staff line
  without searching a global `Authored clef` dropdown. Arrow Up/Down on
  the selected clef is an existing entry point; preserve it.
- Per **Accepted ADR 0015 as amended**, repeated type/line adjustments
  of an existing clef remain a **transient draft** until explicit
  Apply/Cancel. Apply uses the **shared preselected pitch mode** and
  commits once without a second confirmation choice. Use compact
  contextual controls and (where safe) an in-score draft preview.
  Do not commit each arrow press. Delete/Backspace remains accessible;
  **deletion**, unlike editing, retains its conditional pitch question.
- A changed or deleted clef retains appropriate selection/focus; decorative
  repeated system clefs and derived custodes are never selectable.
  **No horizontal dragging/repositioning of an already authored clef.**

### Owner clarification: selected-clef vertical arrow editing (2026-11-08)

**Only Up/Down move an existing clef.** Do **not** bind Left/Right to
horizontal clef relocation, reanchoring, or score-boundary hopping.
ADR 0015's prohibition on moving an authored clef horizontally remains
unchanged. This clarification concerns editing an authored mid-score
clef, not the separate keyboard placement cursor or ordinary note
navigation.

- In **Select** mode, focus/select an authored clef in the score.
  Press **ArrowUp** to shift its *draft* up one staff line or
  **ArrowDown** to shift it down one staff line (lines 1–4).
  If no draft is open, the first arrow press begins the draft **and
  applies that first one-line change**; it must not be swallowed.
  Continued arrow presses adjust that **same** draft, including after
  the first press, with an in-score preview at the currently drafted
  staff line. Keep keyboard focus on the engraved clef (or a stable
  in-score editing target) through the whole arrow sequence; **do not
  steal focus into the contextual form on the first press**.
- Arrow presses **must not change committed music or history**.
  The existing compact contextual editor should reflect the current
  draft line, and **Apply** commits the final draft once using the
  shared Keep pitches / Keep note positions mode, with no extra modal.
  **Escape/Cancel** discards all staged arrow changes. Focus and
  selection should remain intuitive after Apply, Cancel and reflow.
- Reaching line 1 or 4 should stop movement; do not wrap around,
  change clef type, reanchor, or trigger a new history entry.
  **Left/Right do not move the clef**. Leave the initial-clef
  shortcut and keyboard *insertion* slot navigation semantics intact.
- Add reducer and real-browser tests for first-press adjustment,
  **multiple consecutive** Up/Down presses while in a draft,
  focus retention, all bounds, Apply vs Escape, single atomic undo,
  shared-mode pitch outcome, and unchanged Left/Right behavior.
  Test both pointer-selected and keyboard-selected clefs, including
  a change that reflows the staff. Update keyboard help to describe
  the actual behavior rather than implying arrows merely open a form.
  Do not introduce horizontal movement, dragging, a new editing
  transaction mechanism, or a broad keyboard-navigation refactor.

### Keyboard, consistency and transaction rules

- Provide a **keyboard-only route** to choose C/F, choose line 1–4 and an
  explicit score slot (e.g. accessible in-score slot navigation or a compact
  fallback only for keyboard insertion). The keyboard path must have the
  **same boundary, note interpretation and history semantics** as the
  pointer path; do not reintroduce a giant global event dropdown as the
  primary interface. Roving toolbar arrows, Space/Enter, Escape, tab order,
  focus return and accessible names must work with existing tools.
- Respect pending lyric drafts and their navigation/recovery policy,
  undo/redo prompts, pending **existing-clef** edit/removal
  transactions, graphical neume placement and division placement.
  One armed tool at a time; insertion uses its preselected mode,
  so there is no pending confirmation for placement. Competing edits
  while an existing-clef operation is pending remain blocked.
  Cancel preserves the original history/redo branch and lyric draft.
- Do not regress keyboard `I` inserting the remembered **neume**, the
  initial-clef editor, the division palette, existing pointer hit zones or
  the screen-reader summary. Keep score cursor/render and pointer/keyboard
  placement within measured bounds even on 320px viewport and at zoom.

### Acceptance tests for this UX correction

- Browser-demonstrate: choose C, hover between two neumes, see the correct
  ghost and caret; move vertically across all four lines; click and verify
  the authored clef appears **at the previewed line/slot** without a
  preliminary modal. Repeat for F, before/after an existing clef,
  before/after adjacent divisions, beginning/end of score, across
  wrapping, and with multiple consecutive clefs.
- Verify **both preselected insertion modes commit in one click**,
  including with existing notes affected and no intermediate dialog.
  Keep pitches shifts noteheads; Keep note positions changes interpreted
  pitches. Unaffected insertions commit under either mode.
  Reject unsafe policy without fallback or history mutation.
  Check exact undo/redo, retained policy across C/F tools and
  keyboard parity. For existing-clef editing, verify transient
  draft, Apply/Cancel using the shared mode with **no post-Apply
  choice**, invalid-mode recovery, and cancellation.
  Test stale/reflowing boundaries.
- Unit-test pointer-to-staff-line snapping/tolerance, shared
  preview/commit boundary resolution, guards against stale/out-of-band
  clicks, transaction serialization, and conservation of authored IDs,
  lyrics and derived custos. Browser-exercise native pointer behavior,
  toolbar keyboard navigation, keyboard-only insertion, focus return,
  320px containment, and Chromium/Firefox. Retain previous 1,202 test
  regressions and the relevant legacy browser suites.
- Capture **actual UI screenshots or a short recording** showing C/F
  ghost, visible insertion mode, one-click inserted result and
  Apply/Cancel on existing-clef edits with no post-Apply
  preservation confirmation. Update `docs/editor-interactions.md`, tests/verification
  record, accessibility instructions and any now-stale Stage 6B/6C
  roadmap claims. Do not claim tested flows without running them.
- Before merge, report the smallest manual owner test script:
  choose C or F → preselect Keep pitches or Keep note positions → hover
  → click once → edit selected clef → undo/redo.

### Explicit exclusions and stop condition

No generalized event stream, new pitch model, horizontal clef drag, manual
system breaks, SVG path redesign, unrelated global UI redesign, new
dependency or persistence migration. Keep this change within existing
PR #60 on `feat/stage-6b-mid-score-clefs-custos`; **do not merge**.
Stop for owner decision only if a material conflict with Accepted ADR 0015
cannot be resolved without changing its contract. A **simple immediate
graphical insertion** with conditional pitch choice does not waive the
accepted **staged edit** lifecycle for modifying an existing clef.

## Acceptance criteria and verification

- Unit-test domain validation, derived score order, insertion slots,
  split/merge/reanchor rules, legacy boundary ambiguity, all C/F line
  transformations, scoped pitch preservation/reinterpretation and
  unaffected later passages; check referential identity on no-op/invalid
  commands, where appropriate.
- Test leading, trailing, consecutive and redundant clefs; removal and
  division-kind changes; empty/only-divisions scores; neume deletion
  across boundary convergence; and initial-clef scope.
- Test deterministic guide pitch for different outgoing/incoming clefs,
  including a next note on another system; no following note; multiple
  clefs without notes; redundant changes; and a guide removed at a
  mid-staff-to-system-break transition.
- Test measured wrapping, exact fit, long mixed-event progress,
  no duplicated/missing system-leading clefs, separated preceding bar,
  clearance among neumes/divisions/lyrics/hyphens, source IDs for hit
  targets, and multi-system selection/focus.
- Browser-exercise the first-class graphical C/F insertion and selection
  UX described in the owner-approved correction above, including a
  visible **preselected insertion mode with no post-click prompt**;
  staged Apply/Cancel using the same preselected mode with **no
  post-Apply pitch choice for existing-clef edits**, undo/redo,
  Escape, dirty lyric drafts,
  keyboard-only use, narrow screens, and focus after reflow.
  Capture screenshots/short recordings for mid-staff and break
  examples; allow owner to inspect engraving.
- Run `npm run format:check`, `npm run lint`, `npm test`,
  `npm run build`, and `git diff --check`. Follow `docs/testing.md`
  for project-specific Chromium/Firefox browser drivers as applicable.
  Distinguish checks actually run from manual owner checks, skipped
  checks, and unverifiable source-engraving claims.

## Stop conditions, exclusions and delivery

Stop and report evidence/options **before** implementing a material
conflict with Accepted ADRs or a materially different architecture
(e.g., replacing the accepted derived ordering model, introducing
a new pitch data representation, or changing accepted guide semantics).
Ordinary local design and visual tuning do not need owner approval.

Do **not** implement horizontal clef dragging, general accidental
support, playback, absolute pitch storage, persistence migrations,
manual system breaks, ledger-line redesign, external GABC import/export,
a unified persisted event stream, or unrelated neume/refactor work.

Implement on this branch, commit code/tests/necessary documentation,
and open a PR against `master`. Include concise behavior summary,
tested commands/results, screenshot or recording links for meaningful
engraving and interaction, any deviations/remaining limitations, and
specific manual test suggestions. **Do not merge.** Preserve the
handoff plan on the PR branch until the owner chooses its closeout
(remove as one-off or retain with explicit completed/historical status).

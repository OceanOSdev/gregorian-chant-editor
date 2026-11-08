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
  another boundary. Fine graphical insertion ghosts/drag aesthetics may be
  deferred, but 6B must provide an understandable, accessible insertion path.
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
- Browser-exercise the real insertion and selection UX, staged Apply/
  Cancel, one-shot pitch-choice prompts, undo/redo, Escape, dirty lyric
  drafts, keyboard-only use, narrow screens, and focus after reflow.
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

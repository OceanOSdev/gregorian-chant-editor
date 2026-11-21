# Plan: Editor readability M4A — clarify session transition ownership

Branch: `refactor/editor-readability-m4a`
Target: `master`
Base: current `master` at branch creation (2026-11-21)
Status: Committed handoff plan; **no implementation has started**.

## Why this milestone

The owner wants to understand and modify ChantPad personally. The acceptance
criterion is not simply shorter files: architecture should make behavior and
responsibility boundaries obvious to a human developer.

M1 (PR #94) clarified notation-palette ownership, M2 (PR #95) extracted
interactive SVG controls, and M3 (PR #97) clarified the layout pipeline.
On the inspected `master`, `ChantEditor.tsx` is 1,543 lines and
`state/editor-session.ts` is 1,904 lines. They are separate problems.

The immediate difficulty in `editor-session.ts` is **understanding the
priority and ownership of transitions**. The public `reduceEditorSession`
calls `reduceEditorSessionAction`, which handles passage/selection and
accidental placement and reconciliation, then `transitionEditorSession`,
which handles clef transactions, lyric moves, history prompts and drafts,
before delegating ordinary actions to `reduceSessionAction`.
The first ordinary-action switch includes a list of action types that
deliberately return the unchanged state because they are handled at earlier
layers. That structure is correct in intent but difficult to navigate.

The goal is to make this pipeline easier to read, trace, and modify, while
preserving every existing semantic, transaction, focus and history rule.

## Architectural contracts

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`,
`docs/commands-and-history.md`, `docs/editor-interactions.md`,
`docs/testing.md`, and the relevant accepted ADRs before modifying their
contracts. Inspect current code and tests rather than relying on the
inventory above as proof of runtime behavior.

- `ChantDocument` remains the sole authoritative score.
- `document-history.ts` remains the sole semantic undo/redo owner.
- `reduceEditorSession` remains the single public pure editor-transition
  entry point, with the existing `EditorSession` and `EditorAction`
  contracts compatible for all callers.
- Commands remain immutable and domain focused; rendering/React/browser
  event handlers remain outside the pure session reducer.
- Guard precedence is behavior. Rejected operations, dirty-draft
  preservation, transactions, action batching, request acknowledgement,
  announcement sequences and no-op reference identity all matter.

## Scope: **one behavior-preserving M4A implementation PR**

### 1. Make the dispatcher and guard ordering legible

Before extraction, write a compact transition/ownership map derived from
the implementation (not from anticipated design). Explain the current
ordering of clipboard, range selection, accidental-placement ownership,
clef transactions, lyric moves, pending history, lyric drafts, ordinary
edits, cross-cutting reconciliation and announcements.

Make that ordering discoverable in the source near the public reducer entry
point. Where appropriate, give coherent phases descriptive names and make
the entry point read top-to-bottom. Preserve exact ordering and behavior.
Avoid a new generic action-handler registry, generic middleware framework,
a giant context object, or a second transition authority.

### 2. Refactor one cohesive, proven seam at a time

Start with the transactional reducer logic, especially the clef transaction
and lyric-move/history guard regions in `transitionEditorSession`. Consider
extracting one **pure, cohesive** transition family into an internal helper
or module only when its input/output and dependencies are explicit and it
actually improves comprehensibility. Keep related state, preflight,
commit/cancel behavior and focus/announcement policy together.

If extraction would require a large bag-of-state parameter, duplicate
history ownership, circular runtime imports, or non-obvious callback
injection, leave the logic together and instead improve names, control
flow, phase comments and test coverage. A shorter reducer is not a
success criterion. Preserve `reduceEditorSession` as the caller's only
entry point and avoid a broad public API expansion.

The existing deliberate no-op cases in `reduceSessionAction` deserve
special examination: a maintainer should be able to tell _why_ an action
does not belong to ordinary handling, without searching three switches.

### 3. Characterize existing behavior before restructuring it

Use the current reducer and tests to establish the important transition
chains. In particular, trace:

1. A note movement: renderer intent → `ChantEditor` dispatch →
   edit/command → history and selection reconciliation → focus request.
2. A syllable correction: lyric intent → session transition →
   `transitionLyrics` → single undoable edit/draft state → focus.
3. A clef change: start/draft/apply or cancel, including preserve-melody
   decisions and the conditions that suppress other actions.

Add targeted _pure_ regression tests if necessary to pin down ambiguous
guard precedence, no-ops, and representative outcomes before moving code.
Favor tests that would fail if the ordering changed.

### 4. Keep this milestone narrow

Do **not** change:

- `ChantEditor.tsx` composition, toolbar layout or SVG markup;
- keyboard shortcuts, Lyrics/placement UX or issue #99;
- persisted schema, musical commands, layout or playback behavior;
- external session action names or the single source of semantic history;
- browser-test infrastructure, build tooling, or unrelated naming/style.

Readability improvements that cannot be explained as clarifying ownership
or the action flow are outside this PR. Do not merge other M4 work into it.

## Test and acceptance requirements

- Existing behavior is unchanged for successful actions, rejected actions,
  announcements, focus requests and history. Preserve stable IDs, event
  order, and exact unchanged state/document identity where existing
  contracts require it.
- Explicitly test cross-transaction precedence involving an active clef
  transaction, accidental placement, lyric move, pending undo/redo
  resolution, dirty or recovery lyric drafts, and range selection.
- Test at least representative undo/redo, edit rejection,
  `focus-handled` acknowledgement, accidentals reconciled after an
  edit, and clipboard feedback lifecycle.
- Run `npm run format:check`, `npm run lint`, `npm test`, and
  `npm run build`. Run focused relevant browser verification under
  `npm run verify:browser` when feasible; record exactly which
  Chromium/Firefox checks ran and whether they passed. Do not claim
  manual checks that were not performed.
- Review the refactored code by following the three traces above. A
  developer should be able to identify the decision owner, guard and
  final history/focus effect without hunting across ambiguous wrappers.
  Clearly document where to change a transition rule in one appropriate
  existing guide (not a redundant new architecture document).
- Keep the diff mechanically comprehensible; separate behavior-neutral
  move/rename commits from substantive control-flow edits if possible.
  Explain any code movement and remaining large cohesive regions in the
  PR description.

## Stop conditions and owner review

Stop and present evidence/options instead of proceeding if:

- the reorganization requires altering a public action contract, history
  semantics, transaction guard precedence or an accepted ADR;
- a proposed extracted module would introduce a runtime dependency cycle;
- differential/characterization tests show a behavior change;
- no candidate extraction actually improves readability.

Make the smallest justified change, even if the result is a still-large
file. No new ADR is expected for a behavior-preserving refactor.

## Subsequent milestone (not authorized on this branch)

**M4B — editor-shell readability**, only after M4A is reviewed/merged:
inspect `ChantEditor.tsx` selection/context projections, command bindings,
keyboard/browser wiring and `ScoreSvg` callback integration. Favor clear,
named responsibilities and minimal props over a monolithic controller hook
or a large `ScoreSvgProps` forwarding object. A separate plan and branch
should define M4B after inspecting the M4A result. Keep issue #99 deferred.

## Deliverable

Implement only M4A on this branch. Commit changes, open **one reviewable PR**
against `master`, and report changed responsibilities, guard-order evidence,
test results, limitations, and any follow-up candidates. Do not merge.

# Plan: Editor readability M4B — `ChantEditor` shell ownership

Branch: `docs/editor-readability-m4b-plan` (this plan only). Each milestone
below uses its own branch and PR.
Target: `master`
Base: `1ba1de5ec3c58af1492dc07d2fb887fd154d9268` (M4A / PR #105 merged)
Status: Owner-agreed direction (Approach A). Plan under owner review; **no
milestone is authorized or implemented yet**.

## Goal and rationale

Make `src/editor/components/ChantEditor.tsx` easy for a human developer to
understand, navigate and change. The aim is comprehensibility through clear
ownership. Line count is **not** an acceptance criterion. Where moving code
would make the architecture harder to follow, the code stays in the shell.

M1 (PR #94) split the palette and action bar. M2 (PR #95) extracted interactive
SVG controls. M3 (PR #97) clarified the layout pipeline. M4A (PR #105) made the
session reducer's transition phases explicit. M4B builds on M4A and must keep
its reducer architecture intact.

### Starting inventory (`1ba1de5`, 1,542 lines)

Treat this as orientation, not as proof of behavior. Inspect source and tests.

| Region                                                                                                  | Approx. lines                | Assessment                                   |
| ------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| Keyboard-scope helpers (`isEditableTarget`, `isClipboardScope`, …)                                      | 111–147                      | Fine                                         |
| Session, playback store, lyric measurement, layout                                                      | 150–193                      | Shell; stays                                 |
| Refs and presentation focus memory (`focusedDivisionId`, `focusedLyricId`, `resetPresentationState`)    | 171–186                      | Shell; stays                                 |
| Selection projections, including selected-note effective B and written sign                             | 194–237                      | Partly misplaced view-model logic            |
| Toolbar DOM getters; `getSelectedNeumeElement` also writes `neumeToolbarOrigin`                         | 223–271                      | Hidden side effect                           |
| UI availability (`noteToolbarAvailable`, `toolChangesBlocked`, `canTargetEntry`, inline JSX conditions) | 272–286, 410–416 and JSX     | Scattered, unnamed variants                  |
| Note/neume edit bindings (`changeNoteForm`, `changeLiquescence`, …)                                     | 287–337                      | Fine as named functions                      |
| Placement, division and clef previews                                                                   | 338–409                      | Shell projection; fine                       |
| Dispatch bindings (arm, history with focused IDs, insert, copy/paste)                                   | 417–525                      | Shell; stays                                 |
| Document keyboard listeners (bubble and capture)                                                        | 527–694                      | Implicit precedence                          |
| `<main>` capture handlers (lyric-move keys, focus tracking, keyup sync)                                 | 700–753                      | Part of the keyboard precedence              |
| Inline panels: initial clef, lyric language, pitch handling, divisions, accidental properties body      | 783–860, 900–1038, 1349–1485 | Feature UI living in the shell               |
| `ScoreSvg` wiring (about 50 props, about 30 inline closures)                                            | 1079–1301                    | Intent handling and view models mixed inline |
| Note/neume toolbars, `SyllableControls`, fallback alert, live region                                    | 1303–1538                    | Mostly fine                                  |

### Problems this plan addresses

1. **Feature panels inline in the shell.** The initial clef, lyric language,
   pitch handling, division and accidental-properties markup (about 350 lines)
   is defined in `ChantEditor`, unlike its siblings `ClefChangeControls`,
   `SyllableControls` and `NoteContextToolbar`. `AccidentalContextToolbar`
   owns positioning, but its content is supplied as children by the shell.
2. **Unnamed, intentionally different availability rules.** About eight
   variants of "blocked while a lyric move, history prompt or clef transaction
   is active" appear inline. They intentionally differ. For example, lyric
   language omits the clef transaction, pitch handling checks only
   `clefTransaction.candidate`, document controls add a dirty lyric draft and
   accidental placement, and the toolbars add Select and lyric state. Nothing
   names these differences or says why they exist.
3. **Implicit keyboard precedence.** These keyboard paths share keys,
   especially Escape:
   - a document capture listener (accidental and clef Escape);
   - a React capture handler on `<main>` (lyric-move keys);
   - a document bubble listener (clipboard, L, I/T, Escape, Undo/Redo);
   - component-local handlers.

   Their order exists only in listener phases. The effect's dependency list
   also names values the handlers do not read (for example `placementKind`
   and `history.present`).

4. **`ScoreSvg` wiring mixes intent with view models.** Note activation
   chooses between lyric navigation and selection inline. Clef deletion sends a
   two-action sequence inline. Placement handlers re-check intent before
   allocating IDs. View models such as the lyric-move legal targets are
   computed in JSX, and `clefEdit` repeats the `clefDraftPreview` condition.
5. **Hidden DOM coupling (smaller).** The neume-toolbar origin is recorded as
   a side effect of an element getter, and `onFocusNoteModifiers` calls that
   getter only for the side effect. The selected note's accidental state is
   formatted into a display string inside JSX.

## Contracts to read and preserve

Read `AGENTS.md`, [AI workflow](../ai-workflow.md),
[architecture](../architecture.md) (`src/editor/components/` and
`src/editor/state/`), [editor interactions](../editor-interactions.md) (Focus,
Keyboard command scope, palette and action-bar ownership),
[commands and history](../commands-and-history.md), [testing](../testing.md)
and the relevant accepted ADRs before each milestone.

- `ChantDocument` remains the only authoritative score
  ([ADR 0002](../adrs/0002-separate-semantic-and-derived-state.md)). Stable
  IDs keep their meaning
  ([ADR 0003](../adrs/0003-use-stable-semantic-identities.md)).
- `reduceEditorSession` remains the single pure transition authority, with its
  M4A phase order unchanged. `document-history.ts` remains the only owner of
  semantic history.
- Focus ownership is unchanged:
  - `ScoreSvg` owns score focus, reveal and reflow restoration;
  - `NotationPalette` owns palette focus;
  - acknowledgement uses the exact request object.
- The keyboard command scope table, composition and editable-target
  exclusions, and native clipboard fallback are unchanged.
  [Issue #99](https://github.com/OceanOSdev/gregorian-chant-editor/issues/99)
  is not implemented.
- These stay in `ChantEditor`:
  - session acquisition, lyric measurement and layout derivation;
  - playback store ownership;
  - presentation focus memory and the Firefox `syncNotationFocus` workaround;
  - replace/reload presentation resets;
  - generation of fresh IDs when events happen;
  - reading DOM focus into history actions;
  - panel composition and order.

## Agreed architectural decisions

1. **Approach A.** Use named pure projections, a pure shortcut classifier and
   extracted feature panels. Rejected alternatives:
   - feature hooks that return prop bundles, which form a distributed
     controller and cannot be unit tested without a React environment;
   - a session-wide `ChantScore` adapter, which would be a second
     whole-session consumer and would move complexity rather than clarify it.
2. **UI availability is presentation, not authority.** A pure module (proposed
   `src/editor/state/editor-availability.ts`, next to `clipboardBlocked`)
   names each presentation-availability rule and states why it differs. It
   must not validate transitions or replace a reducer guard. Intentional
   differences are preserved, not merged into one universal condition.
3. **Keyboard routing keeps browser event semantics.** A pure classifier
   (proposed `src/editor/interaction/editor-shortcuts.ts`, following
   `getClipboardShortcut`, `getNotationShortcut` and `isLyricEntryShortcut`)
   may map event facts and session state to an intent. All of the following
   stay as they are:
   - listener attachment points;
   - capture and bubble precedence;
   - `preventDefault` and `stopPropagation` behavior;
   - repeat, composition and editable-target handling;
   - focus handling and shortcut behavior.
4. **Feature panels take narrow props and named callbacks**, per the M1 rule
   in `docs/architecture.md`. They never receive `session` together with
   `dispatch`, and they never dispatch arbitrary actions.
5. **`ClefChangeControls(session, dispatch)` is left unchanged.** Document it
   as an existing exception to the narrow-props convention, justified by its
   transaction and focus-management responsibilities. Do not expand or narrow
   its API for consistency.
6. **`ScoreSvgProps` is unchanged** unless a milestone proves a change is
   necessary and records why. Do not group props into objects.
7. **Not introduced:**
   - a state-management library;
   - a controller hook such as `useEditorController`;
   - a generic action or handler framework;
   - large prop bundles;
   - circular imports;
   - a second state authority.

   Merging the note and accidental toolbars' positioning remains deferred.

## Milestones

Each implementation milestone is a separate, independently reviewable PR
against `master` on its own branch, with its own committed handoff plan or
plan section per the [AI workflow](../ai-workflow.md). No milestone starts
until the owner authorizes it.

### 0. Maintenance (prerequisite for M4B-2): repair the lyric-move driver

The `lyric-move` browser driver fails on `master` (`1ba1de5`) with
`Missing button Move syllable`. The same failure occurred at M4A's base
`75a56b5`.

- Investigate against current `master` first. Determine whether the driver is
  stale (UI or label drift) or whether it exposes a genuine application
  defect.
- If it is stale, repair the driver only. If it is an application defect,
  report it with evidence and options. **Do not change application behavior
  to make the driver pass** without separate authorization.
- This is a separate maintenance task and PR, not part of an M4B refactor.
- It must be complete before M4B-2, because M4B-2 changes lyric-move keyboard
  routing and needs this driver as regression evidence.
- The pre-existing `word-composition` failure
  (`punctum selected whole-neume cue must be clipped`) is out of scope unless
  the owner adds it.

### M4B-1: Pure availability rules, accidental projection, explicit toolbar origin

- Introduce the presentation-availability module. Each rule has a name, a
  one-line reason and the exact current condition. Replace each inline
  condition with its named rule.
- Move the selected-note accidental projection (effective B, written sign,
  source wording) into a pure, tested helper. The JSX consumes the result.
- Separate recording the neume-toolbar origin from the element getter, so the
  side effect is explicit at its call sites with the same timing.
- Change no JSX structure.
- Documentation:
  - record the availability module and the `ClefChangeControls` exception in
    `docs/architecture.md`;
  - update `docs/plans/editor-readability-m4a.md` to
    `Status: Completed (historical record). Implemented and merged in PR #105.`
- **Improves:** "Where do I change whether a control is enabled?" and "Which
  code owns an editing decision, and which merely dispatches it?"
- **Tests:** a pure matrix of every rule against each reachable mode (idle,
  placing, lyric entry with and without a dirty draft, lyric move, pending
  history, clef transaction with and without a candidate, accidental
  placement). Also test the accidental projection.

### M4B-2: Keyboard routing and documented event precedence

**Prerequisite:** maintenance task 0 is merged.

- Introduce the pure key-to-intent classifier for the document-level
  listeners and, where it fits, the `<main>` lyric-move capture handler. Keep
  every listener where it is attached today.
- Make the effect's dependencies reflect what the handlers actually read. If
  any closure-freshness behavior changes, state it.
- Document the Escape and shared-key precedence (capture listener → `<main>`
  capture → component handlers → document bubble) as a table in
  `docs/editor-interactions.md`. The table is the authoritative map. Do not
  copy it elsewhere.
- **Improves:** "Where do I change what Escape does in a particular editor
  mode?"
- **Tests:** a pure classifier matrix covering composition, editable targets,
  `defaultPrevented`, repeat, modifier keys, clipboard scope and native text
  selection, notation and score scope, and each exclusive mode.

### M4B-3a: Initial clef and lyric-language panels

- Extract the initial-clef fieldset and the lyric-language control, with its
  explanatory text, into components that take narrow props.
- **Improves:** "Where do I change the controls shown for document-level
  settings?" (the panel-location question).

### M4B-3b: Pitch handling, division controls and accidental properties

- Extract the clef pitch-handling fieldset, the division controls and the
  accidental-properties content rendered inside `AccidentalContextToolbar`.
  `AccidentalContextToolbar` keeps positioning, focus and `onEscape`.
- Keep the following stable:
  - the anchor-list ref behavior;
  - the `defaultValue`, `size` and Enter handling of the earlier-note select;
  - the division target's "last focused" versus "selected" wording.
- If this proves too broad, propose a further split (for example, accidental
  properties on its own) rather than forcing one PR.
- **Improves:** "Where do I change the controls shown for a selected
  division?"

### M4B-4: Named `ScoreSvg` handlers and view-model projections

- Replace non-trivial inline `ScoreSvg` callbacks with named handlers in the
  shell, or with pure intent mappers in `interaction/` where they are
  independently testable. Covered callbacks include note activation,
  neume-for-note activation, clef deletion, and clef and division placement.
- Compute view models (lyric-move view, `clefEdit`) once, sharing the
  draft-preview condition. Do not change `ScoreSvgProps`.
- **Improves:** "Where do I change the behavior when a note is clicked?"
- **Tests:** pure tests for any extracted intent mapper (lyric navigation
  versus selection, recovery exclusion).

### Dependencies

- Maintenance task 0 must be merged before M4B-2.
- M4B-1 comes first because later milestones use its named rules. M4B-3a and
  M4B-3b consume availability rules from M4B-1.
- M4B-2 and M4B-3a are otherwise independent and may be reordered only with
  owner approval.
- M4B-4 comes last.

## Behavior preservation (every milestone)

- **DOM:** identical element order, nesting, roles, ARIA attributes, `id`s,
  `data-*` hooks, `className`s and visible text.
- **Dispatch:** identical dispatched actions and order (including the two-step
  clef deletion), identical ID allocation timing, and no new dispatch from
  render.
- **Keyboard:** identical listener phases, `preventDefault` and
  `stopPropagation` use, repeat handling and composition exclusions.
- **Focus:**
  - identical focus requests and exact-request acknowledgement;
  - `NoteContextToolbar` and `AccidentalContextToolbar` keep their `key`s and
    remount behavior;
  - neume-toolbar origin timing is unchanged;
  - `syncNotationFocus` runs at the same points.
- **Scope:** no change to user-visible behavior, persisted schema, commands,
  layout, rendering geometry or playback. A defect discovered during a
  milestone is reported and handled separately.

## Verification strategy

- **Standard gate per PR:** `npm run format:check`, `npm run lint`,
  `npm test`, `npm run build`, `git diff --check`.
- **Pure unit tests** for each new module, at the smallest seam
  ([testing guide](../testing.md)).
- **Browser drivers** affected by the milestone, in Chromium and Firefox where
  implemented, compared against the same drivers on the PR's `master` base.
  A failure that also occurs on the base is reported as pre-existing, not
  waived.
  - M4B-1: `editor-toolbar`, `b-accidentals`, `b-accidentals-acceptance`,
    `note-modifiers`, `liquescent-notation`, `mid-score-clefs`,
    `musical-passage-clipboard`.
  - M4B-2: `lyric-move` (repaired), `continuous-lyrics`, `clefs`,
    `mid-score-clefs`, `b-accidentals`, `musical-passage-clipboard`,
    `contiguous-selection`, `divisions`.
  - M4B-3a: `clefs`, `vowel-alignment`, `lyric-spacing`, `local-persistence`.
  - M4B-3b: `mid-score-clefs`, `divisions`, `b-accidentals`,
    `b-accidentals-acceptance`.
  - M4B-4: `score-focus-reparenting`, `contiguous-selection`, `lyric-move`,
    `continuous-lyrics`, `mid-score-clefs`, `divisions`, `b-accidentals`.
- **DOM baseline comparison for panel milestones (M4B-3a and M4B-3b):**
  - capture `main.chant-editor` markup in fixed editor states on the base and
    the branch;
  - states: idle, clef selected, clef transaction, division selected,
    accidental selected and placing;
  - diff the two captures and report the result;
  - the capture tooling is throwaway unless the owner asks to keep it.
- **Manual checks:** record only checks actually performed. Keyboard focus and
  Escape behavior in a real browser are expected for M4B-2.

## Acceptance criteria

**Human readability.** Each milestone states which of these questions it
makes answerable from one obvious place:

1. Where do I change whether a control is enabled?
2. Where do I change what Escape does in a particular editor mode?
3. Where do I change the behavior when a note is clicked?
4. Where do I change the controls shown for a selected division?
5. Which code owns an editing decision, and which code merely dispatches it?

**Architectural correctness:**

- The reducer remains the only transition authority.
- Availability rules are presentation only, and their intentional differences
  are preserved.
- New components follow the narrow-props convention.
- Pure modules have no React or DOM dependency.
- No import cycles and no second state authority.
- M4A's phase architecture is untouched.

**Behavior preservation.** Every item under "Behavior preservation" above
holds, backed by the verification evidence.

**Regression testing:**

- new pure tests pass;
- affected drivers match or improve on the base;
- panel DOM diffs are empty, or every difference is explained and approved.

**Not an acceptance criterion:** the line count of `ChantEditor.tsx`.

## Risks

- **No React component test environment exists.** JSX moves are verified only
  by drivers, the DOM baseline comparison and manual checks. Pure extraction
  comes first for this reason.
- **Keyboard precedence is fragile.** A changed phase or a lost
  `stopPropagation` silently changes Escape. Mitigations are the M4B-2
  classifier tests, the precedence table and the repaired lyric-move driver.
- **Easy-to-lose browser workarounds:** `syncNotationFocus` on keyup and focus
  acknowledgement, the timing of the neume-toolbar origin, remount keys and the
  `defaultValue` of the accidental anchor list.
- **Scope creep** into issue #99, `ScoreSvgProps`, `ClefChangeControls`,
  toolbar positioning or reducer changes.
- **Stale dependencies.** Trimming effect dependencies could change
  closure-freshness assumptions. Each removed dependency must be confirmed
  unread.

## Stop conditions

Stop and report evidence and options, without proceeding, if:

- a milestone requires changing user-visible behavior, a session action
  contract, reducer guard precedence, history semantics or an accepted ADR;
- preserving listener phases or propagation is impossible with the proposed
  classifier;
- an extraction needs `session` together with `dispatch`, a large prop bundle,
  a controller hook, callback injection or a runtime import cycle;
- a DOM baseline diff shows an unexplained change;
- the lyric-move driver investigation finds a genuine application defect;
- an extraction does not actually improve one of the acceptance questions.
  In that case, leave the code in `ChantEditor`.

## Out of scope

- Issue #99.
- Shortcut changes.
- The `word-composition` driver failure.
- Toolbar positioning merges.
- `ClefChangeControls` API changes.
- `ScoreSvg` internals.
- Reducer or command changes.
- New dependencies.
- Any other M4 work.

## Delivery

This branch contains only this plan. After owner review, the owner authorizes
milestones one at a time, starting with maintenance task 0 or M4B-1. Each is
implemented on its own branch with a PR against `master`, and the owner merges
each PR. The M4A status-line correction is part of M4B-1's documentation work.

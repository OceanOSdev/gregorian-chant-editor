# Plan: Editor readability refactor — Milestone M1 (editor toolbar ownership)

Branch: `refactor/editor-readability-m1`
Target: `master`
Base: `917137cc5941ecb0539391efe7f859e5e7d30153` (Stage 11B / PR #93 merged)
Status: M1 implemented on this branch and in review (PR pending owner acceptance). Actual verification is recorded in the PR and [editor-toolbar record](../verification/editor-toolbar/README.md); M2–M3 not started.

## Why this effort

The owner wants to modify ChantPad directly and found the editor source difficult
to follow, especially `ChantEditor.tsx`. Architecture and readability should
reinforce one another: the goal is not shorter files as such, but clear ownership,
one-way dependencies and code whose structure explains the interaction model.

Current master inventory (2026-11-17; line counts from the checked-in source):

| Module                                  | Approx. lines | Observed responsibilities                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/editor/components/ChantEditor.tsx` |         1,912 | persisted session and dispatch; measured layout; selection/accidental/note/lyric projections; tool and history commands; global keyboard listeners; palette focus and split-menu logic; document options; action bar; massive `ScoreSvg` callback wiring; contextual toolbars and lyric controls |
| `src/editor/rendering/ScoreSvg.tsx`     |         1,489 | SVG root/focus restoration and reveal; per-system clipping and ledger rendering; clefs/divisions/neumes/accidentals; note and lyric keyboard/pointer controls; selection feedback; graphical ghosts and caret                                                                                    |
| `src/editor/layout/layout-chant.ts`     |         1,274 | public layout types/constants; `placeNeumeSequence` horizontal walker; word compaction/hyphens/wrapping; positional rebuild and measurements; final systems and slots/lyrics/canvas                                                                                                              |
| `src/editor/state/editor-session.ts`    |         1,904 | pure action reduction and transition policy, semantic command dispatch, history and focus request reconciliation                                                                                                                                                                                 |

These are distinct problems, not one safe giant extraction. The current
[architecture](../architecture.md) already assigns semantic authority to
`ChantDocument`, transitions to the pure session reducer, geometry to layout,
and DOM interaction to rendering. **Respect those boundaries, do not replace them.**

## Refactor program and checkpoints

- **M1 — this branch and PR: editor toolbar/palette ownership.**
  Make the editor's notation controls comprehensible as a subsystem, with
  focused browser-only palette state and explicit interfaces to session
  actions. Leave `ScoreSvg`, `layoutChant` and the pure session reducer
  behavior unchanged. See the precise scope below.
- **M2 — separate future branch/PR, after M1 owner acceptance: SVG interaction
  composition.** Inspect extracting system/neume/lyric interactive views and
  potentially focus/visibility management from `ScoreSvg`. Preserve SVG
  DOM nesting, IDs, clip paths, native pointer targets, focus restoration
  and the score-absolute geometry contract. A grouped callback adapter may
  help but must not hide ownership or create a broad context object.
- **M3 — separate future branch/PR, after M2 review: layout orchestration.**
  Refine `layout-chant.ts` into independently understandable horizontal
  composition, vertical measurement (already in
  `system-vertical-layout.ts`), final positioning/assembly and public
  output types. Preserve ADR 0028's compose-once/measure/position invariant,
  accidental policy, measured wrapping, canonical versus resolved frames,
  extreme pitch clipping and tested x-geometry.
- **Potential M4 only if warranted by inspection:** separate cohesive pure
  transition families inside the 1,904-line session reducer without creating
  a second history authority or changing its action contract. Not authorized
  by M1. No program-wide PR or mass rename.

M1 should be a reviewable, behavior-preserving PR, **not** M1–M3 combined.
Link the later candidates in its return summary, but do not implement them on
this branch without a new owner decision.

## M1 design intent: make responsibility boundaries visible

### A. Editor shell retains application orchestration

`ChantEditor` continues to own `usePersistedSession` (one authoritative
session/dispatch), measured `layoutChant`, derived score selection and
previews, semantic edit invocation, document replacement/recovery, and
composition of the score workspace and context controls. Keep transient
presentation focus distinct from semantic selection/history. Neither toolbar
nor presentation helpers may maintain a separate semantic score model.

Aim for the shell to read in this order: acquire session, derive relevant view
data, bind meaningful actions, compose child interfaces. This is an intent,
not a requirement to compress everything into one giant custom hook.

### B. Give the notation palette coherent ownership

Actual current seams in `ChantEditor.tsx`:

- Module-level palette families/tools and DOM target helpers near the top.
- `stickyToolbar` ResizeObserver and its `data-too-tall` behavior;
  `paletteButtons`, `rovingTool`, remembered `divisionKind` near lines
  222–249.
- `familyMenuProps` and associated variant/arm behavior near 479–531.
- `session.focusRequest.kind === 'palette'` handling near 577–584.
- The `neume-palette` toolbar, family split menus, ordinary tool buttons
  and Quilisma figure select near 953–1177.
- `DocumentControls` replacement/reload currently resets roving tool and
  division kind, so the reset semantics must remain explicit.

Consolidate palette-specific presentation and keyboard-roving state, DOM
button refs, focus requests, remembered division choice and variant-menu
rendering behind a **cohesive typed boundary**, e.g. a
`NotationPalette` component and, if needed, a narrowly scoped palette
controller/hook. Place code under `src/editor/components/`, or a
purposeful nearby module when pure logic has independent test value.
Keep `paletteTools`, `nextPaletteTool`, `NeumeFamilyMenu`,
`editor-tool.ts` and the authoritative reducer contracts reusable;
do not reimplement those decisions.

The palette must accept the session's current tool and dispatch commands
through the existing action contract. Keyboard focus is presentation-only;
Tab and arrow navigation must not change semantic selection. A palette-focus
request is handled once and acknowledged once; palette state resets correctly
on New/Import/reload without resetting the entire editor or remounting the
score. Choose the simplest safe reset API (explicit reset action/token/ref
or equivalent) and document why. Preserve all disabled/armed/remembered
tool behavior, exact aria and data attributes, split-button semantics,
Quilisma figure and 150% zoom/sticky toolbar behavior.

### C. Give the adjacent editor action bar a separate view boundary

The `editor-actions` segment near lines 1178–1284 combines range and
clipboard feedback, Lyrics, Insert remembered neume, Copy/Paste, and
Undo/Redo. Extract an `EditorActionBar` or equivalent **view-focused**
unit that receives appropriately named derived permissions, selection
context, labels and action callbacks (or typed action adapter), without
independently deriving semantic state or bypassing the reducer.

Keep copy/paste scope/shortcut logic, ID allocation, semantic mutations,
history navigation and focus-origin recovery where their existing authority
lives. Do not add a second clipboard, document state or history stack.
The action bar's accessibility names, live announcement policy, shortcut
hints and disabled states must remain unchanged.

The sticky toolbar may wrap the palette and actions; avoid duplicating its
ResizeObserver, shortening its overflow behavior or changing DOM focus
hierarchy simply to make a file smaller. Other small adjacent presentation
controls may move only if they naturally belong to an extracted unit and
do not inflate the PR's surface area.

### D. Keep interfaces explanatory, not a dumping ground

No blanket React context provider, event bus, generic `EditorController`,
all-purpose `useEditorEverything`, 50+ parameter forwarding function,
or unexplained `...rest` prop bag. Prefer explicit, small cohesive
interfaces; derive state in one place; callbacks should say what they
do. Avoid circular imports, ambiguous module owners, or duplicate
lookups/derived state. Where extraction requires a large prop interface,
reassess the seam rather than pushing through cosmetically.

Do not rename semantics, restructure the domain, introduce new dependencies,
rewrite CSS, alter keyboard priority or redesign the toolbar. A demonstrably
required seam adjustment is allowed with focused evidence; otherwise stop
and explain alternatives.

## Behavior-preserving contract

The following must be observationally unchanged:

- All score content, order, layout coordinates, rendered SVG geometry,
  note/accidental ownership and clipping, selected-note modifiers,
  hyphenation, focus reveal and print output.
- All session actions and reduction behavior; document history, undo/redo
  granularity; persistence/cache recovery/import/export/native v10; clipboard
  semantics and ID allocation; pending transaction and lyric state.
- Palette order, roving `tabIndex`, arrow navigation, menu open/browse/select,
  Enter/Space, Escape, I/T, remembered family/variant and division kind,
  palette focus request + one-time acknowledgement, tool press/disabled state.
- New/Import/reload presentation reset; score focus versus palette focus;
  keyboard command ordering and native text-edit/selection exclusions.
- Sticky toolbar positioning and `data-too-tall` ResizeObserver at desktop,
  narrow viewport, 150% CSS zoom and with long labels; notations remain
  accessible by keyboard and pointer.
- Existing DOM attributes/CSS hooks/accessibility labels that supported
  drivers and users rely on. No new history entries for focus/hover.

## Test and verification expectations

Before editing, inspect the existing tests and browser drivers for the
toolbar, `NeumeFamilyMenu`, palette navigation, document replacement and
keyboard shortcuts. Prefer existing pure tests and focused browser cases
over adding a testing framework. Add small tests only for new boundaries,
reset semantics or focus lifecycle where preexisting coverage is inadequate.

Verify:

1. Palette roving focus across ordinary, split and division family controls;
   dropdown/variants, clicking while in select/placement mode, remembered
   tool/Quilisma appearance, accessible press and disabled states.
2. `T` from score/context reaches correct palette tool without semantic
   selection change; `I` inserts once; Esc/Tab behavior and focus request
   acknowledgements. Native text editing and browser-native clipboard
   must not be intercepted.
3. Copy/paste buttons and keyboard shortcuts, selection ranges, live feedback,
   undo/redo, disabled states under lyric-move/pending-history/clef draft,
   and equivalent document history.
4. New/Import/reload resets roving and division memory without stale button
   refs or lost score/keyboard focus. Import/export remains byte-compatible.
5. Sticky toolbar, overflow threshold, score visibility and focus at 1440px,
   320px, 150% CSS zoom, Chromium and Firefox where drivers support them.
6. Normal and dynamic-height score remains unchanged. Check actual bundled
   Dominican Salve Regina and Kyrie XI with no geometry/render differences.

Run focused unit tests and relevant browser drivers from the actual
`docs/verification/runner/manifest.mjs`: at minimum the affected
palette/keyboard, `repeated-note-neumes`, `liquescent-notation`,
`continuous-lyrics`, `musical-passage-clipboard`, `divisions`,
`mid-score-clefs`, `local-persistence` and a focused score/focus scenario.
If an expected driver is not listed, inspect and use the closest actual one
or add a small targeted driver. Do not invent runner names.

Standard gate: `npm run format:check`, `npm run lint`, `npm test`,
`npm run build`, `git diff --check`. Broad keyboard/focus changes justify
the full browser preset in both supported browsers if practicable; log
exact driver results, unsupported combinations and failed steps.

The previous PR #93 reported **six browser pairs that also failed on its
clean-master baseline**: lyric-move Chromium, lyric-spacing Chromium,
lyric-spacing-selection-cue Firefox, word-composition both browsers,
and intermittent note-modifiers Chromium. These are historical evidence,
**not** a waiver for any new failure and not a guarantee about this new
master. Reproduce any alleged baseline failure on the exact current base
before classifying it as unrelated. Do not relax, skip or quarantine tests
to turn red into green. Existing browser failures belong to separate
focused repair plans unless M1 demonstrably introduces a regression.

## Architectural evidence / definition of done

The PR must explain:

- Which module owns palette browser focus, tool selection intent and action
  rendering, and which remains the sole semantic transition authority.
- How replacement/reload resets presentation state and how palette focus
  requests are acknowledged without duplicate or stale events.
- Why the resulting responsibilities are simpler to trace than before:
  show concrete reading paths (e.g. where to change a toolbar button, where
  to change selection behavior, where to change engraving).
- The reason for each new module: not simply its line count. Include
  before/after line counts as supporting data only, not the quality metric.
- Exact relevant test and browser evidence and any preexisting failures,
  plus review/foreground acceptance steps. Keep documentation in
  [architecture](../architecture.md), [editor interactions](../editor-interactions.md)
  and the feature verification records current; do not duplicate subsystem
  contracts in a new permanent guide.

No schema, domain, accepted ADR or feature behavior change is authorized.
A behavior-preserving ownership clarification should not need a new ADR.
If an accepted design _must_ change, stop and request an owner decision
before writing a conflicting ADR amendment.

## Stop conditions

Stop the affected portion and report alternatives if:

- The proposed palette/action seam produces a giant props surface or forces
  duplicated derived session state; choose a narrower extraction.
- A keyboard event, focus request or document-replacement lifecycle cannot
  be preserved without changing observable interaction behavior.
- Tests expose a genuine semantic/layout regression, a contract conflict,
  or an application change outside M1.
- A later M2/M3 restructuring seems necessary to finish M1; it is not.
  Deliver a smaller well-owned M1 PR instead.

## Delivery

Follow [AI workflow](../ai-workflow.md) and `AGENTS.md`. Preserve unrelated
local changes; implement on this branch, push the implementation commit and
open a PR targeting `master`. State the scope, owner-visible manual checks,
actual automated verification, limitations and deviations; verify PR head
and remote branch head match. **Do not merge.** Owner reviews and accepts
M1 before commissioning M2/M3 on fresh branches.

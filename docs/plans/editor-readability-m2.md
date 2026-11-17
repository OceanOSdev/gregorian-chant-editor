# Plan: Editor readability M2 — SVG interaction/control ownership

Branch: `refactor/score-svg-interactions-m2`
Target: `master`
Base: `9b9d2afbc6096ccc4811db98a5108b0c256fbd43` (M1 / PR #94 merged)
Status: M2 implemented on this branch and in review (PR pending owner acceptance). The PR and the [score-focus-reparenting record](../verification/score-focus-reparenting/README.md) hold the actual verification. The starting inventory below describes the base, not the current tree.

## Goal and rationale

Make the committed SVG notation controls understandable and safely modifiable by a human developer. A readable architecture has explicit, cohesive ownership: event semantics should live beside their interactive control; score-wide focus, placement and stacking should remain centralized. Shrinking `ScoreSvg.tsx` for its own sake is not an acceptance criterion.

Starting inventory (2026-11-17, current master):

- `src/editor/rendering/ScoreSvg.tsx`: ~1,489 lines.
- Lines ~165–326: score-wide refs, browser focus tracking/reflow restoration, focus-request handling, focus reveal.
- Lines ~328–489: score click/pointer placement and note mouse/keyboard handlers.
- Lines ~495–570: root SVG identity, accessible description, clef placement keyboard commands and pointer listeners.
- Lines ~571–783: system wrapper, resolved music clipping, range decoration, staff, clefs, custodes and mixed clef/neume/division render ordering.
- Lines ~783–1198: one neume's complete interactive subtree, including ownership clip, selection and lyric-move overlays, note and accidental controls, aria/hit-target geometry, pointer and keyboard rules, and focus-preserving note ref detachment.
- Lines ~1201–1343: hyphens and each interactive lyric, selected background, keyboard actions and below-text focus cue.
- Lines ~1347–1435: external placement/caret/ghost/draft overlays.
- `NeumeInk`, `ClefControl` and `DivisionControl` are already separate rendering owners.

Current contracts are owned by [architecture](../architecture.md),
[layout and rendering](../layout-and-rendering.md#rendering-and-accessibility),
[editor interactions](../editor-interactions.md#focus),
[testing](../testing.md) and the accepted ADRs. Read these along with
`AGENTS.md` and [AI workflow](../ai-workflow.md). **Inspect source and tests
rather than treating this inventory as proof about behavior.**

## Decisions and scope

This is **one independently reviewable M2 implementation PR**. Do not fold
in layout orchestration (future M3), pure session reduction (possible future
M4), or an unrelated redesign of the score.

### 1. Preserve the score-wide ownership boundary

`ScoreSvg` stays the authoritative renderer entry point and sole SVG root. It
continues to own:

- root `<svg>` event handlers, coordinate inversion through `getScreenCTM()`,
  root placement and clef-keyboard intent routing;
- score-wide focus request dispatch, browser `focusin` tracking, ref lookup,
  minimal reveal, and reflow/remount restoration by stable ID;
- the score's unique SVG ID prefix, named root description and shared IDs;
- per-system wrappers, ordering of mixed clef/neume/division items, the
  resolved `musicBand` clip groups, range selection outside the clip,
  staff/custodes/clef/division composition, hyphens and previews.

**Do not move the score-wide focus lifecycle into individual notes or lyrics.**
Child controls should register/unregister their actual elements with explicit
callbacks from the owning score, not create a parallel focus map. Preserve
the special note-detachment behavior that remembers an actually focused note
before React reparents it when reflow occurs, including Firefox cases without
a bubbling `focusin` event.

### 2. Extract a cohesive interactive neume control

Create a focused `NeumeControl` / `ScoreNeumeControl` module under
`src/editor/rendering/` (choose a name consistent with `ClefControl` and
`DivisionControl`).

It should own the **existing** `<g data-neume-id>` subtree:

- complete neume ink and ledger rendering and its in-neume ownership clip;
- whole-neume selection, placement context and lyric-move target/caption;
- per-note SVG button groups, accessible label, target shape, selected contour,
  click/Shift-click, keyboard movement/delete/range selection and accidental
  placement mode;
- interactive written-accidental controls and focus-to-properties behavior;
- final lyric-move pointer rectangle.

Move the **presentational event routing** with the control, using existing
semantic callbacks from `ScoreSvg`. It must not invoke domain commands
directly, create semantic IDs, derive layout, or own editor session/history.
Keep the exact selector/data/ARIA and CSS contracts. Preserve note hit
clipping, constituent ordering, cases with shared ink, and multiple shapes
whose pointer semantics are `fill` rather than `all`. Preserve the current
routing of pointer, keyboard and accessibility events with every disabled
mode, modifier and precedence rule.

Pass explicit typed context: the committed `NeumeLayout`, its score-wide
ordinal (derived at the orchestration boundary), current tool/selection and
mode flags, musical/render band, unique clip ID, note element-registration
callback, and cohesive named action callbacks. Prefer a small grouping of
**domain-related** handlers if it improves clarity; avoid spreading
`ScoreSvgProps`, using context as a global event bus, adding a giant
controller object, or duplicating selection/session projections. If this
seam demands unwieldy props or circular imports, stop and present narrower
alternatives instead of hiding the problem.

### 3. Extract a cohesive interactive lyric control

Create `LyricControl` / `ScoreLyricControl` under `src/editor/rendering/`
for the existing `<g className="score__lyric-control">` subtree:

- selected lyric background, text control, keyboard-input resolver,
  click/double-click and edit/delete/advance callbacks;
- ARIA, `data-syllable-id`, note-independent lyric focus cue and visual
  text metrics;
- the registered actual SVG text element (via a callback to the score's
  single focus registry).

The score remains the authority for layout, lyric order and score-wide
focus requests. The lyric component receives a positioned `LyricLayout`,
the derived selected/disabled/placement context, and narrowly typed action
callbacks. It must not run its own document or lyric-entry reducer, invent
geometry or alter system wrapping.

### 4. Keep DOM structure, ordering and focus identity stable

These are **behavior-preserving component boundaries**, not new SVG grouping
layers. The resulting DOM must preserve:

- the outer root, system `<g>` and data hooks, `<defs>`/`clipPath` scope and
  IDs, sibling order (including mixed semantic item sorting), score title and
  descriptions;
- neume `<g>`/note `<g>` nesting, written accidentals, their hits and selection
  overlays, and location of lyrics and hyphens **outside** the system music
  clipping group;
- all styling hooks and native event propagation behavior;
- stable semantic keys, focusability, refs and `onFocusHandled` request
  acknowledgement exactly once per applicable request; no focus theft on
  reflow or selection and no new tab stops;
- screen/print parity including SVG `viewBox`, negative/large pitch clipping,
  ledger pattern IDs and vertical-episema rasterization.

Extract without adding wrapper DOM/SVG elements. Component instantiation
does not necessarily guarantee browser-focus retention during React reparenting:
test real focus and ref-detachment paths after the move. Where parent calls
must change, preserve the public `ScoreSvgProps` and the current
`ChantEditor` / reducer boundary as much as possible.

## Explicit exclusions

- No change to `ChantDocument`, native codec, format version, IDs, commands,
  history, state reducer or action semantics.
- No notation, glyph, ledger, accidental, mora, liquescence, pitch, wrapping,
  lyric placement, dynamic system size, clipping math or CSS redesign.
- No broad `ScoreSystem` extraction or relocation of the root focus manager
  in this PR. They are possible _subsequent_ responsibilities to assess
  after the interaction-control seams prove themselves.
- No dependency, framework, test-harness, generic React context or event-bus
  introduction.
- No automatic change to live site/`master`; do not merge.

## Invariants and verification

### Structural contract

Before editing, inventory existing `ScoreSvg` DOM/keyboard/pointer contracts
and the relevant browser-driver coverage. Capture representative normal
and interactive DOM structure at base and branch, for at least:

1. Ordinary notes and lyric controls with and without selection.
2. Dense joined/compact neumes (Scandicus/Clivis/Porrectus/Climacus/
   longer compound families), with hit ownership.
3. Written accidents, modifiers, ledger lines and lyric reassignment.
4. Systems with both low ledger ink and high signs (Dominican Salve Regina
   `Et Jesum`) and neighbouring systems after reflow.
5. Armed placement and interactive clef/division controls alongside notes.

Compare element order, relevant class/data/ARIA, clip/path IDs, visible geometry
and focusable targets, not just line counts or static server-rendered HTML.
Preserve distinct SVG instances' unique generated clip/pattern IDs.
If using an initial HTML comparison, explicitly state that it does not cover
layout effects, focus and runtime pointer routing. A legitimate DOM difference
requires rationale and contract-level verification, not only a screenshot.

### Browser interactions

Run actual browser checks (not simulated reducer calls alone) for:

- Native pointer hit testing of note constituents at compact boundaries,
  including ribbon/diamond cases; selection/Shift-range and note-versus-neume
  contours; mouse down and modifier precedence;
- Pointer and keyboard accidental selection, deletion, placement target
  navigation and property focus;
- Note Enter/Space/Shift+Enter, arrow movement, Delete/Backspace, Tab to
  modifiers, focus by ID after reflow and Undo, no disabled note interaction
  while placing;
- Lyric select/Edit/Enter/Space/Delete, typing/delimiter navigation, cue
  position and accessibility; lyric-move targets keep ownership while
  notes are pointer-inert;
- Graphical insert/ghost and Undo after expanded systems, 320px width,
  150% CSS zoom and high/low extreme pitch containment;
- Native Tab/Shift+Tab and reveal in Firefox and Chromium with special
  attention to reparented notes, not only programmatic focus.

Existing runner IDs include `contiguous-selection`,
`musical-passage-clipboard`, `word-composition`,
`note-modifiers`, `note-shapes`, `b-accidentals`,
`b-accidentals-acceptance`, `lyric-move`, `continuous-lyrics`,
`lyric-spacing`, `lyric-spacing-selection-cue`,
`dynamic-vertical-layout`, `neume-ledger-lines`,
`mid-score-clefs`, `divisions`, `liquescent-notation`,
`compound-directional-neumes`, `extended-scandicus-climacus`,
`pes-subpunctis`, `vertical-episemata` and `bundled-example`.
Inspect the actual manifest and run applicable supported pairs, not
invented combinations. Add a **focused browser driver** only if existing
coverage cannot establish a material newly exposed contract, and keep it
small and stable.

Run the standard gate from `docs/testing.md`:
`npm run format:check`, `npm run lint`, `npm test`, `npm run build`,
`git diff --check`. Because the changed controls cover a large fraction of
score interaction, run the full browser preset for both browsers if possible
on the final substantive revision and report all pairs. A targeted baseline
comparison against the **exact M2 base** is required for alleged failures
or changed assertions. Previous historical six failing pairs at the M1 base
(lyric move, lyric spacing, lyric focus cue, word composition, note modifiers)
are not waivers or proof of current behavior; reproduce before classifying a
failure as pre-existing. Do not skip, weaken, change runner expectations or
retry away genuine regressions.

Separate code validation, observed browser interactions, visual/foreground
acceptance, print and accessibility evidence. Do not claim full visual or
screen-reader parity from headless tests alone.

### Readability acceptance

The PR must answer concretely:

- Where a developer changes note click/key behavior, where lyric keyboard
  behavior lives, and where score focus/reveal is owned;
- Which component owns selection decoration versus musical engraving ink;
- How `NeumeControl` and `LyricControl` communicate edit intent to the
  authoritative session without bypassing it;
- Why extracted interfaces express real responsibilities rather than an
  all-purpose prop bag or generic renderer abstraction;
- How the new structure preserves DOM sibling order, clip hierarchy and
  focused-note reparenting behavior, with supporting test evidence.

Provide before/after line counts as **secondary** evidence only.
Update the authoritative architecture, layout/rendering and interaction
guides in place (no duplicate permanent guide). The owner can amend
interfaces or component names based on concrete evidence, but not
observable behavior or accepted ADRs.

## Stop / escalation conditions

Stop the affected extraction and report evidence plus options if:

- maintaining focus/reparenting requires new semantic state or changes the
  public layout contract;
- the note/lyric seam needs excessive props, duplicated handler logic or
  complex cross-component ref ownership; propose a narrower boundary;
- moving JSX requires altered SVG nesting, ordering, event propagation,
  clipped pointer geometry or browser-only workarounds;
- a credible current-base regression appears or an accepted ADR would
  need revision;
- M2 grows into a whole renderer, layout or reducer rewrite.

Scope can be narrowed without owner approval if doing so preserves the goal;
a genuinely different architecture requires owner discussion before coding.

## Delivery

Follow `AGENTS.md` and `docs/ai-workflow.md`. Preserve unrelated local
changes, implement on this branch, run verification, commit and push, then
open a PR against `master`. Record the actual base and final SHA, remote
branch and PR head, changed files, source/DOM comparison, verification
outcomes, baseline exceptions, foreground acceptance items and remaining
limitations. **Do not merge.**

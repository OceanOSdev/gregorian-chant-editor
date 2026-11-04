# Plan: Extract graphical placement layout responsibilities

Branch: `refactor/graphical-placement-layout`
Target: `master`
Base commit: `103b612f39b402dd5d5296753c457be3e7af2f8c` (merged PR #51)

## Problem and goal

`src/editor/layout/layout-chant.ts` is still responsible both for the authoritative combined music-and-lyric score layout and for _interactive graphical placement_ calculations. It currently contains these closely related functions:

- `canGraphicalNeumeFitNormalSystem`: tests a proposed neume's geometry against normal staff bounds;
- `layoutGraphicalPlacementPreview`: positions an ID-free pointer-following ghost and semantic-boundary caret on the existing committed systems;
- `getSystemNeumePlacement`: validates a point within a system, snaps it to a staff position, and determines the preferred whole-neume insertion index.

They can form a more discoverable, separately testable responsibility without changing the wrapping engine.

**Goal:** Extract a focused, pure graphical-placement layout module, leaving `layout-chant.ts` primarily responsible for canonical score layout and wrapping. Preserve behavior exactly. This is the next incremental maintainability refactor after PR #50 (geometry recipes) and PR #51 (shared default entry pitches).

## Read before implementation

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`, `docs/layout-and-rendering.md`, `docs/editor-interactions.md`, `docs/testing.md`, and relevant Accepted ADRs, especially 0002, 0004, 0007, 0010, 0011 and division-related 0013.

Inspect `src/editor/layout/layout-chant.ts`, `src/editor/interaction/resolve-graphical-neume-placement.ts`, `src/editor/interaction/resolve-score-slot.ts`, `src/editor/neume-entry-pitches.ts`, and existing graphical-placement, preview, division, lyric-spacing, and editor-session tests before deciding on module boundaries.

## Agreed decisions and invariants

1. `layoutChant` remains the single authoritative combined music-and-lyric layout. The `placeNeumeSequence` walker retains exactly its existing responsibility for spacing, system breaks, oversized progress, and division reservations. **Do not extract, duplicate, or split the wrapping algorithm.**
2. Graphical placement remains _derived_, pure and transient. Pointer snapping, fit decisions, ID-free ghost geometry, and caret geometry must continue to use the committed `ChantLayout` snapshot. No semantic model, React, SVG or browser APIs in the new pure module.
3. Preserve all exact existing rules, including:
   - input point finite checks, vertical system membership and precise on-staff bounds (inclusive edges);
   - staff-position snapping and half-step tie behavior, including accepted outside-staff positions;
   - midpoint insertion-index tie decisions and global multi-system indices;
   - graphical-kind whitelist and shared default entry-pitch constructor from PR #51;
   - a ghost following the pointer on the hovered system, while the caret follows the chosen semantic boundary, including shared-system boundaries and fallback to a later/final system;
   - ghost bounds clamping, preview note/ink/anchor equality, normal-width fit eligibility, and no preview changes to the committed music;
   - division-aware insertion slots, real score boundaries, selection and focus, repeated placement and undo/redo.
4. Preserve existing public imports from `layout-chant.ts` for consumers and tests (functions, exported types and constants). Re-export or use compatible facades as needed. Keep `NeumeEntryPitches` and kind-correlated tuples intact.
5. Avoid **runtime dependency cycles**. A new placement module can import `ChantLayout` and system types using `import type`, but if `layout-chant.ts` imports/re-exports implementation and the placement module imports runtime constants/helpers from `layout-chant.ts`, that would form an undesirable runtime cycle. Resolve this with a minimal coherent dependency-neutral home for only truly shared metrics/helpers or another comparably small approach, without duplicating values or moving the entire layout engine. Verify the actual runtime import graph; type-only imports are fine.
6. Distinguish graphical _layout_ decisions (ghost positioning, snapping and fit against staff bounds) from `interaction/resolve-graphical-neume-placement.ts` (slot resolution, division-aware semantic boundary and valid insertion intent). Do not casually move the interaction resolver or put score-slot policy in engraving geometry.

## In scope

- Move the three related graphical layout helpers and their tightly coupled placement types from `layout-chant.ts` into one focused module (e.g. `src/editor/layout/graphical-placement.ts`). Choose concise ownership; do not create many tiny files just to reduce line counts.
- Keep the existing entry-pitch module neutral and single-sourced; the new layout module should consume it, not redefine patterns.
- Where genuinely helpful, simplify a redundant type conversion in the nearby resolver or use kind-correlated input for fit eligibility, **only if** it preserves exported API compatibility and improves type safety without expanding scope. The previous review noted `canGraphicalNeumeFitNormalSystem(kind, positions)` could accept mismatched tuples; if addressing this, preserve existing callers via a compatible wrapper or explain a justified API evolution before proceeding.
- Update relevant layout/architecture docs to describe the new ownership precisely. Avoid stale statements, speculative claims and redundant metric definitions.
- Add only targeted tests around the extracted seam or pre-existing weak coverage; preserve/reuse existing tests for the comprehensive scenarios.

## Out of scope

- No changes to semantics, commands, neume geometry recipes or engraved contours, musical metrics, layout spacing, wrapping, lyric metrics, conditional hyphens, divisions, error policies, note insertion behavior, CSS/SVG or React UI.
- No refactor of `layoutChant` system/lyric assembly, `ScoreSvg.tsx`, `ChantEditor.tsx`, the editor-session reducer, toolbar selection/fallback, or accessibility event ownership.
- No generic layout framework, plugin registry, new dependencies, speculative neume/modifier support, or broad formatting.
- Do not fold other historical giga-review suggestions into this PR unless they are required to complete the narrowly scoped extraction without a regression. If something merits another PR, report it as deferred.

## Acceptance and verification

- Existing `layout-chant.ts` API consumers continue to build; the graphical placement rules have one coherent implementation home.
- No runtime cycles or duplicated placement constants/logic. The extraction should actually reduce responsibility in `layout-chant.ts`, not merely add pass-through layers.
- Pure outputs for identical inputs remain equal, including shape paths, numeric bounds and staff positions, caret coordinates/system ownership, boundary indices, and null/invalid cases. Test and/or compare original and extracted implementations, including exact-fit and outside-fit cases.
- Unit tests cover normal/edge coordinates, pitch tie snapping, all seven kinds, crowded end ghost clamping, first/middle/last systems, divisions/adjacent slots, and missing/invalid inputs where relevant. Existing measured-lyric preview and division suites stay green.
- Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`. Confirm lint and TypeScript build catch accidental dependency/export mistakes.
- For real browser validation, use `docs/testing.md` and relevant current drivers (especially `docs/verification/lyric-spacing/browser-check.mjs` and `docs/verification/divisions/browser-check.mjs`) where practical. Report which ran, from which commit, and what they actually cover. Do not claim headless automation is equivalent to manual Firefox or screen-reader testing.
- Review changed paths and diff specifically for duplicated semantics, lost type relationships, cyclic imports, stale docs, and subtle changes to selection/caret behavior, **in addition to tests passing**.

## Stop conditions and delivery

Stop and report design options if extracting these helpers requires a new large metrics/configuration layer, a runtime cycle, a changed accepted ADR, a rewrite of `placeNeumeSequence`, or any meaningful behavior change. Ordinary naming/extraction choices do not need separate owner approval.

Implement only this plan on `refactor/graphical-placement-layout`, commit, and open a PR against `master`. Include a precise explanation of module ownership, exports and the verification actually performed. Do not merge.

**Keep the committed plan during PR review.** Before merge, the owner decides whether to remove this one-off plan or retain it with an accurate completed status, per `docs/ai-workflow.md`.

# Plan: Extract neume engraving geometry into focused modules

Branch: `refactor/neume-geometry-extraction`
Target: `master`
Base commit: `04a93c75b68df0eac8513fcfdd2891f6f8c5cd1a`

## Problem and goal

`src/editor/layout/neume-geometry.ts` currently contains shared geometry types/utilities and most engraving logic for all seven supported neume kinds inside one large `buildNeumeGeometry()` function. This makes a single neume's contour difficult to locate and reason about, and increases the risk of accidental changes to other neumes.

Improve maintainability by giving coherent engraving recipes clear ownership, while retaining exactly the current geometry and behavior. This is the **first, narrowly scoped, behavior-preserving refactoring PR**, not a broader neume-extensibility redesign.

## Existing contracts and design decisions

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`, `docs/layout-and-rendering.md`, `docs/engraving-metrics.md`, and `docs/testing.md`. Respect Accepted ADRs [0002](../adrs/0002-separate-semantic-and-derived-state.md), [0004](../adrs/0004-use-explicit-neume-types-and-ordered-tuples.md), and [0007](../adrs/0007-share-derived-neume-engraving-geometry.md); also preserve combined music/lyric layout under ADRs [0010](../adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md) and [0011](../adrs/0011-word-aware-chant-engraving.md).

- Semantic `ChantDocument` remains authoritative, with no pixel or SVG information.
- Geometry remains a pure, ID-free layout calculation. Layout, wrapping, committed rendering, and local previews must continue to use the same geometry rules.
- Preserve existing neume kinds, typed tuple semantics, graphical whitelist, and exhaustive kind handling.
- Keep `buildNeumeGeometry(kind, positions, leftX, bottomStaffY)`, `firstHeadHalfWidth`, `getInkBounds`, and currently exported geometry types/constants compatible for consumers. Prefer retaining `neume-geometry.ts` as a small public entry point/re-export facade where appropriate.
- The painted ink `d` paths and `bounds`, constituent note `head`, `anchorX/Y`, `hitBounds` and optional `hitShape`, `lyricAnchorX`, and `advanceX` are existing behavior, not incidental implementation details.

## Agreed scope

1. Extract the current neume-specific engraving recipes into focused modules under `src/editor/layout/` (a `neumes/` subdirectory is a reasonable option). Organize for cohesion: one module per kind is acceptable, but closely related recipes can stay together if shared construction is genuinely useful. Do not force arbitrary file sizes.
2. Extract only the shared geometry types, construction helpers, or contour fragments that help the extracted recipes remain understandable. Reuse existing construction where it is already intentional (for example, some Scandicus and Climacus compositions reuse Punctum/Podatus geometry). Avoid circular imports.
3. Keep a clear single dispatch point for `buildNeumeGeometry` and preserve public import compatibility. Do not create a generalized plugin architecture, class hierarchy, configurable glyph registry, or external font dependency.
4. Preserve all seven existing kinds, including interval-sensitive shapes, joined and deliberately disconnected ink, extended interval behavior, and per-note hit-region ownership.
5. Update only documentation whose module ownership description is now inaccurate (especially `docs/architecture.md` or `docs/layout-and-rendering.md` as applicable). Documentation should describe actual modules without duplicating authoritative engraving metrics.

Implementation details and exact file boundaries are for Codex to choose after inspecting dependencies. If a natural extraction would alter a contract, stop and report options rather than silently broadening scope.

## Explicit exclusions

- No new neumes, Quilisma, Virga, modifiers, punctum mora, accidentals, or musical meaning changes.
- No redesign of `ChantNote`, `Neume`, insertion commands, domain validation, deletion normalization, editor state, keyboard handling, SVG components, or the wrapping algorithm.
- No changes to engraving paths, metrics, staff positions, lyric alignment, hit testing, spacing, reflow, user-visible controls, accessibility descriptions, or preview behavior.
- No cosmetic formatting pass over unrelated code, wholesale test reorganization, new dependencies, or sweeping renames.

Future additions such as Virga, Quilisma, mora dots, and B-flat are **change-impact examples**, not features to implement or preemptively scaffold in this PR.

## Acceptance criteria

- The exported geometry API remains compatible with existing callers; all current neume variants work identically.
- The resulting code has discoverable, cohesive neume-specific recipes and minimal shared helper surface, without duplicating large contour logic or creating dependency cycles.
- Same inputs yield the same geometry as before: complete painted paths/bounds, note-level shapes/anchors/hit regions, lyric anchors, and horizontal advances. In particular, preserve fractional-scale joins, Porrectus ribbon note ownership, Climacus polygonal hit targets, Scandicus (1,1) separation, and interval extrapolations.
- Committed layout and graphical previews remain equivalent to their pre-refactor results; no changed wrapping, typography, divisions, selection, or focus behavior.
- Existing tests continue to pass. Add *focused* regression assertions only where the extraction reveals a gap; prefer existing geometry matrix tests over giant new snapshots.

## Verification and delivery

Use `docs/testing.md` as the authoritative checklist. Run and report actual results for:

```bash
npm run format:check
npm run lint
npm test
npm run build
```

Also run relevant geometry/layout suites directly while iterating. Review the PR diff for *unintended changed geometry*, not merely test passing. Where practical, perform manual browser checks of a few representative neumes (especially joined Podatus/Clivis, disconnected Scandicus, Climacus hit targets, Porrectus ribbons), placement preview, selection, and wrapping. Clearly distinguish checks actually executed from checks not run. Hosted CI is not a substitute for actual-browser interaction testing.

Implement on this branch, commit changes, and open one focused PR targeting `master`. Do not merge. In the PR summary, explain the module boundaries chosen, notable shared primitives, verification results, any behavior differences or deviations (there should ideally be none), and any deferred opportunities.

## Stop conditions

Stop and bring options back to the owner if an extraction requires changing semantic model invariants, altering accepted engraving/layout contracts or geometry values, or introducing a broad framework to make the modules work. Do not turn the assignment into a general refactor of `layout-chant.ts`, `ScoreSvg.tsx`, or `ChantEditor.tsx`.

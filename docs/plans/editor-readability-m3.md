# Plan: Editor readability M3 — layout orchestration ownership

Branch: `refactor/layout-orchestration-m3`
Target: `master`
Base: `1972c105258a4def9596f22f072e08b19e75fbfe` (M2 / PR #95 merged)
Status: **Completed** (historical record). Implemented and verified in [PR #97](https://github.com/OceanOSdev/gregorian-chant-editor/pull/97) and accepted by the owner; see [Closeout](#closeout). The starting inventory below describes the base, not the current tree.

## Problem and goal

Make the pure layout pipeline understandable and safe for a human developer to modify. At the M3 base, `src/editor/layout/layout-chant.ts` is 1,274 lines and mixes the stateful horizontal composer, semantic-to-layout input preparation, measurement/stacking orchestration, geometric rebuilding, lyric and hyphen attachment, pointer ownership/insertion slots, and canvas bounds.

The architecture is already correct in its essential separation: **horizontal composition happens once, then vertical requirements are measured and systems stacked, then existing geometry is rebuilt at the resolved vertical origins** ([ADR 0028](../adrs/0028-compose-before-vertical-lyric-clearance.md)). M3 clarifies module ownership and pipeline readability; it **does not introduce new engraving behavior**, a new line-breaking algorithm, a second layout authority, or a new data model.

Success is measured by a maintainable structure with clear answers to "why did this neume wrap?", "why is this syllable separated?", "why did the lyric baseline move?", "where are insertion slots calculated?" and "what expands the canvas?". Merely reducing the line count of `layout-chant.ts` is insufficient.

## Starting code inventory (base revision)

The following line ranges are approximate, anchored to the specified base; inspect the actual source before editing.

- Public types/re-exports and constants: lines ~82–279, including `ChantLayout`, `ChantSystemLayout`, `NeumeLayout`, `LyricLayout`, wrapping constants and `GeometryInput` / `PositionedSystem` / `LyricRequirement`.
- `placeNeumeSequence` (~282–648): **one stateful, pure horizontal pass**. Owns current-system state, active/leading clef, division/clef events, custodes, note placement, measured lyric clearance, same-word and intra-syllable compaction, word/hyphen reservations, oversized-progress and whole-neume wrapping.
- Public layout utilities (~650–712): `measureNeumeWidth`, `wrapNeumes`, `getNeumeLyricAlignmentX`, `getNeumeBoundaryCenterX`. Some call the horizontal composer.
- `layoutCommittedNeume` (~718–740): attaches semantic IDs and appearances to geometry.
- `positionedMusicInk` and `positionComposedSystem` (~747–829): determine canonical-frame renderable extents and rebuild each composed system's ink at its vertically resolved staff origin.
- `layoutChant` (~831–1274): prepares measured alignments, semantic score order, clef/events/accidentals/anchors; runs composition; invokes `measureSystemVertical` and `stackSystems`; rebuilds committed geometry; attaches lyrics, continuation hyphens, compact-neume hit ownership and score insertion slots; determines the final canvas.
- `system-vertical-layout.ts` is **already extracted**. It owns the measurements, bounded vertical band, stacking, minimum heights and lyric clearances; do not reimplement it.

## Architectural decisions

### A. Prefer cohesive phases, not arbitrary file splitting

A reasonable candidate (names provisional, not required) is:

1. **Horizontal composition** — `horizontal-system-composition.ts` owns the current horizontal walker, its internal data types/constants and any helpers intrinsic to it. It returns ordered, canonical-local `PositionedSystem` data, not `ChantLayout` and not a second authoritative score. Retain the walker's related state and `finishSystem` / event handling together; do not break the algorithm into an elaborate strategy hierarchy or tiny wrappers just to shorten functions.
2. **Vertical positioning / layout assembly** — retain `system-vertical-layout.ts` as the owner of `measureSystemVertical` / `stackSystems`. A cohesive internal module or a few well-named phase functions may own the _consumer-side_ rebuilding and assembly (resolved systems, lyrics, hyphens, ownership clips, insertion slots, canvas). If splitting these responsibilities creates circular runtime dependencies or an enormous shared context, leave smaller portions in `layout-chant.ts` and explain why.
3. **Public orchestrator and compatibility surface** — `layoutChant(document, measure)` should read like the actual sequence: prepare input → compose horizontally once → measure/stack → rebuild/attach → finalize. It is the only public layout entry point. Keep existing public exported helpers, type re-exports and constants compatible with their current callers.

Before coding, map the proposed import graph. Shared internal records may live in a small internal types module if necessary. **Avoid any runtime dependency cycle** between the horizontal module, assembler and `layout-chant.ts`. Type-only references are acceptable where they do not obscure ownership. Do not add a generic pipeline framework, context object with scores of unrelated fields, service class, plugin system or alternate "draft layout" model.

### B. The existing algorithm's decisions are invariants

The horizontal composer must still:

- consume semantic order including interleaved neumes, written accidentals, divisions and authored clef changes in the same sequence;
- preserve clef pitch context, leading clef events, outgoing and anticipated custodes, and division-specific compaction boundaries;
- preserve 33-unit ordinary ink spacing and the existing exceptions for eligible same-word anchors and intra-syllable groups; barriers, event order, continuation hyphens and the exact-join threshold must not change;
- place whole neumes without splitting them, preserve exact-fit and non-empty wrapping, oversized-single-item progress, exceptional lyric/canvas overflow and all normal-width constraints;
- preserve the distinction between fully measured lyrics and provisional/partial/invalid measurements: **a missing or stale font snapshot must not invent clearance or wrap decisions**;
- carry the same candidate geometric bounds, displacement, positioned-ink metadata and semantic IDs into the next phase; never recompute horizontal x during vertical positioning.

The implementation may name local concepts, consolidate pure helper calculations or clarify branch conditions, but **do not rewrite the greedy walker or change the decision order** while extracting it. If code motion exposes apparent errors, report separately rather than silently "fixing" them.

### C. Preserve ADR 0028's phase boundary literally

Use the canonical system-local origin (`firstSystemBottomStaffY`) for horizontal composition. `measureSystemVertical` must consider **complete renderable ink** (staff, clefs, divisions, custodes, neume bodies, ledgers, rhythmic signs and accidentals), bounded by the existing vertical containment safeguard. `stackSystems` chooses positions and heights; rebuilding at each final `bottomStaffY` uses the **original composed x positions** and retains system membership and item order.

Do not run the horizontal walker a second time or feed adjusted lyric baselines back into it. Preserve `positionComposedSystem`'s explicit per-field rebuild contract: new geometric fields cannot accidentally remain in the canonical coordinate frame. Vertical measurement cannot change horizontal breaks, wrapping, syllable relationships or pointer split ownership.

Keep public `ChantLayout` in score-absolute coordinates and keep `ScoreSvg`, graphical-placement resolvers and browser focus code unchanged.

### D. Preserve final-assembly responsibilities without duplication

Wherever final assembly lives, keep the derived results identical:

- semantic IDs for neumes, notes, accidentals and their placement/ownership context;
- staff lines, leading clefs, mid-score clefs, divisions, custodes and system metadata;
- one system-wide lyric baseline, vowel-aligned lyric x/occupied bounds, hyphens for measured continuation gaps, outgoing mark position on the source system;
- compact-neume `hitClip` ownership at relevant boundaries; no change to pointer targeting or selection outlines;
- score slots as semantic insertion boundaries, separated correctly around divisions/clefs and custodes; same `hitRight`, insertion indices and x positions;
- normal 720-unit score width, oversized unbreakable lyrics including negative viewBox x, and the horizontal/vertical containment rules for extreme valid pitches;
- no mutation of semantic input, no persisted layout coordinates and no new IDs.

Do not move these calculations into React, `ScoreSvg` or the semantic session reducer. Keep the geometry builders authoritative; no duplicated engraving math.

### E. Preserve the full existing public interface

Keep `layoutChant`'s signature and result shape, as well as the existing public types, constants, re-exports and utilities from `layout-chant.ts` (`measureNeumeWidth`, `wrapNeumes`, `getNeumeLyricAlignmentX`, `getNeumeBoundaryCenterX`, graphical-placement re-exports, staff metrics, etc.). Imports from `ChantEditor`, `ScoreSvg`, other layout/interaction modules and tests should not have to chase implementation file moves.

For any helper moved into an internal module, decide explicitly whether it is private or re-exported via the existing API. Avoid gratuitous exports.

## Scope exclusions and stop conditions

- Behavior-preserving TypeScript refactor only. No new notation kinds, spacing rules, line breaks, manual system breaks, clipping policy, hit geometry, history behavior, serialization, CSS, SVG DOM, dependency or accessibility changes.
- No rewrite of `system-vertical-layout.ts`, geometric recipe modules, graphical placement, reducers or renderer. These already have owners.
- Do not mix this with the potential Firefox lyric focus issue ([issue #96](https://github.com/OceanOSdev/gregorian-chant-editor/issues/96)) or browser-driver timing cleanup.
- If proposed module boundaries require huge prop/config objects, a runtime import cycle, changes to the public layout contract, or a second geometry path, **stop and present narrower alternatives** before proceeding.
- If a test uncovers credible new layout behavior or conflicts with accepted ADRs, stop and seek an owner decision rather than re-baselining expectations.
- Don't pursue optional reducer refactoring (M4) in this PR.

## Authoritative contracts to read

Start with `AGENTS.md` and [AI workflow](../ai-workflow.md), then read the targeted sections of:

- [Architecture](../architecture.md#module-map)
- [Layout and rendering](../layout-and-rendering.md), especially wrapping, Stage 4C/9C spacing, lyrics, divisions/slots, custodes, containment and Stage 11B
- [Testing](../testing.md)
- [ADR 0010](../adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md), [ADR 0011](../adrs/0011-word-aware-chant-engraving.md), [ADR 0013](../adrs/0013-divisions-interrupt-word-compaction.md), [ADR 0026](../adrs/0026-derived-intra-syllable-spacing.md), [ADR 0028](../adrs/0028-compose-before-vertical-lyric-clearance.md)

Accepted ADRs remain authoritative. This refactor should require **no new ADR** unless an actual durable decision changes (which is outside scope).

## Acceptance and verification

### 1. Baseline and structural understanding

Before implementation, inventory:

- all external imports of `layout-chant.ts`, including its public exports;
- every horizontal input/output type and each state variable in `placeNeumeSequence`;
- phase dependencies, especially whether finalizing a system affects subsequent wrapping;
- how the layout's derived geometry flows into preview, placement and SVG pointer ownership.

Record the proposed module graph and why each extracted unit owns a coherent responsibility. After implementation, answer in the PR exactly where to modify wrapping, word clearance/hyphens, vertical system heights, insertion slots and final canvas bounds. Report before/after file sizes as secondary evidence, not the objective.

### 2. Differential layout evidence

For the **exact M3 base** and the final candidate, compare serialized `layoutChant` outputs and public helper results on a broad fixture matrix. Use deterministic, complete structural comparisons rather than screenshots or selective bounds. Cover at least:

- Empty/single/neume-only scores; normal multi-system wrapping, exact fit and leading/trailing divisions or mid-score clef changes;
- Gregorian chant bundled examples: Kyrie XI, Dominican Salve Regina (including the low note at _Et Jesum_), Pater Noster and any other applicable examples;
- Measured and missing/partial lyric metrics, narrow and oversize syllables, same-word compact and intra-syllable spacing, melismas, continuation/outgoing hyphens and forced word boundary exceptions;
- Written accidentals (including independently placed signs), rhythmic signs, repeated-note and compound neumes, clef changes and custodes;
- Expanded high/low systems, extreme ledger coordinates, clipping bands, staff/baseline positions, canvas bounds and negative x origins;
- Pointer hit ownership and score insertion slots across compact boundaries, divisions, clefs and custodes.

Compare the same `ChantDocument` and the same controlled font-measurement inputs on base and branch. A scratch differential harness is acceptable; clearly report its fixtures, exact revisions and the assertions it performs. Retain focused permanent regression tests for any newly isolated pure seam where they improve maintainability. Do not replace previous assertions with a new snapshot that simply encodes the branch output.

### 3. Automated and browser checks

Run the standard gate in [testing](../testing.md): `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`; run browser-runner self-tests if applicable.

Inspect the browser-runner manifest and run appropriate Chromium and Firefox drivers on the **final substantive revision**, including layout/wrapping/word-composition/lyric-spacing, divisions, mid-score clefs, accidental placement, dynamic-vertical-layout, ledger lines, note-shapes, selection and bundled examples. A full preset on both browsers is desirable given the breadth of M3, with a base-versus-branch pair comparison. Do not call known flaky baseline cases "passes" or treat old six-failure counts as waivers. Reproduce any suspicious failure on the exact base before classifying it. Do not weaken tests or rewrite expected engravings solely to make the refactor pass.

Verify production preview (prefer the repository's browser runner), particularly:

- reflow triggered by lyric measurements, whole-neume wrapping and stable IDs;
- expanded systems with the shared lyric baseline, 24-unit system gap and bounded music clip;
- score/preview/pointer alignment after reflow and unusual canvases;
- 320px width and 150% CSS zoom, where supported.

Separately describe any foreground visual, print or assistive-technology checks not run. Pure layout equality supports unchanged SVG but does not by itself prove browser rendering or pointer behavior.

### 4. Reviewability

The implementation PR should show a comprehensible orchestration path without preserving old large functions as an opaque relocated blob; preserve algorithm cohesion while improving naming and local documentation. Make a short ownership map and justify why no additional abstraction was needed. Use a focused independent review of correctness, design, conventions and claims before merge.

## Delivery

Implement only on `refactor/layout-orchestration-m3`; preserve unrelated local changes. Update authoritative `docs/architecture.md`, `docs/layout-and-rendering.md` and relevant tests/verification records **in place** (avoid duplicate permanent guides); do not edit accepted ADR decisions for a mechanical refactor.

Commit, push and open a PR targeting `master`. Report the exact final SHA, changed files, design choices, structural parity/differential evidence, verification results, baseline exceptions, manual acceptance and deviations. **Do not merge.** The owner will decide whether to remove the one-off plan before merge or retain it with a completed historical status.

## Closeout

Completed 2026-11-17 in PR #97 (implementation `aa60bf7`, review follow-up `667590e`). The PR holds the actual verification; the [layout pipeline ownership](../layout-and-rendering.md#layout-pipeline-ownership) section and the [architecture module map](../architecture.md#srceditorlayout) own the resulting contract.

- Delivered as planned: `horizontal-system-composition.ts`, `system-layout-assembly.ts` and `chant-layout-types.ts`, with `layout-chant.ts` as the public entry point and orchestrator. No new ADR; no behavior change. A scratch differential (not committed) found byte-identical layout output against the base.
- **Print preview was not part of this milestone's acceptance.** No print, print-preview, foreground visual or assistive-technology checks were run or accepted; the identical layout output supports, but does not prove, unchanged printed rendering.
- Open from verification: the Firefox `mid-score-clefs` 150% zoom failure (the existing known intermittent issue) failed 2 of 6 branch runs and 0 of 6 base runs. That sample cannot distinguish the rates, and it was not reproduced on the base.
- Remaining stages: M4 (optional reducer refactoring) is not started and needs its own plan.

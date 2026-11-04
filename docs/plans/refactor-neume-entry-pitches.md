# Plan: Share graphical and toolbar neume-entry pitch construction

Branch: `refactor/neume-entry-pitches`
Target: `master`
Base commit: `b120daba0b7523d6eff69047a12fe8d213f10ba9` (merged PR #50)

## Problem and goal

The editor independently constructs the same seven default neume pitch contours in two places:

- `src/editor/layout/layout-chant.ts` — `createGraphicalNeumePlacement`, used by pointer placement.
- `src/editor/interaction/insert-editor-neume.ts` — the switch in `resolveEditorToolbarInsertion`, used by contextual toolbar insertion.

The pitch patterns are musical entry conventions, whereas pointer snapping, toolbar fallback, semantic insertion boundaries, and preview generation are distinct operations. The duplicated pitch recipes make future neume additions more error-prone.

**Goal:** Represent the default graphical/toolbar pitch pattern of each supported kind in one pure, well-typed place and consume it from both paths. This is the next _small, behavior-preserving maintainability PR_ after geometry extraction, not a general layout or insertion redesign.

## Read first

- `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`, `docs/editor-interactions.md`, `docs/layout-and-rendering.md`, `docs/commands-and-history.md`, and `docs/testing.md`.
- Accepted ADR 0002 (semantic/derived separation), ADR 0004 (explicit neume types and ordered tuples, exhaustive handling, separate graphical whitelist), ADR 0007 (shared engraving geometry), and accepted division/combined-layout ADRs 0010–0013 where relevant.
- Review `src/editor/interaction/resolve-graphical-neume-placement.ts`, `src/editor/commands/resolve-toolbar-neume-insertion.ts`, `src/editor/state/editor-session.ts`, and relevant placement/toolbar tests.

## Agreed decisions

1. Preserve all seven supported graphical neume kinds, their exact pitch offsets and semantic note order:
   - Punctum: [0]
   - Podatus: [0, +1]
   - Clivis: [0, -1]
   - Scandicus: [0, +1, +2]
   - Torculus: [0, +2, +1]
   - Climacus: [0, -1, -2]
   - Porrectus: [0, -2, -1]
2. Prefer a small **pure, exhaustive, kind-aware construction function** (or similarly restrained typed helper) rather than a generalized glyph registry, plugin framework, classes, or a collection of unrelated configuration values. Do not weaken the discriminated unions or fixed-cardinality tuple guarantees from ADR 0004; preserve compile-time exhaustive handling.
3. Place the shared helper where both layout and interaction can consume it without a runtime import cycle. If moving placement-specific type declarations is necessary, keep existing public imports compatible using re-exports. Choose the smallest coherent module boundary.
4. Keep the following _distinct existing behavior_ exactly as it is:
   - Graphical placement snaps to its hovered staff position, chooses a whole-neume insertion boundary and renders its caret and ID-free ghost on the committed layout.
   - Toolbar insertion derives a reference position from the existing selection, and retains its current fallback pitch policy: 3 for Clivis, Climacus, Porrectus and 2 for the other kinds.
   - Selected divisions require explicit before/after controls; `ScoreInsertionBoundary` and sibling division ordering stay unchanged.
   - Fit checks, system targeting, wrapping, preview/commit geometry parity, stable IDs, focus, selection, undo/redo and continued placement remain unchanged.
5. Existing neume insertion commands and domain validation stay authoritative. Do not conflate the shared _default entry contour_ with semantic validity, engraving geometry or general pitch transposition.

## Scope

- Deduplicate the kind-specific staff-position construction currently appearing in `createGraphicalNeumePlacement` and `resolveEditorToolbarInsertion`.
- Maintain or simplify the surrounding typed conversions, but only when the change clearly improves readability and type-safety. A kind switch that exists to preserve a correlated discriminated union is acceptable; do not remove exhaustive switches merely to reduce their count.
- Make localized updates to documentation if module ownership or the public contract genuinely changes. Keep the architectural guide accurate without repeating low-level code.
- Add focused tests for the shared pitch helper and equivalence of both entry paths. Reuse existing test matrices where practical.

## Exclusions

- Do **not** modify `ChantDocument`, `Neume`, `ChantNote`, notation semantics, new neumes or modifiers, normalization, note movement, engraving paths, glyph metrics, or `neumes/` geometry builders.
- Do **not** refactor `placeNeumeSequence`, music-and-lyric wrapping, `layoutChant` final assembly, `ScoreSvg`, `ChantEditor`, or the session reducer as part of this PR.
- Do **not** alter ID allocation, keyboard shortcuts, focus/reveal handling, layout slots, division behavior, event handling or persisted formats.
- Do not introduce new dependencies or perform formatting-only changes outside touched files.
- Do not add speculative facilities for Virga, Quilisma, mora dots or accidentals.

## Acceptance and verification

- One obvious source of truth for default pitch construction; no duplicate kind-specific offset lists remain between the two entry paths.
- Preserve exact kind-correlated fixed tuples and exhaustive TypeScript checking; no lossy `StaffPosition[]` casts or `as any` workarounds.
- Graphical and toolbar insertion produce the exact same _staff-position sequence_ for the same kind/reference pitch. Preserve their distinct positioning, fallback and score-boundary policies.
- Verify all seven kinds at multiple first pitches, including negative/above-staff where already accepted; preserve each toolbar fallback and selection-derived starting pitch.
- No behavior changes to placement hit testing, snapping, previews, exact-fit/clamped ghosts, multi-system placement, division-adjacent insertion, repeated insertion, or atomic undo/redo.
- Tests remain at the smallest pure seam; add only focused regression assertions. Check for lost abstraction/duplicated responsibilities and avoid redundant convenience wrappers.
- Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build` and report actual results. Use the repository's existing real-browser drivers or manual Firefox checks when practical; distinguish automated from foreground verification.
- Inspect the diff for unintended layout or behavior changes, not just passing tests.

## Stop conditions and delivery

If deduplication requires weakening typed neume invariants, changing an accepted ADR contract, or introducing an awkward import cycle / broad reorganization, **stop and report options** rather than expanding the PR. Ordinary module naming and helper extraction choices need no additional approval.

Implement on `refactor/neume-entry-pitches`, commit changes and open a focused PR against `master`. Do not merge. Include the actual verification results and any deviations in the PR description.

**Keep this committed plan available during PR review.** The owner can choose to remove or close it out before merge, consistent with `docs/ai-workflow.md`. Do not remove it automatically before the review is complete.

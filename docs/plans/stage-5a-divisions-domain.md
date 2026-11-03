# Plan: Stage 5A — semantic chant divisions and ordered insertion boundaries

Branch: `feat/stage-5a-divisions-domain`
Target: `master`
Status: **Stage 5A implemented and reviewed; ADR 0012 Accepted by the owner (2026-11-02). PR #47 merged.**
Stage 5B graphical editing subsequently merged in PR #48; Stage 5C owner acceptance is pending.
The handoff instructions below are historical; do not restart implementation.

The original handoff below required ADR 0012 to remain Proposed until the owner
made a decision. The owner has now approved the implemented semantic boundary
model in [PR #47](https://github.com/OceanOSdev/gregorian-chant-editor/pull/47).
That acceptance does not approve graphical engraving or interaction policies;
explicit graphical insertion, division spacing/wrapping and lyric hyphenation
integration require a separate Stage 5B handoff. The original requirements below
are retained as the historical implementation brief.

## Problem and intended milestone

We can enter and edit neumes and lyrics, but cannot author the musical punctuation that marks chant phrases and sections. Stage 5 adds _divisiones_ without treating them as pitched neumes or disturbing the now-accepted lyric and layout contracts.

Stage 5 is intentionally split:

- **5A (this PR):** define and implement the semantic division model, pure commands, stable ordered insertion/deletion rules, focused tests, and a **Proposed** ADR 0012.
- **5B (later PR):** engraving and editor UX: select/replace/delete a division, accessible controls, graphical and keyboard insertion, clear left/right caret preview, wrapped-system layout, and history/focus.
- **5C (later PR):** cross-browser/owner acceptance, visual and interaction verification, documentation closeout.

This plan is not approval to implement 5B/5C in 5A.

## Agreed user-visible behavior and scope

The owner explicitly wants to insert new **neumes on either side of an existing division**, with an unambiguous choice rather than an invisible side assignment. Example with neumes A and B, a division D, and a new neume X:

- Insert **before** division: `A · X · D · B`.
- Insert **after** division: `A · D · X · B`.

Those are different semantic orders, **even though** both insertions may correspond to the same index in today's neume-only array. 5A must supply an explicit pure insertion boundary/intent that preserves this distinction; 5B will provide visible caret/preview affordances. Divisions occupy their own ordered score positions. Insertion must not implicitly replace/delete a division or change any surviving syllable's neume anchor.

Support these initial kinds as discrete semantic values: **divisio minima** (quarter bar), **divisio minor** (half bar), **divisio maior** (full bar), **divisio finalis** (double bar). A finalis can mark a major section as well as the end, so do not hard-code it to the final score position. Other signs, especially the comma-like _virgula_, are future scope, not an additional fifth kind in 5A. Do not add modern metrical measures or rhythmic durations.

For reference on conventional shapes/terminology, consult the Gregorian sources rather than inventing engraving sizes at the domain layer:

- Gregorio/GABC separation bars: https://gregorio-project.github.io/gabc/
- Gregorio tutorial: https://gregorio-project.github.io/tutorial/tutorial-gabc-01.html

## Current contracts and risks

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/domain-model.md`, `docs/commands-and-history.md`, `docs/architecture.md`, `docs/editor-interactions.md`, `docs/layout-and-rendering.md`, `docs/testing.md` and the ADR index. In particular:

- **ADR 0002:** semantic versus derived presentation state.
- **ADR 0003:** stable semantic IDs.
- **ADR 0004:** neumes have explicit pitched kinds and ordered note tuples.
- **ADR 0008:** syllables anchor to **neume IDs**, not positions, divisions, or inferred systems.
- **ADRs 0010/0011:** one authoritative music/lyric layout and measured word-aware composition, without persisted glyphs, hyphens, or wrapping decisions.

Currently `ChantDocument.neumes` is a contiguous ordered array, and many commands, insertion resolvers, pointer boundaries, layout/wrapping routines, and lyrics use neume-only indexes. Simply inserting a note-less kind into the `Neume` union would violate those assumptions. Likewise, storing an `afterNeumeId` marker naively is insufficient to express insertion on _both_ sides without explicit reanchoring. This is a material semantic decision: record it in **Proposed ADR 0012**, not as an unnoticed edit to an existing accepted ADR.

## Recommended semantic direction (evaluate, then implement)

Prefer retaining the independent `neumes` array and adding a separate collection of stable-ID, non-pitched `ChantDivision` entities. Represent divisions relative to **semantic neume boundaries**, not pixel positions, measured systems, a generic syllable, or array offsets that become stale on insertion.

A potential shape for evaluation is a `divisions` sequence whose items contain an ID, four-valued kind, and an anchor such as `beforeNeumeId: string | null` (null means the end of the neume sequence). The exact representation is **a design proposal**, not a mandated type signature. Ensure its order among divisions at the same neume boundary is deterministic and editable. Derive the full ordered score stream for relevant commands/layout; do not persist both independent redundant order authorities.

For example, if D is before B:

- inserting X **left** of D should yield A X D B, keeping D before B;
- inserting X **right** of D should yield A D X B, moving D to the boundary before X;
- insertion at the score start/end must be similarly explicit when a division is present;
- if multiple divisions converge at one boundary after a delete, never silently discard them; preserve stable relative order or stop to present a carefully justified alternative.

A unified `(Neume | Division)[]` ordered event stream is a genuine alternative, but would replace the existing `document.neumes` contract across much of the app. Compare it with the separate-boundary model in the proposed ADR (migration costs, invariants, insertion/deletion semantics, accessibility/layout integration). Do **not** perform a broad event-stream rewrite merely for conceptual uniformity. If the recommended separate model cannot honor the agreed left/right UX robustly, **stop and report the tradeoff** rather than improvising a different accepted architecture.

No persisted document schema exists yet. The domain model may be extended now without implementing save/load or claiming a migration strategy. Choose required versus optional `divisions` on `ChantDocument` deliberately; validate runtime data and update current fixtures/tests as needed, rather than silently treating malformed values as valid.

## Pure semantic rules to establish in 5A

1. **Identity and validation:** divisions have stable unique IDs and one supported kind, no notes or pitches, no syllable anchors or rendered coordinates. Invalid IDs/kinds/boundaries are rejected consistently with current command semantics. Existing lyric anchor order remains based solely on neumes.
2. **Insertion:** insert a division at an explicitly identified score boundary; allow a final division after the last neume. Neume insertion at a boundary containing divisions distinguishes the left/right side. If multiple divisions are adjacent, respect explicit position among them, not just a neume index.
3. **Replacement/deletion:** changing a division's kind preserves its ID and position; deleting a division removes only that entity. Both are atomic, undoable semantic edits. Do not mutate adjacent notes, neume IDs, or lyrics.
4. **Neighbor deletion:** deleting a neume must not strand a dangling division reference or silently erase musical punctuation. Reanchor affected divisions deterministically to the next surviving neume or end, preserving relative order; consider cases where other divisions already occupy the destination boundary. Existing ADR 0008 policy for a syllable anchored to a **deleted neume** remains unchanged.
5. **Existing edits:** insertion/deletion/normalization/vertical movement of unrelated neumes must preserve division ordering and IDs, or update affected boundary anchors solely as required. Deleting a _note_ that normalizes but preserves its neume ID must not move its divisions.
6. **History/no-op:** rejected or unchanged commands return the exact input document reference; an accepted operation is one atomic semantic history step. Undo/redo restores music, lyrics, divisions, and their semantic order together.
7. **Lyrics:** do not change `startsAtNeumeId`, `boundaryBefore`, lyric spans or user-entered text because a division is inserted/edited. Whether a division should visually interrupt compaction/hyphenation is a **later 5B engraving decision** requiring explicit review against ADR 0011; 5A must not silently amend it.

Use focused pure helpers/types; avoid adding a parallel global notation-history system, another selection model, browser dependencies, or a persisted pixel-based order.

## Acceptance tests (must be demonstrable in pure TypeScript)

- A D B + X inserted left of D => A X D B; inserted right of D => A D X B, with stable surviving IDs and lyric anchors.
- Divisions at the beginning and end of a score; insert into an empty score and after a trailing finalis; division remains independent of music pitch.
- Multiple adjacent divisions and deletion of a neighboring neume: deterministic stable relative order, no dangling references, no lost division, no accidental skipped/duplicated divisions.
- Deleting a non-anchored or anchored neume preserves existing musical and lyric deletion policy, and rehomes punctuation without touching surviving syllable anchors.
- Division kind change and removal; invalid kind/anchor/duplicate ID/no-op; history undo/redo exact restoration.
- Existing neume insertion, deletion/normalization, lyric entry/anchor validation and wrapping/geometry tests still pass; no new layout/renderer behavior is claimed in this stage.

Tests should assert the resulting **derived order**, not only division-array snapshots. Keep 5A code and tests free of React and browser APIs. If migrating existing fixture builders to include empty division lists is necessary, keep that change mechanical and do not revise their musical meaning.

## Documentation and proposed ADR

Create `docs/adrs/0012-...` with status **Proposed** (do not mark Accepted). Explain separate-boundary and unified-stream alternatives, how left/right insertion works, deletion/reanchoring, multi-division boundary ordering, and costs to the existing index-heavy implementation. Update the authoritative domain and commands/history guides to accurately describe _implemented_ 5A semantics; note that rendering and UI remain 5B work. Do not misrepresent headless/manual acceptance or future save/load as completed.

Audit the root README for stale statements from Stage 4 (vowel alignment, hyphens, browser automation), and fix those strictly factual descriptions if convenient; avoid a large unrelated docs cleanup.

## Non-goals / stop conditions

Do not implement SVG bar glyphs, palette buttons, graphical pointer selection, new keyboard shortcuts, automatic system-break rules, CSS, PDF or GABC import/export, save/load/autorecovery, playback, new neume kinds, or virgula in 5A. No backend, new dependency/framework, persisted document schema, or changes to accepted ADR 0008/0010/0011 without explicit review.

Stop and report evidence/options if:

- it is impossible to represent the user's explicit left/right insertion behavior with the separate-boundary approach without brittle dual ordering;
- deterministic reanchoring conflicts materially with existing lyric or insertion contracts;
- the required change exceeds a focused semantic model slice and looks like an editor-wide rewrite.

## Verification and delivery

Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, and `git diff --check`. Preserve unrelated local work. Document any checks not run and avoid claiming the new divisions render in the UI yet.

Implement on this branch, commit changes, open a PR against `master`, and return the PR URL with a concise summary of the chosen model, alternative considered, test results, and any open architectural questions. **Stop before merge** for ChatGPT review and owner approval. Leave ADR 0012 Proposed until its owner decision.

# Stage 3 handoff: Lyric anchor correction

Branch: feat/lyric-anchor-correction
Target: master
Status: Agreed implementation handoff. ChatGPT owns only this plan commit; local Codex implements and opens the PR.

## Problem and user-visible goal

After entering music and lyrics, the user must be able to move an existing syllable's starting anchor to another neume without deleting/recreating syllables or changing music. For example, if `Ky` begins at n1, `ri` at n4 and `e` at n6, move `ri` to n3 without affecting the others.

## Existing contracts and code

- Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/plans/lyric-system-redesign.md`, the accepted lyric-anchor ADR 0008, `docs/domain-model.md`, `docs/editor-interactions.md`, `docs/commands-and-history.md` and `docs/testing.md`.
- Stage 1 supplied stable neume-anchored syllables and the pure `reassignLyricSyllable` command (`src/editor/commands/reassign-lyric-syllable.ts`). Stage 2 supplied a single transient Lyrics workflow, valid/invalid draft resolution, independent keyboard focus versus semantic selection, and atomic history.
- Reuse existing semantic IDs, selection/focus and pure command/history seams. Check current code rather than assuming names or interfaces from this plan.

## Agreed interaction

1. Select an existing engraved syllable, then choose a clearly named **Move syllable** action in its controls. Do not steal Enter, `L`, or double-click from existing text editing.
2. Enter a _temporary reassignment mode_. Clearly identify the moving syllable, its current anchor and legal destination neumes in the score. Show an understandable instruction and an accessible announcement.
3. **Pointer decision: clicking a valid destination neume immediately commits the reassignment. There is no additional Confirm step for pointer input.** This is an explicit project-owner decision.
4. **Keyboard:** Previous/Next controls and Left/Right arrow navigation browse candidate neumes; Enter confirms the currently previewed destination. Escape cancels reassignment without a semantic edit. Preserve normal Tab/Shift+Tab traversal where appropriate.
5. Make current candidate and eligibility understandable with visible focus/preview and accessible labels. Invalid/occupied/crossing destinations must never silently swap, reorder, overwrite or change unrelated syllables. Explain rejection through existing announcement patterns; keep the mode recoverable.
6. After commit, return to the preceding editor/Lyrics context as practicable, retain the moved syllable's identity and selection, and place/reveal focus predictably. Cancel restores the preceding context without a document/history change. Do not conflate browser focus with semantic selection merely to browse candidates.

## Domain invariants and history

- Reassignment is **anchor-only**: preserve syllable ID, text, `boundaryBefore`, sibling syllables, neumes, notes and music order.
- Legal destinations must exist, be unoccupied by another syllable and stay strictly between the preceding and following syllable anchors in semantic neume order. First/last syllables can move into available lyricless prefix/suffix within those constraints.
- The unchanged target, missing IDs, occupied targets and crossing attempts are exact-reference no-ops at the pure command boundary. Never swap or implicitly reorder anchors.
- One successful reassignment is **one** atomic history step. Undo/redo restores the original/new anchor exactly; candidate browsing, failed clicks and cancellation create no history.
- Entering reassignment must resolve active lyric drafts using the established Stage 2 commit-on-navigation and invalid-draft safeguards. Valid changed drafts commit before activation as necessary; unchanged/empty behavior remains consistent; invalid or stale/recovery drafts block the transition without losing text. Never silently discard or retarget a draft.

## Implementation scope

- Build only Stage 3: start/browse/cancel/commit reassignment, legal-target feedback, keyboard and pointer targeting, draft integration, announcements and focus restoration.
- Favor the existing session reducer, pure reassignment command, SVG interaction patterns and lyric controls over new state stores or parallel semantic models.
- A move must be explicit: normal neume clicks, normal selection, placement mode and sequential lyric entry remain unchanged outside reassignment.
- Do not implement drag-and-drop, mass redistribution, automatic syllabification, lyrics-first entry, hyphen generation, word extenders, new notation, persistence or new dependencies. Stage 4 remains separate.

## Acceptance and verification

- Demonstrate moving a middle syllable to a free earlier and later neume, plus eligible edge positions for first/last syllables.
- Check occupied/crossing/no-op and missing-target cases; unchanged music and other anchor IDs; exactly one history entry with undo/redo.
- Verify mouse click-to-commit (no confirmation), keyboard Previous/Next or Left/Right + Enter, Escape cancellation, absence of normal-mode side effects and intelligible rejected-target feedback.
- Exercise focus-versus-selection independence, keyboard-only accessibility, reflow/multiple systems, and draft cases: valid dirty edit, unchanged edit, invalid text, and stale/recovery draft.
- Add focused pure tests and relevant real-browser verification. Update owning guides and redesign-stage status accurately; retain `docs/plans/lyric-system-redesign.md` until Stage 4 is merged.
- Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, plus practical browser checks (especially Firefox manual checks where Chromium coverage is insufficient). Report what actually ran and any limitations.

## Open questions and stop conditions

- This plan fixes the core interaction and invariants, not every rendering detail. Choose simple, consistent legal-candidate indicators and keyboard focus handling based on existing conventions.
- Stop and report options before implementing if a material conflict with ADR 0008, Stage 2 draft safeguards, or score selection/focus semantics arises. Do not broaden Stage 3 to solve unrelated UX problems.

## Delivery

Implement **on this same branch**, commit the implementation, and open a PR against `master`. Report changes, tests/manual checks, tradeoffs and follow-ups. Do not merge. Before merge, propose removing this one-off handoff plan after durable contracts are captured in the owning guides, consistent with `docs/ai-workflow.md`.

# Plan: Stage 5B — division engraving, insertion and editing UX

Branch: `feat/stage-5b-division-engraving-ui`
Target: `master`
Status: implementation handoff after owner-approved Stage 5A; owner graphical acceptance pending.
Do not merge. Do not silently change Accepted ADRs.

## Goal

Let authors see, create, select, modify and delete the four Stage 5A chant divisions (minima, minor, maior, finalis) in the ordinary four-line score. Preserve the specifically agreed experience: given **A | B**, the author can insert **X before** the bar (`A X | B`) or **X after** the bar (`A | X B`) using an unmistakable graphical caret and an accessible keyboard/button path. Stage 5B should be a working vertical slice, not a static drawing.

Stage 5A has merged as PR #47 and **ADR 0012 is Accepted**. Its `ChantDocument.divisions` model, `beforeNeumeId`, `ScoreInsertionBoundary`, `deriveScoreOrder`, division commands, stable IDs, deletion/reanchoring, and no-op/history contracts are authoritative. Stage 5C remains the detailed cross-browser/owner acceptance and closeout milestone.

## Essential reading

- `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`, `docs/domain-model.md`, `docs/commands-and-history.md`, `docs/layout-and-rendering.md`, `docs/editor-interactions.md`, `docs/testing.md`, `docs/roadmap.md`.
- **Accepted** `docs/adrs/0012-divisions-at-semantic-boundaries.md`; ADR 0008 lyric anchors; ADRs 0010/0011 combined measured layout/word composition; ADR 0007 engraving geometry; ADR 0002 semantic/derived separation.
- Inspect `src/editor/domain/divisions.ts`, `src/editor/commands/{insert-neume,edit-division}.ts`, `src/editor/layout/layout-chant.ts`, `src/editor/interaction/resolve-graphical-neume-placement.ts`, `src/editor/interaction/insert-editor-neume.ts`, `src/editor/state/{selection,editor-tool,editor-session}.ts`, `src/editor/rendering/ScoreSvg.tsx` and `src/editor/components/ChantEditor.tsx`.

Notation references: Gregorio's [GABC separation bars](https://gregorio-project.github.io/gabc/#separation-bars) and [worked tutorial](https://gregorio-project.github.io/tutorial/tutorial-gabc-01.html). Inspect representative modern square-notation scores and use appropriate staff-relative glyph proportions. References inform engraving, not any automatic rhythmic timing.

## UX contract

### Division types and controls

- Render the four kinds as conventional thin quarter/half/full/double bars in an ordinary four-line staff. Keep the meaningful shape visually distinct from note stems and the clef. Use measured SVG geometry; do **not** treat them as pitched neumes or generate glyphs from arbitrary `staffPosition` values. Finalis remains legal in the middle or at the end.
- Add a discoverable way to choose a division kind and enter a **persistent graphical division placement tool**, consistent with the existing palette/selection/Escape conventions. Avoid eight extra unstructured toolbar buttons if a compact grouped/menu/dropdown mechanism is clearer; keep neume palette and existing I/T keyboard semantics working. Do not steal the remembered neume kind when a division tool is selected. No new implicit text/delimiter meaning in lyrics mode.
- Click a musical boundary to place the chosen division; hover supplies a visible insertion caret at its **semantic ordered slot** and a division ghost. Neither caret nor ghost changes the document, expands the Tab order or eats pointer events. Click commits one semantic edit; repeated placement remains possible; Escape returns to Select.
- In Select, clicking or focusing a committed division selects it by stable division ID, independent of DOM keyboard focus. Provide visible selected and focused cues (distinct, as with neumes/lyrics). Delete/Backspace removes the focused/selected division intentionally, not adjacent notes. Offer an accessible way to **change the division kind** without delete/recreate; preserve its ID and order. Include accessible name, role, state, instructions and meaningful score summary. Division selection/focus must survive layout reparenting and undo/redo when target survives; clear or restore appropriately when deleted.
- Crucially, expose **two different neume insertion slots on opposite sides of a division**, including when several divisions are adjacent and at beginning/end. Pointer horizontal intent must identify the real slot (with a caret on the correct side) before commit. Also provide an **explicit keyboard/controls-based before/after choice** when a division is focused/selected; don't force keyboard users to simulate pointer coordinates. Avoid a hidden default side or a silent no-op due to legacy numeric insertion.
- Continue to support existing contextual `I` insertion for neumes, the `T` focus shortcut, palette roving navigation, native Tab/Shift+Tab, and working note/lyric shortcuts. A specific division keyboard shortcut is optional, not a requirement; do not assign a collision-prone unmodified shortcut without review. Respect composition, editable-input, modifiers and autorepeat safeguards. Contextual insertion when a selected neume is next to punctuation must resolve explicitly rather than reverting to ambiguous numeric insertion.
- No need for a modal or separate document-level "division list" editor.

### Derived layout and wrapping

- Integrate divisions in the **one authoritative layout/wrapping/interaction computation**, using `deriveScoreOrder` and the existing measured music+lyric geometry. Do not draw them after neume placement at arbitrary offsets or keep competing "rendered" and "hit-test" positions.
- Expose stable-ID `DivisionLayout` instances inside each derived system, with accurate horizontal occupied bounds, a suitable padded but non-overlapping hit target, y coordinates derived from staff lines, and sufficient width/advance. Keep all existing neume and lyric layout contracts, pointer-to-SVG transforms, clip ownership and exceptional canvas policy. Division geometry must not collide with neumes, attached lyrics, conditional/outgoing hyphens, or neighboring divisions.
- Derive a usable ordered sequence of score items and **explicit slots** for point-based placement. Existing `insertionIndex` on neume-only resolvers is insufficient. Update both graphical and toolbar insertion bridges to pass a valid `ScoreInsertionBoundary` through to Stage 5A commands. The graphical caret and actual commit must agree even after reflow; derive the intent against the *current* semantic document in the reducer as Stage 4 already does for rapid repeated clicks.
- A division normally stays **with the preceding musical phrase ending**, rather than appearing alone as the first item of a new system solely because a previous system was full. Wrapping must account for bar width **before** splitting; prefer moving the previous neume and its following division(s) together when necessary. Do not allow endless wrapping loops, orphan empty systems or splitting neumes. Explicitly authored **leading** divisions and division-only/empty music cases must render deterministically; avoid a universal invariant that prevents those legal Stage 5A structures. Preserve normal fit equality and bounded oversize progress. Treat the trailing finalis as a legitimate ending on the last occupied system; no automatic forced break for maior/finalis.
- Multiple divisions in a row, division with no neumes, and leading/trailing divisions need stable system assignment, non-overlapping geometry, consistent semantic order and usable pointer targets. Keep the status of any exceptional/ambiguous wrapping arrangement documented.
- A division is a visible musical separation, so as a **proposed Stage 5B display policy** it should block the *contextual same-word neume compaction* that otherwise could bring notes/letters across the bar together. **Never change** the document's `boundaryBefore` metadata, syllable anchors or lyric text. Distinct words should keep normal clearance. When a division is placed within a semantically continuing word, preserve an honest indication of continuation (derived hyphen if the existing rules require it) without colliding with the bar; handle same-system vs cross-system placement. In particular do not make two syllables silently appear joined across the bar or hide a required outgoing continuation mark.
- **ADR guard:** ADR 0011 is Accepted. If suppressing compact layout across a division or choosing hyphen placement materially qualifies the previously accepted policy rather than merely applying it to an intervening punctuation item, *stop the affected implementation, explain the options and write a Proposed narrow ADR/addendum for owner review*. Do not quietly edit ADR 0011 to claim acceptance; keep other unaffected work moving if practical.

### State and behavior

- Preserve document history as semantic snapshots only; changing/removing/inserting a division is one atomic undoable action, no transient focus/hover/selection in history.
- Include division selection/focus reconciliation in `EditorSession` and SVG without breaking note, syllable, lyric-move, dirty draft/history prompt and placement interactions. Do not lose or auto-commit dirty drafts when changing modes in a way that violates current policy.
- Use existing Stage 5A command validation and no-op identity; allocate IDs outside reducer updates consistently with other insertion. Never silently convert an occupied numeric index to an arbitrary side; remove reliance on numeric indexes where divisions are possible.
- Existing scores with `divisions: []` should look and behave the same (other than intentional, documented controls/help changes).

## Suggested implementation structure (Codex can refine)

Keep derivation pure: use a tagged score-event sequence, shared layout spacing/wrapping, stable-ID division geometry/slots, and pure pointer and selected-target insertion resolvers. Keep domain data free of pixels and UI state. A small **division geometry builder** alongside existing neume geometry is plausible, but do not duplicate the main placement/wrapping algorithm or mutate its output after hit testing. Expand `ChantSystemLayout`, score accessibility summaries and `ScoreSvg` deliberately. Reuse current neume-creation dispatch/ID allocation and focus request contracts where possible. Keep all layout/hit-testing decisions one source of truth.

If this turns out to require a sweeping change to the accepted semantic model or the Stage 4 combined lyric layout, **stop and return concrete architectural alternatives** rather than forcing a broad rewrite in 5B.

## Required verification / acceptance cases

Automated pure TypeScript checks and targeted real-browser driver(s) should cover:

1. **Core owner UX:** visible `A D B`; neume X inserted via pointer **left** gives `A X D B`, **right** gives `A D X B`; caret side matches commit. Repeat with keyboard/button choice; lyric anchors and surviving IDs unchanged; no silent rejected numeric insertion.
2. All four bar kinds visually distinct and staff-correct; placement preview, selection, focus, kind replacement and deletion; semantic history undo/redo including after reflow; tab order, labels, shortcuts and text-input guards.
3. Multiple adjacent divisions (before/between/after), leading/trailing, division-only/empty scores and trailing finalis, including keyboard and pointer insertion slots. Hit targets do not overlap note ownership or each other.
4. Width-boundary and two-plus-system cases, narrow 320px viewport, exceptional local horizontal scrolling, changing fonts/zoom and computed pointer mapping. No lost symbols, unintended orphan bars/empty systems, clipping or infinite loops.
5. Real word boundaries and same-word continuation around a division; resulting lyric spacing and conditional/outgoing hyphens remain readable and grounded in current measured glyphs (ADR 0010/0011), even when reflow changes the line.
6. Existing seven-neume placement, pitch movement, normalization, deletion, lyric entry/move, syllable focus, wrapping, compact word composition and score accessibility tests continue to pass. Existing layout tests should remain unchanged on division-free inputs.
7. Clear and accurate outcomes reported for pure tests vs headless Chromium/Firefox vs **manual foreground** or screen reader checks. Do not equate a headless DOM/ARIA assertion with spoken screen-reader verification.

Do not burden the 5B PR with comprehensive Stage 5C proof. But provide meaningful smoke verification for new graphical behavior in the actual browser, not only reducer tests.

## Documentation, scope, handoff

Update authoritative `docs/layout-and-rendering.md`, `docs/editor-interactions.md`, `docs/architecture.md`, `docs/testing.md`, and `docs/roadmap.md` where implementation changes present-day behavior. Update the README if it currently presents divisions as semantic-only. Avoid rewriting Stage 4 historical evidence, changing accepted ADR policies by implication, or adding nonessential fixtures/assets. Retain this multi-stage plan only with an accurate status; Stage 5C remains distinct.

Out of scope: Stage 5C full acceptance, virgula/minimis/Dominican bars, new pitched neume kinds, GABC/import/export, persistence, manual system breaks, custos, rhythm/playback, backend/cloud, browser/component test frameworks, and arbitrary historical notation profiles.

Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`, plus applicable existing headless browser drivers and new division-focused browser checks. Record actual commands and results, caveats and uncovered foreground scenarios.

Implement only on `feat/stage-5b-division-engraving-ui` after reading this committed plan and `AGENTS.md`. Commit and open a PR against `master`; do **not** merge. State any design deviations, ADR conflicts, browser validation limitations or unresolved choices in the PR and report the PR URL for ChatGPT review.

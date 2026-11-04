# Plan: Extract the interactive SVG division control

Branch: `refactor/score-svg-division-control`
Target: `master`
Base commit: `11381b20a6fb210fd6c6e560a9e505a991c8869d` (merged PR #52)

## Problem and goal

`src/editor/rendering/ScoreSvg.tsx` is approximately 900 lines and owns several distinct kinds of interactive SVG controls. One coherent portion of its system rendering is the inline division branch: the `<g data-division-id>` control, hit and selection rectangles, `DivisionInk`, focus registration, accessible labeling, and click/keyboard handlers. This branch currently lives inside a mixed neume/division paint-order mapping.

**Goal:** Extract only the interactive division control into a small, focused rendering component while preserving the SVG DOM, paint and hit order, semantic behavior, accessibility, and focus. Reduce `ScoreSvg`'s responsibility without beginning a broad React rewrite.

This follows the behavior-preserving layout and geometry refactors in merged PRs #50–#52. File length alone is not the objective; an independently meaningful component boundary is.

## Read first

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`, `docs/layout-and-rendering.md`, `docs/editor-interactions.md`, `docs/testing.md`, the relevant accepted ADRs (especially semantic/derived separation, shared geometry, and divisions), and the Stage 5B/5C division verification records.

Inspect `src/editor/rendering/ScoreSvg.tsx`, `src/editor/rendering/DivisionInk.tsx`, `src/editor/layout/division-geometry.ts`, `src/editor/interaction/resolve-score-slot.ts`, existing focus helpers/tests, and `docs/verification/divisions/browser-check.mjs`. Confirm which behaviors the current browser driver actually covers before changing JSX.

## Agreed scope and decisions

1. Introduce one focused component, e.g. `src/editor/rendering/DivisionControl.tsx`, responsible for **one committed division** and its existing control markup/handlers. Preserve the existing outer `<g>` as the sole root (no extra SVG group or wrapper). The parent remains responsible for interleaving divisions and neumes in existing x-sorted paint order, and keeps the React key at that mapping.
2. Preserve the complete DOM/ARIA contract of the existing division branch: classes, `data-division-id`, `data-division-kind`, `role="button"`, native SVG focusability, `tabIndex`, `aria-pressed`, `aria-disabled`, exact accessible-label wording and ordinal, `pointerEvents`, invisible hit rectangle, selected outline and `DivisionInk`. Do not alter layout bounds or CSS.
3. Preserve all event semantics exactly:
   - click stops propagation, selects only when not placing music/divisions or moving lyrics, and calls `focusAndReveal` on the clicked control;
   - keyboard guards composition, modifiers, repeated keydown and disabled modes;
   - Enter/Space select; Delete/Backspace delete; exact `preventDefault`/`stopPropagation` behavior remains;
   - other key actions and parent score-level pointer/click events continue to behave as before.
4. Preserve **ID-based focus tracking**. `ScoreSvg` retains the division-element registry and focus restoration/reveal effects. Pass the smallest explicit ref-registration callback necessary; register/unregister precisely as before, including DOM reparenting under measured reflow and StrictMode. Avoid new imperative focus state inside the child.
5. Keep the public `ScoreSvg` props unchanged. Pass only necessary division data, currently derived selected/disabled state, global division ordinal, system index, handlers and ref registration to the child. Do not introduce a general context, callback framework, hook abstraction or semantic IDs beyond existing data. If computing the ordinal outside the component, retain exactly the current global ordering and accessible name, including leading/adjacent divisions.
6. Keep `ScoreSvg`'s score-root handlers, neume/note controls, lyric controls, placement overlays, `SystemStaff`, aria title/description, layout, and any existing rendering order or clipping behavior unchanged. The existing `DivisionInk` remains reusable by both committed and preview divisions.

## Explicit exclusions

- No changes to semantic `ChantDocument`, division/note geometry, staff metrics, placement or score-slot resolution, wrapping, combined music/lyric layout, neume default contours, commands/history, React state management, CSS, or persistence.
- Do not extract the whole system rendering tree, note controls, lyric controls, focus effects or placement previews in this PR.
- No new packages, component testing frameworks, accessibility libraries, design decisions/ADRs, or speculative public APIs.
- Do not combine unrelated historical suggestions (e.g. fit-check signature changes, renderer architecture overhaul, palette completeness) with this extraction.
- No broad reformatting or mechanical rewrites to other portions of `ScoreSvg`.

## Acceptance and verification

- The new component owns one meaningful control rather than fragmenting pure styling into tiny wrappers. `ScoreSvg` keeps the same neume/division interleaving and all existing APIs.
- The output DOM and behavior of the division control are unchanged for each of the four division kinds, selected and unselected, placement/lyric-move disabled modes, long/adjacent division runs, and focus restoration after reflow. Preserve the exact global ordinal in accessible labels.
- Check the complete extraction diff for changed event propagation, ordering, `key`/`ref` behavior, focus, ARIA, target geometry and pointer ownership. Do not take a passing unit-test suite as proof of real DOM equivalence.
- Add focused assertions only if a genuine gap is found. There is no Vitest React/DOM test environment; **do not** introduce one just to test this small extraction or add brittle function/component identity tests.
- Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, and `git diff --check`. Report actual results.
- When practical, run `node docs/verification/divisions/browser-check.mjs` using the authoritative `docs/testing.md` Vite/Chromium setup. This is the primary native interaction test for the extracted section (click, focus, Tab/Enter, delete, adjacent/leading/trailing bars, responsive layout). Also run another existing browser driver only if the change plausibly affects its surface. Distinguish headless from manual Firefox/screen-reader work.
- Review the final patch specifically for maintenance quality, not just behavior parity. Update the authoritative rendering guide only where the ownership explanation genuinely improves accuracy; keep documentation concise and current.

## Stop conditions and delivery

Stop and present evidence/options rather than broadening the PR if the extraction changes the SVG structure or keyboard/focus behavior, requires a new state owner, creates a dependency cycle, or conflicts with an accepted ADR. Ordinary component naming/prop organization is left to Codex.

Implement on `refactor/score-svg-division-control`, commit, and open a focused PR against `master`. Include verification completed and not completed, with any deviations. Do not merge. **Retain this committed plan through review**, then have the owner select its final closeout (normally delete a one-off plan before merge).

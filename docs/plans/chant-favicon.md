# Plan: Replace the Vite favicon with a chant-themed favicon

Branch: `chore/chant-favicon`
Target: `master`

## Goal

Replace the default purple Vite lightning-bolt favicon in the Gregorian Chant Editor browser tab with a distinctive chant-themed icon.

## Design direction

- Prefer a **stylized Gregorian C-clef**, taking visual cues from the application's accepted C-clef engraving rather than inventing an unrelated modern treble clef.
- Simplify or thicken the silhouette as needed for legibility at **16×16 and 32×32** favicon sizes. Do **not** alter the editor's actual C-clef engraving.
- If the C-clef remains illegible at favicon size, a **single simple neume** is an acceptable alternative; briefly explain the choice in the PR.
- Keep it recognizable, high contrast, and suited to both light and dark browser tab surfaces. No tiny text or distracting decorations.

## Implementation

1. Inspect the current `public/favicon.svg`, `index.html`, `vite.config.ts`, and the existing C-clef engraving geometry to understand the current asset and approved notation shape.
2. Replace `public/favicon.svg` with a self-contained SVG favicon. Preserve the existing favicon URL/reference and support the GitHub Pages `/gregorian-chant-editor/` base path.
3. Keep the change narrowly scoped to favicon artwork and any necessary associated asset details. Do not redesign the app, add dependencies, or change notation behavior.
4. Verify the favicon at actual 16px and 32px sizes, and inspect it against light and dark tab-like backgrounds if practical. Include visual evidence in the PR (embedded images or attached captures, not merely local `/tmp` paths).

## Verification and acceptance

- Run the repository's normal checks (`npm run format:check`, `npm run lint`, `npm test`, `npm run build`).
- Verify the production build's favicon URL resolves correctly beneath the project subpath; run a local preview/browser smoke check when practical.
- Confirm no default Vite lightning-bolt graphic remains in the favicon.
- State what was actually tested, along with any unverified conditions (such as live browser cache behavior after deployment).

## Delivery

Read `AGENTS.md`, `docs/ai-workflow.md`, and relevant repository docs. Implement on this branch, commit, open a PR against `master`, and **do not merge**. Report the chosen glyph, small-size legibility, tests, and screenshots. The one-off task plan may be removed during PR closeout once the change is implemented and reviewed.

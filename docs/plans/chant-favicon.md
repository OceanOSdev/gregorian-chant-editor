# Plan: Replace the Vite favicon with a chant-themed Torculus

Branch: `chore/chant-favicon`
Target: `master`
Existing PR: #57

## Goal

Use a **stylized Gregorian Torculus** for the Gregorian Chant Editor's browser-tab favicon. The current C-clef proposal reads too much like a cell phone at small sizes, so the owner has chosen the Torculus instead.

## Agreed design

- Use the app's **existing Torculus engraving** as the reference: three square-notation noteheads forming a recognizable rise-and-fall neume, with the appropriate relationships/connectors. Do not substitute three generic floating boxes or a bar-chart-looking symbol.
- Favor a **dark, nearly black Torculus silhouette on a transparent background**. Remove the current rounded-square tile, frame, and C-clef.
- Simplify proportions only enough to remain recognizable at **16×16 and 32×32**. Give the neume reasonable breathing room and avoid tiny details or text.
- Evaluate legibility on both light and dark browser-tab backgrounds. If the black-on-transparent version is hard to see against dark tabs, explore a minimally invasive contrast treatment (without reverting to an opaque rounded phone-like tile), and explain the tradeoff for owner review.
- This is *favicon artwork only*. Do not alter the editor's semantic notation or its approved Torculus engraving.

## Implementation

1. Inspect `public/favicon.svg`, `index.html`, `vite.config.ts`, and the existing Torculus engraving geometry and approved references.
2. Replace `public/favicon.svg` with a self-contained SVG favicon. Keep its existing URL/reference working under GitHub Pages `/gregorian-chant-editor/`.
3. Keep this an otherwise narrow change: no unrelated UI, architecture, notation behavior, or new dependencies.
4. Render and visibly compare the icon at actual **16px and 32px**, on light and dark tab-like backgrounds. Provide viewable image evidence in **PR #57**; do not rely solely on local `/tmp` image paths.

## Verification and acceptance

- Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`.
- Check the built favicon's project subpath and perform a production-preview browser smoke test if practical.
- Confirm that the new favicon contains neither the default Vite glyph nor the old C-clef/rounded tile.
- Report what was actually verified and what remains untested, including the browser's live favicon cache behavior.

## Delivery

Read `AGENTS.md`, `docs/ai-workflow.md`, and relevant repository guides. Implement on the **existing** `chore/chant-favicon` branch and update **PR #57**, rather than opening a second PR. Commit changes, update the PR description and screenshots, and **do not merge**. Stop for a material ambiguity or contract conflict. After review, remove this one-off task plan at PR closeout as agreed.

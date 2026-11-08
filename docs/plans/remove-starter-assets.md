# Plan: Remove unused starter assets and refresh published-site README

Branch: `chore/remove-starter-assets`
Target: `master`

## Goal

Remove leftover starter/template artwork that no longer contributes to the Gregorian Chant Editor and make the README accurately describe the now-deployed GitHub Pages site. This is a narrowly scoped housekeeping change, not a feature or refactor.

## Agreed scope

1. Check that these four candidate assets have no live references (application, build configuration, HTML/CSS, test fixtures or verification tooling) before deleting:
   - `src/assets/react.svg`
   - `src/assets/vite.svg`
   - `src/assets/hero.png`
   - `public/icons.svg`
     Delete only assets that are demonstrably unused. If a candidate is still used, retain it and report why.
2. Update the **Public preview and deployment** section of `README.md` to reflect the **successfully deployed** website at `https://oceanosdev.github.io/gregorian-chant-editor/`. Remove stale wording that describes it merely as an "intended" URL or suggests that publishing has not happened yet. Preserve accurate, useful setup/recovery instructions for future maintainers.
3. Keep the explicit warning that the app is experimental and **edits are lost on refresh**. Keep the GitHub Pages deployment details correct: pushes to `master` deploy automatically after verification, eligible PRs run CI but do not publish, and local production preview uses the repository subpath.

## Scope exclusions

- Do **not** remove the now-approved Torculus `public/favicon.svg`.
- Do not change editor behavior, styles, engraving, UI, app architecture, package versions, deployment workflow, or CI policies.
- Do not rename the application or alter the GitHub Pages URL.
- No new dependencies or ADR.

## Verification

- Search for all references to the four files before deletion, including static asset URLs and references from documentation or verification fixtures where relevant.
- Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`, and report the actual results.
- Inspect the `dist/` output and, if practical, smoke-check local production preview for the page, favicon, and editor controls. Ensure no new broken asset references.
- Keep the PR narrowly scoped and report anything retained because of actual usage.

## Delivery

Read `AGENTS.md`, `docs/ai-workflow.md`, and `docs/testing.md`. Implement on the named branch, commit, and open a PR against `master`. Do not merge. In the PR, summarize removed assets, README wording changes, and verification results. After review, remove this one-off plan during normal PR closeout, preserving durable information in the README and Git history.

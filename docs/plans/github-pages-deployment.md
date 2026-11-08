# Plan: Deploy the chant editor to GitHub Pages

Branch: `chore/github-pages-deployment`
Target: `master`

## Problem and user-visible goal

Publish the existing browser-only Gregorian Chant Editor at the GitHub Pages project URL:

`https://oceanosdev.github.io/gregorian-chant-editor/`

Merging into `master` should automatically deploy the current production build. Keep this a small deployment milestone, not a feature launch.

## Agreed decisions

- Use **GitHub Pages**, not Cloudflare or another hosting provider.
- Deploy the existing React/TypeScript/Vite client as a **static site**, with **GitHub Actions** as the Pages publishing source.
- Publish from `master` after merge; do not deploy PR branches or require a `gh-pages` branch.
- Treat the public site as an **experimental preview**. The editor currently starts from `exampleDocument`, and there is **no persistence**; refreshing loses changes. Do not suggest otherwise.
- Preserve the established PR checks and branch protection; deployment is additional to existing CI.
- No ADR is expected: this should not change semantic/editor architecture.

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/testing.md`, and the existing `.github/workflows/ci.yml` before implementation.

## Implementation scope

1. Configure Vite's production asset base for the GitHub Pages project path `/gregorian-chant-editor/` without breaking the ordinary local development experience. Review `index.html` and any other public/absolute asset paths (including the favicon) so resources resolve under the project subpath.
2. Add a focused Pages deployment workflow under `.github/workflows/` that runs on pushes to `master` (optionally `workflow_dispatch`). It should:
   - Check out source, use the Node version from `.nvmrc`, run `npm ci`, then `npm run build`.
   - Upload the generated `dist/` directory as the Pages artifact and deploy with the official GitHub Pages actions.
   - Use the `github-pages` environment and required minimal permissions (`contents: read`, `pages: write`, `id-token: write`).
   - Avoid secrets, third-party hosting dependencies, direct pushes to `master`, or deployment on pull requests. Use current, supported action versions.
3. Replace the placeholder browser-tab title with `Gregorian Chant Editor`. Ensure the favicon URL works when hosted under the project path; keep any branding change modest and avoid making artwork a prerequisite.
4. Clearly signal that this is an experimental preview and **edits are lost on refresh**, with a short, unobtrusive notice in the app (or another equally visible user-facing location). Do not build persistence in this PR.
5. Document the public URL, deployment behavior, limitations, and the **one-time owner action** in the README or an appropriate short deployment guide: Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. If that action occurs after merging, explain how to rerun or manually trigger the deployment. Document that Pages must be enabled by the owner; a workflow commit alone does not establish that the public site is live.

## Scope exclusions

- No persistence, save/load, GABC export, accounts, backend, database, analytics, custom domain, or UI redesign.
- No editor behavior/engraving changes, test framework changes, or changes to existing required CI checks unless strictly necessary for deployment.
- Do not automatically enable Pages or modify repository settings in this PR; the owner handles that in GitHub.

## Acceptance criteria and verification

- `npm run format:check`, `npm run lint`, `npm test`, and `npm run build` pass, with actual results reported.
- Inspect the built `dist/index.html` and its referenced assets to confirm that JS/CSS/favicon URLs resolve under `/gregorian-chant-editor/` (not just at the domain root); test the local production preview as appropriate.
- Once the owner enables Pages and the workflow runs on `master`, verify the actual public URL opens successfully, loads all assets without 404s, and supports a basic editor interaction in Firefox and Chromium. Record live-site checks as **pending owner deployment** if the URL is not yet live; do not claim them passed before testing.
- New merges to `master` trigger another deployment. Pull requests continue to use existing CI and do not publish.
- Confirm the user-facing experimental/no-persistence notice and clear page title.

Reference guidance:
- https://vite.dev/guide/static-deploy
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Delivery

Implement on this branch, commit the changes, and open a PR against `master`. Include changed-file summary, verification results, deployment-setting steps for the owner, and checks that remain pending until Pages is enabled and the site is live. Stop and report options if repository policy or unexpected configuration prevents Pages deployment. **Do not merge.**

At PR closeout, remove this one-off task plan unless its continued presence provides clear documentation value; keep the durable deployment instructions in the README or an appropriate guide.

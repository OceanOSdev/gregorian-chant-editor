# Gregorian Chant Editor

Gregorian Chant Editor is an experimental browser-based graphical editor for
four-line Gregorian chant notation. It uses React, TypeScript, Vite, and SVG,
and currently focuses on a narrow modern square-notation profile.

The project is a working architectural and interaction foundation, not a
replacement for mature chant engraving software. Its internal formats and
interface may still change.

## Public preview and deployment

The intended public URL is
[Gregorian Chant Editor](https://oceanosdev.github.io/gregorian-chant-editor/).
This is an experimental preview starting from an example score. There is no
persistence: **edits are lost on refresh**.

The owner must enable Pages once in repository **Settings → Pages → Build and
deployment → Source: GitHub Actions**. The workflow commit alone does not make
the site live. Each push to `master` runs the Pages workflow, which installs
locked dependencies using the Node version in `.nvmrc`, checks formatting,
linting and tests, and builds `dist/`. A separate deployment job publishes the
verified artifact through the `github-pages` environment. Eligible pull requests
run the existing [CI checks](docs/testing.md#continuous-integration) and do not
publish. No `gh-pages` branch or user-managed deployment secrets are needed.

To deploy after enabling Pages, open **Actions → Deploy to GitHub Pages → Run
workflow**, select `master`, and run it (or rerun the failed deployment). Manual
runs on other branches cannot deploy. Confirm the workflow succeeds, then check
the public URL in Firefox and Chromium for asset errors and a basic editor edit.
Availability depends on Pages being enabled and a successful deployment; this
documentation does not establish that the site is live.

For a local production check, run `npm run build` and `npm run preview`, then
open `http://localhost:4173/gregorian-chant-editor/`. Production assets use this
project subpath; ordinary `npm run dev` continues to serve at `/`.

This setup follows the [Vite deployment guide](https://vite.dev/guide/static-deploy)
and [GitHub Pages source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Current capabilities

The editor currently supports:

- semantic lyric syllables anchored to independent ordered neumes;
- Punctum, Podatus, Clivis, Scandicus, Torculus, Climacus, and Porrectus neumes;
- note selection and whole-neume selection with pointer or keyboard controls;
- vertical movement of an individual note or a complete neume;
- individual-note deletion with neume normalization, and whole-neume deletion;
- continuous lyric entry with underscore skipping and independent neume insertion;
- graphical placement with a caret and local ghost preview on any rendered system;
- independent music insertion with stable lyric anchors;
- immutable semantic edits with atomic undo and redo;
- measured, whole-neume automatic wrapping across multiple systems;
- stable semantic identity when notation reflows;
- repeated four-line staffs and C/F clefs in a responsive SVG with dynamic height;
- accessible note controls and score summaries.

There is no explicit global semantic creation cap. That is not a performance
guarantee: practical browser and memory limits still apply.

## Current limitations

- The seven initial neumes use the approved project square-notation engraving.
  Initial C/do and F/fa clefs have editable type/line and preserve melody.
  Engraving is not complete publication-quality chant typography.
- Only Punctum, Podatus, Clivis, Scandicus, Torculus, Climacus, and Porrectus are modeled.
- Graphical placement uses fixed pitch contours for those seven kinds.
- Lyrics use measured vowel/manual alignment, collision-aware spacing and
  derived continuation marks. Ambiguous alignment falls back to whole text.
- Four division kinds support graphical placement, selection, kind changes and
  deletion, with explicit neume insertion before or after a division.
- There are no manual system breaks, persistence, GABC import/export, backend,
  or component test environment. Reusable browser verification drivers are
  documented in the [testing guide](docs/testing.md).

See the [roadmap](docs/roadmap.md) for non-binding possibilities and a fuller
account of current limits.

## Architecture

The editor preserves this flow:

```text
ChantDocument
    ↓
pure semantic commands
    ↓
layoutChant
    ↓
ChantLayout
    ↓
ScoreSvg
```

The semantic document contains musical meaning but no pixels, system
assignments, SVG data, or transient editor state. Layout and system wrapping
are derived. `ChantEditor` coordinates history, tools, selection, drafts,
pointer state, and focus around the pure semantic and layout layers.

Read the [architecture overview](docs/architecture.md) for the subsystem map
and boundaries.

## Project structure

Editor code is organized by responsibility under `src/editor/`:

- `domain/` — semantic document types, neume invariants, and lookup helpers;
- `commands/` — immutable semantic transformations and insertion resolvers;
- `state/` — document history, selection, and editor tools;
- `interaction/` — pure graphical-placement and focus resolvers;
- `layout/` — score layout, engraving geometry, wrapping, and previews;
- `rendering/` — SVG rendering and accessibility descriptions;
- `components/` — editor orchestration and controls.

Application entry points and global styles live directly under `src/`.

## Documentation

- [Architecture](docs/architecture.md)
- [Domain model](docs/domain-model.md)
- [Layout and rendering](docs/layout-and-rendering.md)
- [Editor interactions](docs/editor-interactions.md)
- [Commands and history](docs/commands-and-history.md)
- [Testing](docs/testing.md)
- [Glossary](docs/glossary.md)
- [Roadmap and limitations](docs/roadmap.md)
- [Architecture decision log](docs/adrs/README.md)

The [MVP document](docs/mvp.md) is retained as a historical record of the
original first milestone, not as the current capability reference.

## Getting started

Use the Node.js version declared in `.nvmrc`. Contributors using nvm can select
it with `nvm use`.

```bash
git clone git@github.com:OceanOSdev/gregorian-chant-editor.git
cd gregorian-chant-editor
nvm use
npm ci
npm run dev
```

Vite prints the local development-server URL after startup.

The repository also provides self-documenting Make targets as convenient
aliases for the npm scripts. Run `make` or `make help` to list them, and use
targets such as `make dev`, `make test`, or `make check`. The npm scripts remain
the underlying developer commands and can always be run directly.

## Available scripts

| Command                | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | Start the Vite development server with hot module replacement |
| `npm run build`        | Run TypeScript project checks and create a production build   |
| `npm run format`       | Apply Prettier formatting across the repository               |
| `npm run format:check` | Check formatting without changing files                       |
| `npm run lint`         | Check source files with Oxlint                                |
| `npm test`             | Run the Vitest suite once                                     |
| `npm run test:watch`   | Run Vitest in watch mode                                      |
| `npm run preview`      | Serve the production build locally                            |

## Contributing

Read [AGENTS.md](AGENTS.md) and the guide that owns the subsystem before making
architectural changes. For a branch-and-plan handoff between ChatGPT and local
Codex, follow the [AI collaboration workflow](docs/ai-workflow.md). Run:

```bash
npm run format:check
npm run lint
npm test
npm run build
```

Eligible pull requests run the same verification sequence in CI; Markdown-only
changes skip it. See the
[testing guide](docs/testing.md) for authoritative setup, verification, CI,
test-seam, and manual-browser guidance.

# Gregorian Chant Editor

Gregorian Chant Editor is an experimental browser-based graphical editor for
four-line Gregorian chant notation. It uses React, TypeScript, Vite, and SVG,
and currently focuses on a narrow modern square-notation profile.

The project is a working architectural and interaction foundation, not a
replacement for mature chant engraving software. Its internal formats and
interface may still change.

## Current capabilities

The editor currently supports:

- semantic lyric syllables associated with ordered neumes;
- Punctum, Podatus, Clivis, and Scandicus neumes;
- note selection and whole-neume selection with pointer or keyboard controls;
- vertical movement of an individual note or a complete neume;
- individual-note deletion with neume normalization, and whole-neume deletion;
- lyric editing plus neume insertion from toolbar controls;
- graphical placement with a post-reflow preview on any rendered system;
- active-syllable insertion constraints that preserve semantic ordering;
- immutable semantic edits with atomic undo and redo;
- measured, whole-neume automatic wrapping across multiple systems;
- stable semantic identity when notation reflows;
- repeated four-line staffs and C clefs in a responsive SVG with dynamic height;
- accessible note controls and score summaries.

There is no explicit global semantic creation cap. That is not a performance
guarantee: practical browser and memory limits still apply.

## Current limitations

- The noteheads, connectors, and C clef are placeholder engraving rather than
  publication-quality chant typography.
- Only Punctum, Podatus, Clivis, and Scandicus are modeled.
- Graphical placement uses fixed pitch contours for those four kinds.
- Lyric rendering centers the complete text string; it has no vowel-aware
  alignment, automatic hyphenation, collision avoidance, word-spacing logic,
  or continuation marks.
- There are no manual system breaks, persistence, GABC import/export, backend,
  or browser/component automation tests.

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
- [Architecture decisions](docs/decisions/001-separate-semantic-and-derived-state.md)

The [MVP document](docs/mvp.md) is retained as a historical record of the
original first milestone, not as the current capability reference.

## Getting started

```bash
git clone git@github.com:OceanOSdev/gregorian-chant-editor.git
cd gregorian-chant-editor
npm install
npm run dev
```

Vite prints the local development-server URL after startup.

## Available scripts

| Command              | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `npm run dev`        | Start the Vite development server with hot module replacement |
| `npm run build`      | Run TypeScript project checks and create a production build   |
| `npm run lint`       | Check source files with Oxlint                                |
| `npm test`           | Run the Vitest suite once                                     |
| `npm run test:watch` | Run Vitest in watch mode                                      |
| `npm run preview`    | Serve the production build locally                            |

## Contributing

Read [AGENTS.md](AGENTS.md) and the guide that owns the subsystem before making
architectural changes. Run:

```bash
npm test
npm run lint
npm run build
```

See the [testing guide](docs/testing.md) for test seams and manual browser
checks.

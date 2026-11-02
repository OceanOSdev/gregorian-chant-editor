# Gregorian Chant Editor

Gregorian Chant Editor is an experimental browser-based graphical editor for
four-line Gregorian chant notation. It uses React, TypeScript, Vite, and SVG,
and currently focuses on a narrow modern square-notation profile.

This `one-shot-test` branch is an autonomous implementation probe, presented as
**Scriptorium**. It explores a complete local composing workflow without committing
the main project to its design choices. Its formats and interface may still change;
it is not a replacement for mature chant engraving software. See the
[probe plan](docs/plans/one-shot-test.md) and [limitations](docs/roadmap.md).

## Current capabilities

The editor currently supports:

- semantic lyric syllables anchored to independent ordered neumes;
- Punctum, Podatus, Clivis, Scandicus, Torculus, Climacus, and Porrectus neumes;
- note selection and whole-neume selection with pointer or keyboard controls;
- vertical movement of an individual note or a complete neume;
- individual-note deletion with neume normalization, and whole-neume deletion;
- continuous lyric entry with underscore skipping and independent neume insertion;
- graphical placement with a local ghost and semantic insertion caret on any rendered system;
- independent music insertion with stable lyric anchors;
- immutable semantic edits with atomic undo and redo;
- measured, whole-neume automatic wrapping across multiple systems;
- stable semantic identity when notation reflows;
- repeated four-line staffs and C clefs in a responsive SVG with dynamic height;
- accessible note controls and score summaries;
- new and example chants, editable titles and C-clef lines, and score zoom;
- versioned chant JSON files with validated open/save and browser recovery;
- strict GABC interchange for the supported notation subset;
- clean SVG downloads and browser printing between complete systems;
- measured vowel alignment and optional manual grapheme segments;
- experimental lyric-aware spacing, word gaps and continuation hyphens;
- browser playback with Play/Pause/Stop, tempo, volume, octave and note following.

There is no explicit global semantic creation cap. File size, collection and
pitch limits apply at persistence boundaries; see
[persistence and interchange](docs/persistence-and-interchange.md). Practical
browser and memory limits also apply.

## Using the probe

Choose a neume tool, then click a pitch on the staff to add music. Use Select to
change individual pitches or whole neumes, and Lyrics to enter syllables:
`-` continues a word, Space starts a word and `_` skips a neume. The Keyboard help
panel explains focus and editing controls.

**Save chant** downloads a lossless `.chant.json` file. The current semantic score
is also saved in this browser after edits; lyric drafts and undo history are not.
**Open file** accepts chant JSON or the documented GABC subset. **Export & print**
provides GABC, passive SVG and browser printing. Finish or cancel lyric drafts
before saving or exporting. Use downloaded files to keep work outside this browser.

Use **Play** to hear the score as an organ-like tone, with equal-duration notes.
Playback starts only from an explicit user gesture. Tempo, volume and octave
controls affect listening; they do not rewrite notation. The moving note highlight
and optional Follow behavior are independent of selection. See
[experimental playback](docs/playback.md) for behavior and limits.

The app enables **Lyric-aware spacing** by default. Turn it off to compare with
the accepted music-only layout. The experiment remains a separate layout policy;
[ADR 0010](docs/adrs/0010-experiment-with-lyric-aware-layout.md) is Proposed.

## Current limitations

- The musical vocabulary is the seven listed neumes and one document-wide C clef.
  Bars, accidentals, ornaments, clef changes, other neume types and other notation
  traditions are not modeled. Graphical entry starts from fixed contours.
- Engraving and lyric spacing are experimental, not publication-quality typography.
  Font substitution can alter alignment and wrapping. There is no automatic
  linguistic syllabification or comprehensive pronunciation model.
- GABC support is deliberately narrow and rejects unsupported notation. It does
  not retain semantic IDs or manual lyric alignment; chant JSON is the lossless format.
- There are no authored system/page breaks, backend, accounts, cloud storage,
  collaboration. Browser recovery is one local copy, not a library.
- Playback is a simple equal-note listening aid, without vocals or chant-rhythm
  interpretation; it is not a complete musical performance engine.
- Browser printing can paginate between systems; oversized content is fitted to
  the available page width. There is no dedicated PDF engraving/export engine.
- Vitest remains a plain TypeScript suite. Separate Chromium checks exercise real
  interactions; Firefox and spoken assistive-technology acceptance remain separate.

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
- `rendering/` — interactive SVG, passive print rendering and accessibility descriptions;
- `persistence/` — versioned JSON parsing, serialization and runtime validation;
- `interchange/` — strict GABC import/export around the semantic document;
- `playback/` — derived equal-note performances and browser audio, outside semantic history;
- `components/` — editor orchestration and controls.

Application entry points and global styles live directly under `src/`.
`src/app/` owns the specimen, browser recovery startup and file-download/SVG adapters.

## Documentation

- [Architecture](docs/architecture.md)
- [Domain model](docs/domain-model.md)
- [Persistence and interchange](docs/persistence-and-interchange.md)
- [Layout and rendering](docs/layout-and-rendering.md)
- [Experimental playback](docs/playback.md)
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

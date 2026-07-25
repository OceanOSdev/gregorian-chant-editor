# Gregorian Chant Editor

Gregorian Chant Editor is an experimental browser-based graphical editor for
four-line Gregorian chant notation. It is built with React, TypeScript, Vite,
and SVG.

The project is at an early stage. It demonstrates a small, working editing
flow, but it is not yet a complete replacement for mature chant engraving
tools.

## Current capabilities

The editor currently supports:

- Rendering a crisp, scalable four-line staff in SVG
- Rendering a placeholder C clef, puncta, and linked lyric syllables
- Selecting puncta with a pointer or keyboard
- Moving a selected punctum vertically by one staff step with Arrow Up or
  Arrow Down
- Deleting a selected punctum with Delete or Backspace
- Adding puncta with an editor control
- Placing puncta graphically by clicking a valid staff position
- Editing the lyric syllable linked to a selected note
- Undoing and redoing semantic document edits
- Keyboard-accessible note selection and editing controls

The current notation and engraving model is intentionally narrow:

- The clef and punctum use placeholder glyphs rather than finished chant
  typography.
- The score is a fixed-width, single system with a limited note capacity.
- Only puncta are modeled; the broader Gregorian neume vocabulary is not
  supported.
- There is no automatic line or system wrapping.
- There is no GABC import or export.
- Documents are not persisted, and there is no backend.

## Screenshot

<!-- Add an editor screenshot here when a stable screenshot is available. -->

## Architecture

The editor preserves this flow:

```text
semantic chant document → pure layout data → React/SVG rendering
```

The semantic document describes the score without SVG pixel coordinates.
Note height is represented as a discrete staff-relative position. A pure
layout function converts those musical positions into rendering coordinates,
and React renders the resulting layout as SVG.

Selection, active tools, and other interface state remain separate from the
semantic document. Document changes are immutable TypeScript transformations
and are recorded as semantic snapshots for undo and redo.

## Project structure

Editor code is organized by responsibility under `src/editor/`:

- `domain/` — semantic chant document types and example data
- `commands/` — immutable note and lyric transformations
- `layout/` — pure score layout and graphical placement calculations
- `rendering/` — React and SVG score rendering
- `components/` — editor-level React composition and controls
- `state/` — selection, tools, and document history

Application entry points and global styles live directly under `src/`.

## Getting started

```bash
git clone git@github.com:OceanOSdev/gregorian-chant-editor.git
cd gregorian-chant-editor
npm install
npm run dev
```

Vite prints the local development-server URL after startup.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot module replacement |
| `npm run build` | Run TypeScript project checks and create a production build |
| `npm run lint` | Check source files with Oxlint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run preview` | Serve the production build locally |

## Testing

Vitest covers plain TypeScript command, document-history, selection, and
layout behavior.

```bash
npm test
```

The current test setup does not include browser or component testing.

## Roadmap

Prospective near-term work includes:

- Multiple ordered lyric syllables with an explicit insertion target
- Broader neume support and improved chant glyph rendering
- More capable spacing and engraving
- Automatic system wrapping
- GABC import and export
- Local document persistence
- Printable or exportable output

These items are directional rather than committed release promises.

## Development status

Gregorian Chant Editor is under active development. Its internal document
format, architecture, engraving behavior, and user interface may change.

## Contributing

Please open an issue before undertaking major architectural work. Keep
semantic modeling, layout, rendering, and interaction concerns separate, and
run the following checks before submitting changes:

```bash
npm test
npm run lint
npm run build
```

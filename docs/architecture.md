# Architecture

## Scope

This document is the authoritative overview of the editor's layers, data flow,
and module ownership. Detailed contracts live in the linked topical guides and
architecture decision records.

## Related documents

- [Domain model](domain-model.md)
- [Commands and history](commands-and-history.md)
- [Layout and rendering](layout-and-rendering.md)
- [Editor interactions](editor-interactions.md)
- [Testing](testing.md)
- [Glossary](glossary.md)
- [Architecture decisions](adrs/README.md)

## Primary data flow

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

`ChantDocument` is the canonical score representation. Commands produce new
semantic documents without mutation. `layoutChant` derives positioned,
renderable data, including automatic system assignment. `ScoreSvg` renders
that data and delegates semantic edits back to editor callbacks.

`ChantEditor` orchestrates the pipeline. It owns document history and
transient interface state, calls commands and interaction resolvers, derives a
fresh layout from the current document, and passes layout plus callbacks to the
renderer. Neither the React tree nor the SVG is authoritative musical state.

## Responsibility boundaries

| Layer                  | Owns                                                                                      | Does not own                               |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| Semantic domain        | Title, C clef, lyric syllables, ordered neumes, nested notes, stable IDs, `StaffPosition` | Pixels, systems, rendering, editor state   |
| Pure commands          | Validation and immutable semantic transitions                                             | UI state, layout, browser events           |
| Document history       | Past, present, and future semantic documents                                              | Selection, tools, focus, hover, drafts     |
| Transient editor state | Active syllable, selection, tool, hover point, lyric draft, pending focus                 | Canonical notation or engraving geometry   |
| Interaction resolvers  | Pure conversion from semantic/layout context and input points to valid insertion intent   | DOM event handling or semantic ID creation |
| Derived layout         | Systems, wrapping, absolute geometry, bounds, connectors, lyrics, score dimensions        | Authoritative musical meaning              |
| SVG rendering          | Visual elements, accessible controls/descriptions, pointer and keyboard event surfaces    | Canonical score data                       |
| Browser state          | Actual DOM focus, pointer coordinates, event propagation                                  | Persisted or undoable notation             |

The semantic document deliberately excludes pixels, SVG geometry, systems,
automatic wrapping assignments, React or DOM objects, selection, active tools,
hover points, previews, browser focus, history stacks, and drafts. Keeping
these values outside the document prevents viewport and interaction details
from entering semantic history.

See [ADR 0002](adrs/0002-separate-semantic-and-derived-state.md) for the
durable separation decision.

## Module map

### `src/editor/domain/`

Defines `ChantDocument`, semantic entities, `StaffPosition`, supported neume
kinds, validation, normalization, counting, and stable-ID lookup. See the
[domain model](domain-model.md).

### `src/editor/commands/`

Contains immutable transformations for lyrics, insertion, movement, and
deletion. It also contains resolvers that select valid semantic insertion
boundaries. See [commands and history](commands-and-history.md).

### `src/editor/state/`

Contains semantic document history and transient, ID-based selection and tool
types. History and transient editor state remain separate.

### `src/editor/interaction/`

Contains pure bridges between tools, rendered systems, pointer positions, and
semantic insertion intent. It also validates stable focus targets after
document changes. See [editor interactions](editor-interactions.md).

### `src/editor/layout/`

Converts a semantic document into `ChantLayout`. It owns engraving geometry,
whole-neume wrapping, repeated systems, lyric alignment, graphical snapping,
and hypothetical post-insertion preview layout. See
[layout and rendering](layout-and-rendering.md).

### `src/editor/rendering/`

Renders layout data as accessible SVG. It uses semantic IDs copied into layout
for keys, selection, and focus, but it does not store musical state.

### `src/editor/components/`

`ChantEditor` coordinates React state, semantic commands, history navigation,
layout, resolvers, focus requests, and controls. Component state is not a
second score model.

## Why the boundaries matter

Pure domain, command, layout, state, and interaction seams can be tested
without a browser. Reflow can change systems and coordinates without changing
semantic identity. Undo and redo can restore complete musical actions without
also reverting hover, focus, or tool state. Rendering can evolve without
changing the document format.

Stable identity is covered by
[ADR 0003](adrs/0003-use-stable-semantic-identities.md), explicit neume types
by [ADR 0004](adrs/0004-use-explicit-neume-types-and-ordered-tuples.md), and
wrapping by
[ADR 0005](adrs/0005-derive-wrapping-from-rendered-geometry.md).

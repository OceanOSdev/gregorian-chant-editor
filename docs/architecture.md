# Architecture

## Scope

This document is the authoritative overview of the editor's layers, data flow,
and module ownership. Detailed contracts live in the linked topical guides and
architecture decision records.

## Related documents

- [Domain model](domain-model.md)
- [Persistence and interchange](persistence-and-interchange.md)
- [Commands and history](commands-and-history.md)
- [Layout and rendering](layout-and-rendering.md)
- [Editor interactions](editor-interactions.md)
- [Experimental playback](playback.md)
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

| Layer                   | Owns                                                                                      | Does not own                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Semantic domain         | Title, C clef, lyric syllables, ordered neumes, nested notes, stable IDs, `StaffPosition` | Pixels, systems, rendering, editor state       |
| Pure commands           | Validation and immutable semantic transitions                                             | UI state, layout, browser events               |
| Document history        | Past, present, and future semantic documents                                              | Selection, tools, focus, hover, drafts         |
| Transient editor state  | Selection, tool, hover point, lyric mode/draft, history prompt, pending focus             | Canonical notation or engraving geometry       |
| Interaction resolvers   | Pure conversion from semantic/layout context and input points to valid insertion intent   | DOM event handling or semantic ID creation     |
| Derived layout          | Systems, wrapping, absolute geometry, bounds, connectors, lyrics, score dimensions        | Authoritative musical meaning                  |
| SVG rendering           | Visual elements, accessible controls/descriptions, pointer and keyboard event surfaces    | Canonical score data                           |
| Persistence adapters    | Validated versioned files and conversion to/from semantic data                            | Authoritative layout or transient editor state |
| Playback interpretation | Derived note events, pitch/frequency and equal-note timing                                | Persistent rhythm or semantic edits            |
| Browser state           | Actual DOM focus, pointer coordinates, event propagation                                  | Persisted or undoable notation                 |

The semantic document deliberately excludes pixels, SVG geometry, systems,
automatic wrapping assignments, React or DOM objects, selection, active tools,
hover points, previews, browser focus, history stacks, drafts, audio resources and
playback timing. Keeping these values outside the document prevents viewport and interaction details
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
types. The pure editor-session reducer coordinates commands, lyric-draft
reconciliation, placement lifecycle, ID-based focus requests, and event
notifications. Its history field contains semantic snapshots only; tools,
remembered neume kind, hover, selection, focus, and announcements remain outside history.

### `src/editor/interaction/`

Contains pure bridges between tools, rendered systems, pointer positions, and
semantic insertion intent. It also validates stable focus targets after
document changes. See [editor interactions](editor-interactions.md).

### `src/editor/layout/`

Converts a semantic document into `ChantLayout`. It owns engraving geometry,
whole-neume wrapping, repeated systems, lyric alignment, graphical snapping,
and local insertion preview geometry. See
[layout and rendering](layout-and-rendering.md).

### `src/editor/playback/`

Owns the pure `createPerformance` interpretation and browser audio transport.
The current engine derives equal-duration events directly from semantic note
order and C-clef pitch. Sound scheduling and playhead state stay outside semantic
history and layout. `ChantEditor` supplies the current score and uses stable note
IDs for a separate playback highlight. See [experimental playback](playback.md)
for the interpretation contract, controls, resource lifecycle and limits.

### `src/editor/persistence/` and `src/editor/interchange/`

`persistence/chant-file.ts` validates untyped file data and serializes a versioned
semantic envelope. `interchange/gabc.ts` maps a strict external notation subset
into and out of `ChantDocument`; GABC is never the canonical score model. See
[persistence and interchange](persistence-and-interchange.md) for formats, limits,
identity behavior and browser recovery.

### `src/app/`

Owns the initial specimen, recovery loading and browser download/SVG export
adapters. `App` chooses the initial document once; `ChantEditor` continues to own
the live semantic history. Browser storage and downloads do not create a second
editable score representation.

### `src/editor/rendering/`

Renders layout data as accessible SVG. It uses semantic IDs copied into layout
for keys, selection, and focus, but it does not store musical state. `PrintScore`
renders passive systems from the same layout for browser pagination.

### `src/editor/components/`

`ChantEditor` coordinates React state, semantic commands, history navigation,
layout, resolvers, focus requests, and controls. Component state is not a
second score model. `DocumentControls` coordinates metadata, guarded document
replacement, file workflows and browser-save status. Replacement is an explicit
session reset, while title, clef and lyric-preference edits enter semantic history.

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

The lyric anchor relationship is defined in [ADR 0008](adrs/0008-anchor-lyrics-to-neumes.md). Music insertion does not require an active syllable.

`state/lyric-entry.ts` owns pure lyric transitions (insert/edit intent, draft
commit/navigation, occupied/end states and stale-target recovery). The session
reducer applies each accepted semantic result once to history and reconciles focus.
There is no second component-owned draft or active-syllable insertion target.

Temporary lyric-anchor reassignment also belongs to the session reducer, including
its preview ID and preceding resolved Lyrics context. Its legal destinations are
derived from the existing pure reassignment command. This implements ADRs 0002
and 0008 without changing semantic data, history structure or engraving ownership;
no new ADR is needed.

## Experimental layout policy

The probe app requests `layoutChant(document, measure, { lyricSpacing: true })`.
The option adds measured lyric clearances and derived hyphens, and can expand
vertical bands and the score viewBox. It is transient presentation policy, not
semantic data. The default API call and `wrapNeumes` retain the accepted
music-only policy. Graphical commit resolves against the same measurement lookup
and option as the rendered score. See [layout and rendering](layout-and-rendering.md#experimental-lyric-aware-layout)
and the [Proposed ADR 0010](adrs/0010-experiment-with-lyric-aware-layout.md).

## Experimental playback path

The probe also derives a performance directly from `ChantDocument`:

```text
ChantDocument → createPerformance → performance events → browser audio
                                              ↓
                                    presentation-only playhead
```

The score document remains canonical notation. Tempo, octave, volume, transport
state and audio resources are transient session state, not a second editable
score or a persisted timing model. A document edit invalidates the current run.
This exercises [Proposed ADR 0006](adrs/0006-separate-notation-from-playback.md)
without changing that record’s adoption status.

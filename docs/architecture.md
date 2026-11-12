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

| Layer                  | Owns                                                                                                                                     | Does not own                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Semantic domain        | Title, initial C/F clef, lyric syllables, ordered neumes, semantic divisions and clef changes, nested notes, stable IDs, `StaffPosition` | Pixels, systems, rendering, editor state   |
| Pure commands          | Validation and immutable semantic transitions                                                                                            | UI state, layout, browser events           |
| Document history       | Past, present, and future semantic documents                                                                                             | Selection, tools, focus, hover, drafts     |
| Transient editor state | Selection, tool, hover point, lyric mode/draft, history prompt, pending focus                                                            | Canonical notation or engraving geometry   |
| Interaction resolvers  | Pure conversion from semantic/layout context and input points to valid insertion intent                                                  | DOM event handling or semantic ID creation |
| Derived layout         | Systems, wrapping, absolute geometry, bounds, connectors, lyrics, score dimensions                                                       | Authoritative musical meaning              |
| SVG rendering          | Visual elements, accessible controls/descriptions, pointer and keyboard event surfaces                                                   | Canonical score data                       |
| Browser state          | Actual DOM focus, pointer coordinates, event propagation                                                                                 | Persisted or undoable notation             |

The semantic document deliberately excludes pixels, SVG geometry, systems,
automatic wrapping assignments, React or DOM objects, selection, active tools,
hover points, previews, browser focus, history stacks, and drafts. Keeping
these values outside the document prevents viewport and interaction details
from entering semantic history.

See [ADR 0002](adrs/0002-separate-semantic-and-derived-state.md) for the
durable separation decision.

## Module map

### `src/editor/neume-entry-pitches.ts`

Owns the explicit graphical-kind whitelist and pure default entry contours shared
by layout and toolbar insertion. Kind-correlated tuples preserve semantic note
order; snapping, fallback pitches, boundaries, validation and engraving stay with
their existing owners. Layout re-exports the existing public placement types.
This extraction preserves the accepted ADR contracts; no new ADR is needed.

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
and local caret/ghost preview layout. It also derives word-aware compact
spacing and conditional/system-break hyphens under
[Accepted ADR 0011](adrs/0011-word-aware-chant-engraving.md), which narrowly
qualifies but does not replace [ADR 0010](adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md).

`layout-chant.ts` owns canonical score layout and wrapping;
`graphical-placement.ts` owns transient fit, snapping and ghost/caret geometry.
Their shared staff metrics live in `staff-metrics.ts`. The existing public layout
API remains available through re-exports. This preserves the accepted ADRs;
no new decision record is needed.

See [layout and rendering](layout-and-rendering.md).

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
[accepted ADR 0010](adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md).
Stage 4B extends the original whole-neume music-geometry wrapping contract,
now preserved as [superseded ADR 0005](adrs/0005-derive-wrapping-from-rendered-geometry.md),
with measured lyric clearances and lyric-aware system breaks.

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

## Stage 5B graphical divisions

`deriveScoreOrder` orders the independent neume, division and clef-change collections.
The existing measured placement walker reserves following division geometry
before choosing a system break. `DivisionLayout` and explicit `ScoreSlotLayout`
boundaries belong to each derived system; rendering and pointer resolvers consume
that same snapshot. The reducer resolves clicks again against its latest document
and the displayed font snapshot. No second score model or wrapping engine exists.

Division selection and focus use stable division IDs; tools, previews and focus
remain outside semantic history. Stage 5A commands own insertion, deletion and
kind replacement. [Accepted ADR 0013](adrs/0013-divisions-interrupt-word-compaction.md)
adds the owner-approved exception to contextual compaction across divisions.
Musical punctuation never changes semantic lyric relationships.

## Initial clef (Stage 6A)

The document owns one required clef value. `update-clef.ts` performs one
melody-preserving semantic transaction; [Accepted ADR 0014](adrs/0014-preserve-melody-on-initial-clef-edit.md)
records the owner-accepted mapping. `clef-geometry.ts` supplies
font-independent paths and occupied/padded bounds to layout and rendering.
Only the first derived copy is an interactive singleton target. Transient clef
selection/focus uses a `clef` tag without inventing a semantic ID.

Stage 6B adds stable-ID authored changes under Accepted ADR 0015, using the
existing derived-order, measured walker and semantic-history boundaries.
`domain/divisions.ts` owns mixed slots and anchor reconstruction;
`commands/edit-clef-change.ts` owns candidate edits and scoped preservation;
the session owns the transient draft and one-shot confirmation. The renderer
consumes positioned authored clefs and derived, inert custodes. No second score
representation or persisted guide is introduced; ADR 0013 remains division-specific.
See the owning guides for ordering, transaction and engraving contracts.

The owner-approved Stage 6B UX correction adds C/F tools to the existing palette
and the shared pointer/keyboard clef-placement resolver. The existing session
transaction commit path applies direct placement's preselected session policy
synchronously; existing-clef editing retains Apply/Cancel and uses that same
option at Apply. Only deletion retains conditional confirmation.
Keyboard boundaries, previews and persistent tool state
are transient; no semantic fields, event model or new history authority are added.

## Native persistence (Stage 7A)

`src/editor/persistence/` owns the pure versioned codec, guarded browser adapter
and React session integration under [Accepted ADR 0016](adrs/0016-persist-versioned-semantic-chant-documents.md).
The integration invokes the existing pure reducer and synchronously persists
changed committed snapshots before publishing React state. Commands and rendering
remain browser-independent. `DocumentControls` owns file selection/download and
replacement confirmation; there is no new mutable score alongside history.
See [persistence](persistence.md) for format, recovery and compatibility contracts.

## Accidental interpretation boundary

Stage 8D keeps authored accidental entities in the semantic document and derives
register-specific effective pitches in a pure domain resolver. Optional earlier
engraving anchors do not change B-note ownership. Commands own mutation repair;
layout owns measured placement; SVG consumes geometry; persistence validates exact
v5 entities. [ADR 0021](adrs/0021-author-b-accidentals-at-neume-boundaries.md)
owns this decision; no playback or interchange adapter is introduced.

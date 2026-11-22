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
- [Playback](playback.md)
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

Playback is a separate read-only branch from the same document, which also
reads the editor selection once when Play is pressed to choose a starting
note: `ChantDocument (+ selection) → interpretProofreadingPlayback → Performance
→ Web Audio`. Its timing never reads layout or SVG, and it changes neither the
document nor the selection. Rendering reads one playback value, the sounding
note, to draw the cue and follow it; see [playback](playback.md).

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
| Playback               | Pure performance interpretation, audio scheduling and its lifecycle                                                                      | Notation, timing fields, layout, history   |

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

`reduceEditorSession` is the only public transition. It gives each action to
one owner in a fixed order: clipboard, passage selection, accidental placement,
clef transaction, lyric move, pending history, lyric entry and then ordinary
actions. Shared document-change effects follow phases 4–8 only; the passage
resize announcement and stale clipboard feedback follow every phase. The
numbered comment on `reduceEditorSession` is the authoritative map.

To change a transition rule, edit the function for its phase (for example
`resolveClefTransaction`, `reduceLyricMove` or `reduceOrdinaryAction`). An
active mode's early return keeps later phases from running, so moving a phase
changes behavior. `transition-precedence.test.ts` characterizes that order
from reachable states. It cannot distinguish lyric move from pending history,
because starting a move refuses on its own while a prompt is pending.

Ordering is not the only exclusion. Some earlier-phase actions refuse while a
later exclusive mode is active: clipboard and passage extension, the accidental
actions and the clef start, step, policy and placement actions each check the
lyric move, pending history or clef transaction themselves. A new exclusive
mode may therefore need guards in those earlier handlers as well as in its own
phase. Phase 8's `change-clef` and `engraving-edit` still check pending history
and lyric moves, which earlier phases already exclude; removing those redundant
checks is deferred cleanup.

A new action type belongs in the action group of the phase that owns it.
Otherwise it is ordinary and must be handled by `reduceOrdinaryAction`'s
exhaustive switch.

`editor-availability.ts` names the editor shell's presentation-availability
rules: whether a control is shown or enabled in the current session mode (for
example `exclusiveModeActive`, `documentControlsBlocked`,
`pitchHandlingBlocked` and `noteToolbarAllowed`). The rules are intentionally
different, and each comment says why. Change whether a control is enabled
there, not inline in `ChantEditor`. These rules never authorize a transition;
the reducer keeps its own guards. `clipboardBlocked` stays in
`editor-session.ts` because the reducer shares it.
`selected-note-accidental.ts` projects the selected note's written sign,
effective B and its source for the note properties toolbar.

### `src/editor/interaction/`

Contains pure bridges between tools, rendered systems, pointer positions, and
semantic insertion intent. It also validates stable focus targets after
document changes. `editor-shortcuts.ts` classifies keys for `ChantEditor`'s
document and `<main>` listeners, which keep event phase, propagation and
dispatch; see [keyboard event precedence](editor-interactions.md#keyboard-event-precedence).
See [editor interactions](editor-interactions.md).

### `src/editor/layout/`

Converts a semantic document into `ChantLayout`. It owns engraving geometry,
whole-neume wrapping, repeated systems, lyric alignment, graphical snapping,
and local caret/ghost preview layout. It also derives word-aware compact
spacing and conditional/system-break hyphens under
[Accepted ADR 0011](adrs/0011-word-aware-chant-engraving.md), which narrowly
qualifies but does not replace [ADR 0010](adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md).

`layout-chant.ts` is the public layout API and the `layoutChant` orchestrator.
The horizontal walker (wrapping, spacing, lyric clearance, custodes and boundary
events) lives in `horizontal-system-composition.ts`; vertical measurement and
stacking in `system-vertical-layout.ts`; rebuilding at resolved origins,
lyrics, hyphens, hit clips, insertion slots and canvas bounds in
`system-layout-assembly.ts`; public result types in `chant-layout-types.ts`.
`graphical-placement.ts` owns transient fit, snapping and ghost/caret geometry.
Shared staff metrics live in `staff-metrics.ts`. Score-layout consumers import
`layoutChant`, its result types and layout helpers through `layout-chant.ts`;
the phase modules are internal to the layout directory, while lower-level
engraving values (lyric metrics, vertical metrics, neume, clef and division
geometry) are imported from their owning modules where needed; see [layout pipeline ownership](layout-and-rendering.md#layout-pipeline-ownership). This preserves the accepted ADRs;
no new decision record is needed.

See [layout and rendering](layout-and-rendering.md).

### `src/editor/rendering/`

Renders layout data as accessible SVG. It uses semantic IDs copied into layout
for keys, selection, and focus, but it does not store musical state.

The score's interactive SVG is split by ownership (readability M2):

| Module                | Owns                                                                                                                                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScoreSvg.tsx`        | The single SVG root and its pointer/placement/clef-keyboard handlers, coordinate inversion, titles and shared descriptions, unique clip/pattern ID prefix, per-system groups, music clipping, mixed clef/neume/division ordering, staff, custodes, hyphens, previews, and all score focus |
| `NeumeControl.tsx`    | One committed neume's `<g data-neume-id>` subtree: ownership clip, selection/placement/lyric-move decorations, ink, each note button and each written-accidental button, with their click and key rules                                                                                   |
| `LyricControl.tsx`    | One engraved syllable's `<g className="score__lyric-control">`: selection background, focusable text, keyboard-intent resolution and the keyboard-focus cue                                                                                                                               |
| `ClefControl.tsx`     | The initial clef and each clef change's button                                                                                                                                                                                                                                            |
| `DivisionControl.tsx` | Each committed division's button                                                                                                                                                                                                                                                          |
| `NeumeInk.tsx`        | Engraved neume ink and ledgers, shared by committed neumes and previews                                                                                                                                                                                                                   |

Where to change things:

- **Note click or key behavior, accidental placement targets, written
  accidentals**: `NoteControl` and `WrittenAccidentalControl` in
  `NeumeControl.tsx`. Each handler reads top to bottom in precedence order.
- **Lyric click or key behavior**: `LyricControl.tsx`. Key-to-intent mapping
  stays pure in `interaction/lyric-entry-keyboard.ts`.
- **Score focus requests, `focusin` tracking, reveal and restoring focus after
  reflow**: `ScoreSvg.tsx` only. It keeps per-kind maps of mounted note,
  lyric, division and clef-change elements, plus refs for the initial clef and
  the clef preview. Written accidentals have no map: the score finds them with
  a `data-accidental-id` query. Controls register their element through an
  explicit callback (`registerNoteElement`, `registerElement`). They never
  keep their own focus map or call `focus()` for a request. One exception is
  accidental-target arrow keys: they ask the score to `focusNote(id)`.
- **Selection decoration versus engraved ink**: `NeumeControl` paints the
  whole-neume dashed outline, placement context, lyric-move targets and the
  per-note selection contour. `NeumeInk` paints only musical ink. The passage
  range rectangle stays in `ScoreSvg` because it spans neumes and lies outside
  the music clip.

Controls report intents through narrowly named callback groups (`NoteActions`,
`WrittenAccidentalActions`, `LyricActions`) plus a precomputed per-neume
`LyricMoveTarget`. `ChantEditor` binds the semantic actions to the session
reducer. `ScoreSvg` only forwards them from its props, unchanged, so every edit
still goes through `ChantEditor`. Controls have no runtime dependency on
commands, the reducer, or layout derivation. Their only import from `commands/`
is the type `StaffPositionDelta`, which is erased at build time.
They also do not create IDs. The one React context they read is
`SoundingNoteContext` from `playback/`: `NoteControl` calls
`useIsNoteSounding(noteId)` to draw the presentation-only sounding-note cue.
It carries no editing state or callbacks. No other context or generic
controller is used.
These are component boundaries only: they add no SVG elements, and the
rendered DOM, sibling order and clip hierarchy are unchanged.

### `src/editor/playback/`

Playback (see [playback](playback.md)): the pure Proofreading Playback
interpreter and its performance types; the pure Audio 2 navigation transforms
(start from a selection, rebase, speed, sounding-note lookup); the Web Audio
scheduler; the audio context/session controller; the per-editor
`SoundingNoteStore` with its React context; and the `usePlayback` hook.
React is used only by `usePlayback` and by `sounding-note.ts`
(`SoundingNoteContext` and `useIsNoteSounding`). Only the scheduler and the
hook's context factory touch Web Audio. Nothing here reads the DOM.

Dependencies:

- Playback imports `domain/` and, for start resolution only,
  `state/selection` (the `EditorSelection` type and `resolveNeumeRange`).
- Rendering imports playback in two places: `NeumeControl` uses the
  `useIsNoteSounding` hook (a runtime import), and
  `rendering/follow-sounding-note.ts` uses the `SoundingNoteStore` type.
  Playback never imports rendering.
- `ChantEditor` creates the store, provides the context and passes the store
  to `PlaybackControls`.

`rendering/follow-sounding-note.ts` scrolls the sounding note, looked up
within the editor's score workspace, into view with the shared
`revealElement` (also used by `focusAndReveal`), which never focuses.

### `src/editor/components/`

`ChantEditor` is the editor shell. It acquires the single persisted session,
derives layout and selection projections, binds semantic edits and history
navigation, owns the global keyboard listeners and composes the score and
controls. Component state is not a second score model.

The editor toolbar is split by ownership (readability M1):

| Module                      | Owns                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EditorStickyToolbar.tsx`   | The sticky region and its `data-too-tall` ResizeObserver                                                                                                    |
| `NotationPalette.tsx`       | Palette roving focus, button refs, remembered Division kind, palette focus requests, family menus, Quilisma figure                                          |
| `notation-palette-tools.ts` | Pure palette model: controls in `paletteTools` order, labels, pressed/active state, tool armed by each button                                               |
| `EditorActionBar.tsx`       | View of passage/clipboard feedback and Lyrics, Insert, Copy, Paste, Undo, Redo buttons                                                                      |
| `PlaybackControls.tsx`      | Play/Stop toggle, Playback options (from beginning, speed) and status, in the Quilisma figure row via the palette's `figureRowEnd` slot; uses `usePlayback` |

The palette and action bar receive session values and narrowly named callbacks;
they never dispatch arbitrary actions, hold document state or derive clipboard
or history permissions. The session reducer stays the only transition
authority. See [editor interactions](editor-interactions.md#palette-and-action-bar-ownership)
for focus-request and replacement-reset behavior.

Document-level settings panels (readability M4B-3a) follow the same
convention. `ChantEditor` composes them, decides their availability with the
named rules in `state/editor-availability.ts` and binds their callbacks to
session actions:

| Module                      | Owns                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `InitialClefControls.tsx`   | The Initial clef fieldset: type and staff-line selects, which report only a valid candidate `Clef`         |
| `LyricLanguageControls.tsx` | The Lyric language select, which reports a normalized `LyricLanguage`, and its alignment/spacing paragraph |

`ClefChangeControls` is an intentional exception to this narrow-props
convention. It receives `session` and `dispatch`, because it owns a clef
transaction's Apply, Cancel and deletion-confirmation flow and that flow's
focus management. Keep its API as it is. Do not copy the pattern for new
panels.

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

# Editor interactions

## Scope

This document is authoritative for editor targets, selection, focus, insertion,
graphical placement, previews, and pointer and keyboard lifecycle.

## Related documents

- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Commands and history](commands-and-history.md)
- [Layout and rendering](layout-and-rendering.md)
- [Testing](testing.md)
- [Glossary](glossary.md)

## Active syllable and selection

The active syllable is the lyric editing and neume insertion target. It is
transient editor-session state owned by `ChantEditor` and is independent of
score selection. Choosing a
syllable clears score selection; selecting notation activates the associated
syllable.

Score selection is an ID-only union:

- no selection;
- one note ID;
- one whole-neume ID.

Clicking a note or pressing Enter/Space on its focused control selects the
note. Shift+click or Shift+Enter/Space promotes through the constituent note to
whole-neume selection. Clicking the score background in Select mode clears
selection. Escape also clears selection when no placement tool is active.

After a document change, selection is reconciled by stable ID. A missing note
or neume clears selection; a surviving entity keeps the same selection object.
This remains valid when normalization preserves a neume or note ID.

## Movement and deletion

Arrow Up and Arrow Down move a selected note by one `StaffPosition` step. The
command rejects a move that would reverse, flatten, or otherwise invalidate the
owning multi-note neume.

When a complete neume is selected, the arrows move every nested note by the
same step. Intervals, semantic order, and IDs remain unchanged. The focused
constituent that invoked the whole-neume move is requested as the focus target
after rendering.

Delete or Backspace removes the selected note or the selected complete neume.
Individual-note deletion follows the normalization rules in the
[domain model](domain-model.md#deletion-and-normalization).

Selection and editing key handlers are guarded during placement mode, when the
score surface owns pointer placement input.

## Focus

Each committed note is a focusable SVG control keyed by stable note ID.
`ScoreSvg` maintains a map from note IDs to mounted SVG groups.

`ChantEditor` uses a pure session reducer; history contains semantic documents
only. Focus requests identify an enabled note, the placement surface anchored to
a committed note, or a palette tool. Layout effects resolve mounted refs after
React commits and acknowledge the exact request; stale acknowledgements cannot
clear newer requests. The parent handles palette focus, `ScoreSvg` handles notes
and the surface. Insertion and whole-neume movement restore stable note IDs even
across system reflow. Undo/Redo restores a surviving focused note in Select.

Automatic focus uses `focus({ preventScroll: true })`, without refocusing an
already focused destination. Separately, clipped notation is minimally revealed
in nested scroll containers and the window with an 8 px margin. An oversized
neume uses its first-note anchor. The SVG/system is never centered. Document
shrinkage can still cause native scroll-range clamping.

Successful graphical placement focuses the existing SVG root (`tabIndex=-1`
while armed), never a disabled constituent note. Its concise accessible name is
“Score placement”; its description gives kind, target syllable and Escape. The
full score summary is excluded while placing. A decorative local outline marks
the selected neume in its actual derived system while the root owns focus. It
is aria-hidden, pointer-inert and independent of the hover preview and engraving.

Escape or Select first enables note editing, then focuses the surviving selected
note in the active syllable (first semantic note for whole-neume selection).
Otherwise it focuses the palette's Select button and makes that its roving Tab
stop. Select when already active leaves selection and focus alone. No separate
last-inserted-note field or extra placement Tab stop is needed.

Tab/Shift+Tab use browser traversal, skipping disabled notes during placement;
there is no focus trap. Reverse Tab from the surface reaches Keyboard help;
forward Tab may leave page content. Escape and Undo/Redo work on the surface.
Text fields, native selects, contenteditable and composition are excluded from
document shortcuts. Lyric Escape retains draft rollback.

Browser focus and reparenting remain separate from pure unit tests. See the
[placement verification record](verification/placement/README.md).

Keyboard focus styles the actual pointer target: a padded polygon for Climacus,
a rectangle for the other current kinds. Selected-note feedback remains a
separate contour, including Porrectus ribbon regions. Decorative target and
selection shapes add no accessible controls. Exact geometry and placement-mode
pointer ownership are described in
[layout and rendering](layout-and-rendering.md#rendering-and-accessibility).

## Palette and contextual keyboard insertion

The single toolbar contains Select and seven neume tools. Only one palette
button is in the Tab order. Arrow Left/Right/Up/Down browse sequentially and wrap;
Home/End focus the first/last tool. Focus browsing changes only the roving Tab
stop. Native Enter/Space or click activates the focused button. `aria-pressed`
and the filled style identify the active tool independently of focus.

The remembered neume starts at Punctum and changes only when a neume tool is
activated. Select, Escape, focus browsing, score selection, syllable changes,
and Undo/Redo do not erase or replace it. It is transient state outside history.
The visible **Insert Punctum** (or remembered name) command is always available
when a syllable exists. Its label follows remembered state, not palette focus.

Unmodified **I** inserts the remembered kind; **T** focuses its palette button
and updates the roving Tab stop without activation. These shortcuts apply only
to score notes/surface, palette buttons and the contextual Insert button. They
ignore text inputs, textareas, native selects, contenteditable, IME composition,
already handled events, modifier chords and autorepeat. Native Enter/Space and
pitch arrows retain their existing meanings. Collapsed Keyboard help and the
visible I hint make the shortcuts discoverable without a permanent help panel.

The ordinary Tab order is palette → Insert → active syllable select → Add
syllable → lyric input → enabled Undo/Redo → Keyboard help → enabled score
notes. Disabled controls are skipped. After insertion, note focus supports
pitch arrows then I directly. T → arrows → Enter → I switches kind and inserts
without traversing every toolbar button or existing note. To retarget, T → Tab
→ Tab reaches the native syllable selector; Shift+Tab returns to Insert.

Contextual insertion first resolves a complete-neume semantic boundary and a
reference pitch for the active syllable:

1. use the selected note when it belongs to the active syllable;
2. otherwise use the last note associated with the active syllable;
3. otherwise use the kind-specific fallback position.

The preferred boundary follows the selected note's owning neume or the final
active-syllable neume. The canonical syllable resolver clamps that
preference to the active syllable's group. It never inserts inside Podatus,
Clivis, Scandicus, Torculus, Climacus, or Porrectus.

The constructed neume uses stable IDs generated by the editor. After an
accepted insertion, its first note is selected and receives pending focus.
Every accepted contextual insertion returns to Select, clears the preview,
and focuses its new first note, including when invoked during placement. A rejected
insertion changes neither document nor tool. Whole-neume selection remains
excluded from toolbar anchoring; it still falls back to the final active-syllable
note. This milestone does not change those insertion semantics.

There is no explicit global semantic creation-cap check.

## Graphical placement and preview

### Explicit placement kinds

Placement tools are explicitly mapped to the graphical whitelist: Punctum,
Podatus, Clivis, Scandicus, Torculus, Climacus, and Porrectus. Select maps
to no graphical kind. Adding a semantic neume kind does not automatically
expose a placement tool; the graphical union, mapping, resolver, preview,
and tests must be updated deliberately.

### Pointer conversion and system hit testing

`ScoreSvg` converts browser client coordinates through the inverse
`getScreenCTM()` transform into score-absolute SVG coordinates. Invalid
transforms or non-finite results produce no point.

The canonical graphical resolver accepts a point only when it belongs to
exactly one rendered system. Points in the vertical gap, outside the score, or
outside the staff's horizontal placement region are rejected. Placement works
on first, middle, and final rendered systems.

### Pitch snapping and contours

The hit system's bottom staff line is the pitch origin. The first pitch snaps
to the nearest staff step; an exact half-step tie snaps upward to the higher
`StaffPosition`. Current first-note graphical bounds are positions -1 through
7, inclusive.

With `p` as the snapped first pitch, the fixed contours are:

```text
Punctum:   [p]
Podatus:   [p, p + 1]
Clivis:    [p, p - 1]
Scandicus: [p, p + 1, p + 2]
Torculus:  [p, p + 2, p + 1]
Climacus:  [p, p - 1, p - 2]
Porrectus: [p, p - 2, p - 1]
```

Toolbar insertion uses these same contours for Climacus and Porrectus, with
position 3 as the first-pitch fallback for an empty syllable.

These fixed shapes are a current interaction limitation, not a comprehensive
neume-entry system.

### Whole-neume boundaries

Horizontal placement exposes only boundaries around complete neumes. It uses
each neume's complete raw-bounds midpoint:

```text
point at or left of the neume midpoint → before
point strictly right of the midpoint → after
```

Compact notes inside a neume never expose internal insertion positions. The
system-local boundary is converted to a global semantic index with
`startNeumeIndex`, then clamped by the canonical active-syllable resolver. An
empty syllable is placed before the next later syllable group or at the end.
This clamping can redirect a point on one system to a legal destination on
another.

### Hypothetical post-reflow preview

Hover state stores only the score point. The resolver combines the current
document, committed layout, active syllable, graphical kind, and point. It
simulates inserting an ID-free candidate at the resolved global boundary and
runs the same spacing and whole-neume wrapping rules used by committed
notation.

The returned preview is positioned at the candidate's hypothetical destination
after reflow, which may differ from the initially hit system after
active-syllable clamping. It contains kind and the shared ID-free geometry (ink, notes, bounds, anchors,
and advance), with no semantic IDs, selection, or focus state. Its prospective
`scoreHeight` keeps a candidate on a new final system inside the SVG viewBox;
canceling placement restores committed dimensions.

Runtime previews also include the complete prospective visual systems: four
staff lines, the document's clef, all neume ink and lyrics at post-reflow positions.
Existing notation displaced across a boundary is shown at its prospective position
rather than duplicated at its old location. Only the candidate is translucent.
The preview scene is aria-hidden and pointer-inert, with no note/neume IDs or
focusable controls. Committed controls stay mounted (their visuals are transparent
while previewing), preserving refs and accessibility. Hit testing and commits
still use the committed systems and current document; prospective new systems
are not new placement targets. Clearing hover restores committed visuals without
any document/history edit.

Preview and commit use the same geometry builder, sequence placement, and SVG
ink renderer. Adjacent Pes and Clivis hit-region partitioning is described in
[layout and rendering](layout-and-rendering.md#rendering-and-accessibility). After commit and normal `layoutChant`, the created neume's
geometry matches the preview.

### Lifecycle

Graphical placement is always persistent, with no repetition preference or
Insert/Place toggle.

- Activating neume K arms it and remembers K; switching kind clears hover.
  Activating the already armed kind is idempotent. None changes history.
- Pointer movement updates the ID-free preview; leaving clears it. Invalid
  points/transforms or rejected resolution never commit.
- Each success keeps the kind armed, selects the new first note, clears hover,
  and requests surface focus plus minimal destination reveal.
- Select or Escape outside text editing exits placement and clears hover while
  preserving selection and remembered kind. A second Escape can clear selection.
- Changing/adding a syllable clears selection and hover while retaining tool
  and remembered kind. Add syllable focuses the lyric input as before.
- Undo/Redo retains tool and remembered kind, clears hover, and reconciles stable
  selection and target: selection wins, then a surviving active target, then the
  final syllable. Removing the only syllable exits to Select and focuses its
  palette button. History never focuses disabled notes while placing.

### Consecutive clicks and history

A second click at the same client coordinates is allowed with no pointer move
and no visible preview. Each click converts through the current screen transform
and is resolved anew against the reducer's latest document, layout, active
syllable, and armed kind. The preview's cached insertion intent is never a
commit source. Clearing hover does not disable the click path.

Accepted clicks allocate fresh entity IDs, commit exactly one neume and one
history entry, and select that insertion's first note. The next click may resolve
to a different boundary, pitch, or system after reflow or scrolling; there is no
promise of append order. An invalid next resolution does nothing. Rapid events
use successive reducer states, so a render closure cannot overwrite preceding
edits. ID allocation occurs in event handling, not reducer replay.

Only `click` commits; pointer-down/up and `dblclick` add no commits. A double-click
may generate two click events and hence two insertions while persistent, but no
third insertion. Each insertion is separately undoable; repetition is not
a passage-level transaction, and a new edit after Undo clears the redo branch.

### Persistent status and event announcements

The active tool is derived from `activeTool` through the palette's pressed state.
The compact native syllable selector shows the active ordinal and lyric text;
the adjacent input edits that lyric. Neither is a live region. There is no
context panel, sticky strip, repetition checkbox or Finish control.

One initially empty, unfocusable polite atomic status region emits concise event
messages. A sequence-keyed child exposes a fresh mutation for identical messages.
Accepted reducer transitions announce, never pointer/render effects:

| Event                          | Message                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| Activate/switch neume          | “Placing Podatus.”                                                  |
| Graphical/contextual insertion | “Punctum added.”                                                    |
| Exit placement                 | “Select tool.”                                                      |
| Change/add target while armed  | “Target: syllable 3, empty.”                                        |
| Undo/Redo while armed          | “Undo.” / “Redo.” plus an actual target-change or no-target outcome |

Focus browsing, hover/preview, lyric keystrokes, unchanged tool activation,
rejected clicks and no-op history stay silent. Native focus/selection states
provide their own accessibility feedback. Rapid polite events can be coalesced
by assistive technology; every rapid insertion is not guaranteed to be spoken.

Pure tests cover transitions, memory, insertion/history/preview invariants,
palette navigation and scroll calculations. Actual focus, native keyboard and
Tab order, pointer ownership, scrolling, accessible naming and status mutations
are separately verified in the browser. Spoken output requires a screen-reader
pass. See [testing](testing.md) and the linked verification record.

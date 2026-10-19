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

`ChantEditor` uses a pure editor-session reducer to coordinate history and
transient state. History still stores semantic documents only. Focus requests
contain a stable note ID and a destination (enabled note, placement surface,
or Finish/Select/Edit control). `ScoreSvg` handles these in a layout effect
after committed geometry and refs are available, then acknowledges that exact
request. A stale acknowledgement cannot clear a newer request.

Enabled-note insertion and whole-neume movement request note focus. Undo/Redo
in Select/Edit restores the focused note only if it survives by stable ID,
including after systems reflow. Placement discards pending enabled-note requests
and never programmatically focuses disabled constituent notes.

All automatic focus uses `focus({ preventScroll: true })`, and an already
focused destination is not refocused. Separately, the visibility helper reveals
only a clipped note/neume using the smallest necessary scroll adjustment. It
accounts for scroll containers, the sticky context strip, and an 8 px margin;
if complete neume bounds exceed the usable viewport, the first-note anchor
wins. It never centers the whole SVG/system. Browser scroll-range clamping
when Undo shortens a document can still change scroll offsets.

After persistent placement, the existing SVG root owns programmatic focus
(`tabIndex=-1` while armed); there are no extra system controls or ordinary Tab
stops. Its placement name is “Score placement” and its short description gives
the kind, target syllable, repetition preference, and Escape instruction. The
full score summary is not referenced by that focused placement group. Leaving
placement restores the normal title/summary naming relationship.

A local decorative outline follows selected notation in the actual derived
system while the SVG owns focus. The sticky tool/target strip is also accented.
Both refer to existing state and geometry, not stored system ownership or a
new placement target. One context line is reserved while armed so showing the
first selected system does not resize the strip on narrow screens. The local cue is distinct from the preview, aria-hidden,
and pointer-inert; it does not affect engraving or wrapping.

The sticky strip contains **one button that remains mounted**: “Finish placing”
while armed and “Select/Edit” otherwise. Finish/Escape first enables ordinary
note controls, then focuses the surviving selected note in the active syllable.
For whole selection it uses the first semantic note; otherwise it focuses that
same visible strip button. It preserves selection and Keep placing. Activating
Select/Edit when already in that tool does not clear selection or force focus
away from the control. No separate last-inserted-note state is stored.

Tab/Shift+Tab retain ordinary browser traversal, skipping placement-disabled
notes. Reverse traversal from the root reaches the strip action; forward
traversal may leave page content if no later control exists. There is no focus
trap or Enter/Space insertion on the root. Escape and history shortcuts work
on the surface and the Keep placing checkbox. Native text editing, selects,
contenteditable elements, and IME composition are excluded from document-level
shortcut handling. Escape in the lyric input remains draft rollback.

Browser focus and reparenting remain separate from pure unit tests. See the
[placement verification record](verification/placement/README.md).

Keyboard focus styles the actual pointer target: a padded polygon for Climacus,
a rectangle for the other current kinds. Selected-note feedback remains a
separate contour, including Porrectus ribbon regions. Decorative target and
selection shapes add no accessible controls. Exact geometry and placement-mode
pointer ownership are described in
[layout and rendering](layout-and-rendering.md#rendering-and-accessibility).

## Toolbar insertion

Toolbar insertion first resolves a complete-neume semantic boundary and a
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
All accepted Add actions, including Punctum, return to Select/Edit, clear the
preview, and focus the new first note even if Keep placing is enabled. A rejected
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

Preview and commit use the same geometry builder, sequence placement, and SVG
ink renderer. Adjacent Pes and Clivis hit-region partitioning is described in
[layout and rendering](layout-and-rendering.md#rendering-and-accessibility). After commit and normal `layoutChant`, the created neume's
geometry matches the preview.

### Lifecycle

Keep placing is a session-only boolean, initially false. It is independent of
the current `EditorTool`; checking it in Select/Edit does not arm a tool.
There is no shared-palette Insert/Place preference yet: existing Add and Place
buttons remain separate.

- Place K arms that kind; changing kind clears hover, and activating the already
  armed kind is idempotent. Neither action inserts or changes history.
- Pointer movement updates the ID-free preview. Pointer leave clears it.
- Invalid coordinates/transforms or rejected resolution do not commit.
- A successful one-shot placement returns to Select/Edit, clears hover, selects
  the new first note, and requests enabled-note focus.
- With Keep placing on, success keeps the same kind armed, selects the first
  note, clears hover, and requests root placement focus plus minimal destination
  reveal. Disabled constituent notes are never focused.
- Turning Keep placing off while armed affects the next accepted click; it
  does not finish immediately. Finish never resets the preference.
- Finish/Select/Edit or Escape outside native text editing ends placement and
  clears hover. Committed notation remains. A second Escape in Select/Edit can
  clear selection as before.
- Choosing/adding a syllable clears score selection and hover but retains the
  armed kind and repetition. The existing lyric-input autofocus is preserved
  when adding a syllable.
- Undo/Redo retains tool and repetition, clears hover, and reconciles selection
  and active syllable by stable ID. Selection wins, otherwise a surviving active
  target wins, otherwise the final syllable wins. With no surviving syllable,
  placement ends and requests the strip control. History does not chase a
  previous selection with new focus while placement remains active.

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
third insertion. After one-shot entry, the second click instead follows ordinary
Select/Edit behavior. Each insertion is separately undoable; repetition is not
a passage-level transaction, and a new edit after Undo clears the redo branch.

### Persistent status and event announcements

The visible context strip is non-live content derived from the tool, active
syllable ordinal/text, and Keep placing preference. Optional system context is
resolved from stable selection IDs and current layout. There is no second
stored status model or authoritative placement-system index.

One initially empty, unfocusable `role="status"` region emits polite atomic
event messages. An event sequence identifies accepted notifications; a keyed
text child exposes a fresh mutation even when consecutive messages match.
Announcements originate in accepted transitions, not pointer/render effects:

| Event                               | Message                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Arm/switch kind                     | “Placing Podatus.”                                                                                   |
| Persistent success                  | “Punctum added.”                                                                                     |
| One-shot success or Add while armed | “Punctum added. Placement finished.”                                                                 |
| Add in Select/Edit                  | “Punctum added.”                                                                                     |
| Explicit Finish                     | “Placement finished.”                                                                                |
| Change/add target while armed       | “Target: syllable 3, empty.” (actual ordinal/text)                                                   |
| Undo/Redo while armed               | “Undo.” / “Redo.”; combine an actual target-change or no-target/Finish outcome into the same message |

The checkbox exposes its native checked state without duplicate live speech.
Hover, snapping, preview updates/clearing, unchanged tool activation, lyric
keystrokes, rejected clicks, and no-op history produce no announcement. Rapid
polite messages may be coalesced by assistive technology; no guarantee is made
that every rapid insertion is spoken. No full score summary is appended to
make repeated strings different.

Pure tests cover lifecycle, insertion/history invariants, context reconciliation,
and visibility calculations. Actual DOM focus, pointer ownership, scroll,
accessibility-tree naming, live-region mutations, and keyboard propagation are
verified separately in the browser; spoken output requires a screen-reader pass.

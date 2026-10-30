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

Music insertion is independent of lyric entry. Selection stores stable IDs;
Lyrics mode owns one transient draft with explicit insert or edit intent.
Selecting an occupied musical target never implies permission to replace text.

Score selection is an ID-only union:

- no selection;
- one note ID;
- one whole-neume ID;
- one syllable ID.

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
note (first semantic note for whole-neume selection).
Otherwise it focuses the palette's Select button and makes that its roving Tab
stop. Select when already active leaves selection and focus alone. No separate
last-inserted-note field or extra placement Tab stop is needed.

Tab/Shift+Tab use browser traversal, skipping disabled notes during placement;
there is no focus trap. Reverse Tab from the surface reaches Keyboard help;
forward Tab may leave page content. Escape and Undo/Redo work on the surface.
Text fields, native selects, contenteditable and composition are excluded from
document shortcuts. Lyric Escape cancels the current draft and exits Lyrics.

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
including when no syllables exist. Its label follows remembered state, not palette focus.

Unmodified **I** inserts the remembered kind; **T** focuses its palette button
and updates the roving Tab stop without activation. These shortcuts apply only
to score notes/surface, palette buttons and the contextual Insert button. They
ignore text inputs, textareas, native selects, contenteditable, IME composition,
already handled events, modifier chords and autorepeat. Native Enter/Space and
pitch arrows retain their existing meanings. Collapsed Keyboard help and the
visible I hint make the shortcuts discoverable without a permanent help panel.

The ordinary Tab order follows the DOM: palette, Lyrics, Insert, enabled Undo/Redo, Keyboard help, score note/lyric controls, then lyric input/actions and one strip stop. Native traversal is preserved.
After insertion, note focus supports pitch arrows then I directly. T → arrows →
Enter → I switches kind and inserts.

## Continuous lyric entry

The visible **Lyrics** action resumes or activates entry. Unmodified **L** does
so only from focused notation in Select mode, excluding native text controls,
modifier chords, composition and autorepeat. No browser address-bar shortcut is
intercepted. Empty scores explain that music must be added first.

The native input appears near the selected neume's lyric position. Its DOM
identity persists across target navigation and system reflow. Its position is
presentation only. The session reducer owns its text, target, original semantic
values, pending word boundary and insert/edit intent; components own only browser
refs, composition guards and roving focus.

A free neume opens insertion. An occupied neume pauses, showing existing text
with **Edit syllable** and **Skip neume**. Typing never replaces paused lyrics.
Single-clicking engraved lyric text, or pressing Space on an unselected focused
lyric, selects it without opening an input or activating Lyrics mode. Tab can
therefore reach a lyric, Space selects it, and Delete/Backspace deletes only its
text while preserving its music. Double-clicking, pressing Enter, or choosing Edit syllable
opens its existing text with a normal collapsed cursor at the end. Strip buttons
continue to offer explicit editing. Typing on a selected engraved syllable starts
replacement, rather than appending to its old text. After Save/Enter, the committed syllable is selected;
typing replaces it intentionally, Enter edits, minus continues its word, Space
starts a word, and Delete removes only its lyric. Delimiters activate Lyrics
from selected syllables even when it was previously inactive; occupied anchors
still pause insertion without overwriting. Native input Delete/Backspace
remain text editing. Keyboard Delete/Backspace on selected lyrics and the
Delete syllable button use the same semantic deletion. They preserve every neume,
select the former anchor neume, and focus its first note. No empty input opens;
Lyrics mode remains active if it was active, with explicit entry/skip controls,
and otherwise stays inactive. Holding the deletion key does not delete music
through autorepeat after focus moves to the note.

| Input/action                                              | Result                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Minus after text                                          | Commit once; target next neume with continuation boundary.                                         |
| Space after text                                          | Commit once; target next neume with word boundary.                                                 |
| Underscore on an empty draft                              | Skip that neume, retaining the pending boundary.                                                   |
| Underscore after text or on a selected committed syllable | Commit/preserve current text, skip the following neume, target the one after it with continuation. |
| Underscore at an occupied target                          | Skip without editing; subsequent insertion defaults to word start.                                 |
| Enter / Save                                              | Commit and remain in Lyrics mode.                                                                  |
| Done                                                      | Resolve the draft, then exit.                                                                      |
| Escape                                                    | Cancel current draft and exit; earlier commits remain.                                             |
| Tab / Shift+Tab                                           | Native focus traversal without target navigation or commit.                                        |

Repeated minus/Space on an empty draft changes only its pending boundary. Skip
is also available as a visible action. Delimiter autorepeat never advances.
A new first syllable always starts a word. **Word boundary** controls allow
Starts word / Continues word correction; the first syllable is constrained.

Clicking another musical target commits a valid draft before navigation and
starts a new word by default. Reopening the same target preserves the draft.
Empty insertion creates nothing. A cleared existing edit preserves the original
with an announcement; deletion is explicit. Nonempty invalid text blocks score
navigation with feedback, without trapping native focus. Blur never commits or
discards; returning through Lyrics resumes the draft. Pasted whitespace or ASCII
entry delimiters is rejected, not split. Composition never triggers entry commands
or submission. Greek and accented text remain ordinary syllable text.

Sequential advancement pauses at existing anchors; it does not skip or overwrite
them automatically. Occupied targets require explicit Edit or Skip. Reaching the
end commits valid text and keeps Lyrics active with a pending boundary. Contextual
music insertion while waiting resumes at newly available music. Underscore can
retain an outstanding skip until enough neumes have been appended. No semantic
placeholders or unanchored syllables are created. Choosing a musical placement
tool resolves the draft and exits Lyrics; invalid drafts prevent that switch.

Dirty drafts whose target disappears, becomes occupied, or changes externally
enter recovery rather than disappearing. Select a free neume and **Retry at
selected neume**, or explicitly discard. Retry creates insertion intent; it never
silently updates unrelated lyrics. Input undo is browser-owned. Explicit semantic
Undo/Redo with a dirty draft offers Save / Discard / Cancel; invalid saves retain
the draft and prompt. Escape dismisses the history prompt without losing text.

The ordered lyric strip remains a roving focus group. Arrows/Home/End browse
without changing document or target; Enter/Space deliberately edits. Native Tab
traversal is preserved. Selected/focused buttons reveal only within the strip.

Anchor-reassignment UI is Stage 3; generated hyphens remain Stage 4.

Contextual insertion follows the selected note's owning neume or selected
whole neume. Without selection it appends. Pitch comes from the selected note,
selected neume's final note, or final document note, then the kind fallback.
Syllable selection supplies its anchor neume as reference.
Insertion preserves all anchors. Accepted toolbar insertion selects/focuses the
new first note and returns to Select. Graphical placement remains armed.

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
position 3 as the first-pitch fallback for empty music.

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
`startNeumeIndex`, without lyric-group clamping.

### Caret and cursor ghost

Hover state stores only the score point. The resolver combines the current
semantic document, committed layout, graphical kind and point.
It snaps pitch and resolves the global whole-neume insertion boundary without lyric constraints. It does not simulate a new score layout.

The ID-free preview contains two distinct cues:

- A dashed vertical **caret** marks the resolved semantic boundary in committed
  layout. Between neumes it uses the midpoint of the previous painted right edge
  and following painted left edge. Before/after a system's notation it uses half
  the normal ink gap, clamped inside the staff; an empty system uses the first
  normal neume anchor. At a boundary shared by two systems, use the hovered
  system when it contains that boundary. Otherwise use the system containing
  the following semantic neume, or the final committed system at document end.
- A translucent blue **ghost** follows the pointer horizontally and shows the
  selected neume's actual contour at the snapped pitch on the hovered staff.
  The shared builder supplies its full geometry. Horizontal clamping keeps its
  painted bounds inside that staff with a 3-unit margin, without changing pitch,
  contour or scale. Ghost overlap with existing notation is intentional; a pale
  outline helps distinguish the ghost. It does not claim final engraved x/y.

The caret follows the unrestricted semantic insertion boundary on the hovered
system; lyric order never redirects placement to another system.

Both cues are pointer-inert, aria-hidden and unfocusable. Committed neumes,
lyrics, staff lines, accessible controls and their refs remain unchanged and
visible. The SVG viewBox and visible dimensions use only committed layout.
No system is added, removed, reserved or rearranged during hover. There is no
prospective scene or speculative score height.

On click, current document/layout/point are resolved again; then semantic
insertion and normal `layoutChant` apply spacing and whole-neume wrapping. The
new note's actual committed destination drives the existing postcommit focus
and minimal reveal. The tool stays active and hover clears. Preview/commit
accuracy means the same semantic boundary, snapped pitches and neume shape,
not the same absolute horizontal or system position. Shared ink construction
and [hit geometry](layout-and-rendering.md#rendering-and-accessibility) remain
unchanged.

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
- Entering Lyrics switches to Select and clears hover without changing the remembered neume kind. Drafts and pending boundaries stay outside semantic history.
- Undo/Redo retains tool and remembered kind, clears hover, and reconciles stable
  selection and lyric entry. Removing all syllables never disables placement.
  History never focuses disabled notes while placing.

### Consecutive clicks and history

A second click at the same client coordinates is allowed with no pointer move
and no visible preview. Each click converts through the current screen transform
and is resolved anew against the reducer's latest document, layout and armed kind. The preview's cached insertion intent is never a
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
The syllable strip shows ordinal and lyric text with pressed selected state.
Creation and editing share one native input with explicit intent. These are not live regions.

One initially empty, unfocusable polite atomic status region emits concise event
messages. A sequence-keyed child exposes a fresh mutation for identical messages.
Accepted reducer transitions announce, never pointer/render effects:

| Event                          | Message            |
| ------------------------------ | ------------------ |
| Activate/switch neume          | “Placing Podatus.” |
| Graphical/contextual insertion | “Punctum added.”   |
| Exit placement                 | “Select tool.”     |
| Undo/Redo while armed          | “Undo.” / “Redo.”  |

Focus browsing, hover/preview, lyric keystrokes, unchanged tool activation,
rejected clicks and no-op history stay silent. Native focus/selection states
provide their own accessibility feedback. Rapid polite events can be coalesced
by assistive technology; every rapid insertion is not guaranteed to be spoken.

Pure tests cover transitions, memory, insertion/history/preview invariants,
palette navigation and scroll calculations. Actual focus, native keyboard and
Tab order, pointer ownership, scrolling, accessible naming and status mutations
are separately verified in the browser. Spoken output requires a screen-reader
pass. See [testing](testing.md) and the linked verification record.

Selected engraved lyrics retain their ordinary ink and use a purple dashed
outline consistent with neume selection. Keyboard focus has a separate solid
blue outline outside it; selection does not use a hyperlink-style underline.

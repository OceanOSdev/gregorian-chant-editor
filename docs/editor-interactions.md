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

Score selection uses stable IDs for entities and a singleton tag for the clef:

- no selection;
- one note ID;
- one whole-neume ID;
- one syllable ID;
- one division ID;
- one explicit clef-change ID;
- the required initial clef (no semantic ID).

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

A free neume opens insertion. Contextual activation or sequential navigation to
an occupied neume pauses, showing existing text
with **Edit syllable** and **Skip neume**. Typing never replaces paused lyrics.
Single-clicking engraved lyric text, or pressing Space on an unselected focused
lyric, selects it without opening an input or activating Lyrics mode. Tab can
reach a lyric and Delete/Backspace deletes it directly, without requiring Space.
Deletion targets the focused engraved syllable even when another syllable is
selected, preserving all music. Space remains available for explicit selection. Double-clicking, pressing Enter, or choosing Edit syllable
opens its existing text with a normal collapsed cursor at the end. Strip buttons
continue to offer explicit editing. Typing on a selected engraved syllable starts
replacement, rather than appending to its old text. After Save/Enter, the committed syllable is selected;
typing replaces it intentionally, Enter edits, minus continues its word, Space
starts a word, and Delete removes only its lyric. Delimiters activate Lyrics
from selected syllables even when it was previously inactive; occupied anchors
still pause insertion without overwriting. Native input Delete/Backspace
remain text editing. Keyboard Delete/Backspace on focused engraved lyrics and the
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

Toolbar insertion uses these same contours for all seven graphical kinds. For
empty music, the first-pitch fallback is position 3 for Clivis, Climacus and
Porrectus, and position 2 for Punctum, Podatus, Scandicus and Torculus.

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

On click, the reducer resolves its latest document and point with the same
measurement snapshot used by the displayed layout; then semantic
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
and is resolved anew against the reducer's latest document, measured layout and armed kind. The preview's cached insertion intent is never a
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

Selected engraved lyrics retain their ordinary ink and use a pale purple
background highlight contained within their horizontal text extent. Keyboard focus uses the labeled marker
described below; selection does not use a hyperlink-style underline.

## Focus and selection feedback

Browser focus and semantic selection remain independent, as they do for notes
and palette browsing. Tab/Shift+Tab never select lyrics, commit drafts, create
history entries, or change the active tool. A user can inspect another syllable
and return without losing the musical selection. Automatic synchronization
would make ordinary focus navigation change editing context or commit a draft.

Purple marks selection: neumes retain their dashed outline and lyrics use a
contained background highlight. Engraved-lyric keyboard
focus uses a blue caret and a separate “Keyboard focus” caption, rather than
another enclosing active box. The lyric panel names the currently focused
syllable and explains that Delete/Backspace deletes it and Enter edits it.
The selection summary names the selected syllable; **Edit selected syllable**
and **Delete selected syllable** keep acting on that selection. Their activation
moves browser focus to the button, so the engraved-lyric keyboard marker and
focused-target summary disappear. The last caption retains hidden, aria-hidden
layout space so that focus changes during pointer-down cannot shift a button
before pointer-up. Focus tracking is presentation-only and is
never used to retarget editing commands.

Delete/Backspace on an engraved lyric continues to use the event target's stable
syllable ID, even when another entity is selected. Typing replacement and
continuation still require explicit selection; Enter/double-click still opens
cursor editing. Native text-input keys and Space-as-word-boundary are unchanged.

## Keyboard command scope

Focus and selection have different roles; neither universally overrides the
other. Tab/Shift+Tab is focus browsing only. Explicit element-local commands use
the focused control's stable ID; commands defined on selection retain selection
semantics. A command must not silently fall back from a focused score entity to
a different selected entity. Selection requirements still authorize particular
edits; focus alone does not authorize every operation.

| Command/context                            | Target rule                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| L on a focused note                        | Insert at its owning neume, or cursor-edit the syllable anchored there.                                                          |
| L on a focused engraved syllable           | Cursor-edit that syllable, independent of selection.                                                                             |
| Lyric Enter / Delete / Backspace           | Edit/delete that focused lyric, as already defined.                                                                              |
| Lyric replacement / continuation           | Require the focused lyric itself to be selected.                                                                                 |
| Note pitch arrows / note or neume deletion | Require selection of the focused note or its owning whole neume; otherwise do nothing. Do not redirect to a different selection. |
| Contextual Insert / I                      | Selection-based insertion, with the existing end-of-document fallback.                                                           |
| T / palette activation                     | Navigate to the remembered tool / activate the focused palette button.                                                           |
| Undo / Redo                                | Document history, resolving dirty drafts first.                                                                                  |

Unmodified L is reserved for Lyrics activation on score controls, including a
selected engraved lyric. Shift+L can still begin uppercase replacement; native
inputs keep ordinary letter input. Explicit L on a focused lyric or a note whose
neume anchors a syllable opens existing text with a normal cursor, just like
Enter/double-click, without selecting all or replacing text. Sequential entry
with minus, Space, or underscore still pauses at occupied anchors. It
preserves the semantic selection and existing content/history. If a lyric draft
is already open elsewhere, this explicit activation follows the existing
commit-on-navigation policy: commit valid text, preserve invalid text and block
navigation, and never discard a draft silently. Reinvoking it at the same target
keeps the draft. A missing focused ID is a no-op, not a selection fallback.

The visible Lyrics button remains selection/context-based activation or draft
resumption. Activation from the score surface without an entity retains its
existing selection/first-neume fallback. This change does not redesign I/T, note
editing, native input keys, or lyric Space-as-word-boundary behavior.

## Lyric anchor correction

Select an engraved syllable and choose **Move syllable**. The action is also
available while editing an existing syllable. Activation resolves the current
draft through the continuous-entry navigation policy: valid text commits first,
empty/unchanged text creates no edit, cleared existing text preserves its original,
and invalid or stale/recovery drafts block activation without losing text.

The session reducer owns a temporary reassignment with the moving syllable ID,
previewed neume ID and preceding resolved Lyrics context. It selects the moving
syllable and initially focuses its current anchor's first note. The panel names
the syllable, current anchor and preview. Green dashed score outlines identify
legal destinations; a solid blue outline identifies the preview. Captions and
accessible note labels distinguish legal destinations, the current anchor and
unavailable targets. Legal targets are derived from the open interval between
neighboring anchors, excluding occupied/current anchors. The pure reassignment
command remains authoritative at commit.

Clicking anywhere in a legal destination's highlighted rectangle immediately
commits, with no confirmation
step. Previous/Next destination and Left/Right browse legal neumes in semantic
order without wrapping or changing selection. Browsing requests focus/reveal on
the candidate's first note across systems. Enter on the score or **Move here**
commits the preview. Tab/Shift+Tab remain native focus traversal and do not change
the preview or selection. Escape or **Cancel move** restores the preceding
resolved Lyrics context and the preceding semantic selection (reconciled by ID),
focusing that restored selection without changing the anchor or history. Successful moves
retain syllable identity and selection, resume that context, and focus/reveal the
moved engraved syllable. An already-resolved draft remains resolved on cancellation;
its preceding text commit, if any, remains independently undoable.

Current-anchor, occupied, crossing and missing targets create no semantic edit
and announce the reason while leaving the move recoverable. Unrelated music,
lyric and history actions are suspended until commit/cancel; toolbar controls
are disabled. Enter, L and double-click retain their normal text-editing roles
outside reassignment. Moving lyrics changes no engraving/wrapping policy.

The restored Lyrics target can differ from semantic selection, for example after
pressing L on another focused syllable. The panel names the Lyrics target
separately from the purple selection cue. **Edit selected syllable** and
**Delete selected syllable** always send the semantic selection's explicit ID;
engraved keyboard actions continue to send their focused target's ID. Starting a
move from a draft does not turn the resolved workflow target into selection on
cancel. Enter confirms only with score focus; Keyboard help retains native Enter
activation. Lyrics activation focuses its primary action before considering
fallback controls such as Move syllable.

## Stage 4A language and alignment controls

The always-visible **Lyric language** select edits the document, independently
of selection or the Lyrics target. Latin is explicit for new chants. Changing
language preserves any dirty text draft and its target; history navigation
continues to require draft resolution.

**Alignment for selected syllable** identifies the exact selected target and
never retargets on Tab/focus. Choose Automatic or Manual; native Segment start
and Segment end selects choose contiguous graphemes by keyboard or pointer.
Manual initially selects the whole syllable, then each range choice is one
history action. Reset to automatic uses the current document language. Save
or cancel a text draft before changing its alignment. The control explains
that any text change resets an override, recoverable with text undo.

## Stage 4B measured reflow and overflow

Graphical placement actions carry the displayed text-measurement snapshot outside
semantic history. The reducer calls `layoutChant` with that snapshot on its latest
document, serializing rapid clicks without a music-only retargeting step. Hover,
caret, hit regions and click resolution therefore use the same geometry policy.
Text, boundary, language and manual-alignment edits rederive layout without extra
history entries. Pending/missing metrics use the same provisional music-only
fallback in the renderer and reducer.

Exceptional oversized lyrics use the locally scrollable score viewport described
in [layout and rendering](layout-and-rendering.md#lyric-clearances-and-oversized-canvas-stage-4b).
Tab reaches its named region; native horizontal arrow keys scroll it. The inverse
SVG screen CTM handles negative origins and horizontal scroll when placing on
any system. Editor controls stay outside that scroller. Focus reveal scrolls
clipped destinations locally, and measurement-driven reparenting restores the
focused semantic ID independently of selection. The local ghost continues to
show current-system intent, without simulating hypothetical reflow.

## Stage 4C compact pointer ownership

Under [Accepted ADR 0011](adrs/0011-word-aware-chant-engraving.md), compact
same-word neumes use layout-derived horizontal ownership clips. The midpoint
between adjacent ink bounds clips external note padding and lyric reassignment
destinations, preserving internal constituent contours and every visible ink
edge. Decorative hyphens never receive pointer events or focus. Graphical
insertion and caret/ghost feedback continue using the committed measured layout;
there is no second word-spacing authority in event handlers. See the
[layout guide](layout-and-rendering.md#stage-4c-word-composition)
for geometry, reservation and fallback policy.

## Stage 5B division controls

The Divisions group chooses Minima, Minor, Maior or Finalis and arms persistent
Place division. Changing its placement kind while armed changes the ghost.
Hover shows a semantic-slot caret and shared division ink; click inserts one
atomic edit and leaves placement armed. Escape returns to Select. Division tools
do not change the remembered neume kind or add an unmodified shortcut. I/T and
neume palette roving remain available under their existing scope and guards.

In Select, click or Enter/Space selects a division by stable ID. Native Tab moves
focus independently of selection; the division has a blue selected cue and a
purple dashed focus cue. Delete/Backspace intentionally removes the focused
bar even if another entity is selected, with repeat/composition/modifier guards.
The Divisions group names the most recently focused division (while controls are
used), otherwise the selected division. It offers kind replacement, deletion,
and explicit Insert remembered neume before/after division buttons. These name
real semantic slots, including between adjacent bars and at score edges. I on a
selected/focused division announces the explicit side choices instead of choosing
an implicit side. Contextual I after a selected neume inserts immediately after
that neume, before any following punctuation. No numeric occupied boundary is
silently rejected or converted to an arbitrary side.

Divisions preserve identity through kind changes and layout reparenting. Surviving
focus targets are restored on reflow/history; deletion clears a removed selection
and returns focus to Select. Undo restores semantic content without rewinding
transient selection. Division edits preserve dirty lyric drafts; arming placement
uses the established commit-on-mode-change policy and refuses unresolved invalid
or recovery drafts. Pending history and lyric-move modes keep their existing
exclusive ownership. Division tools have no implicit lyric delimiter meaning.

All four kinds can occur at any legal musical boundary, including within a
single syllable's melisma. There is no word-splitting, placement warning or
linguistic validation attached to a division kind.

## Initial clef controls (Stage 6A)

The always-visible **Initial clef** group offers explicitly labeled **Clef type**
(C/do or F/fa) and **Staff line** (1–4, bottom to top) native selects.
Each change preserves melody in the initial governing passage and records one semantic
history entry. Controls keep native focus, preserve active placement tools and
remembered neume kind, and leave dirty lyric drafts intact. They are disabled
during pending history resolution, lyric reassignment and clef transactions.

In Select mode the required first-system clef is a singleton focusable button. Click or
Enter/Space selects it. Tab focus alone does not select. Arrow Up/Down on the
focused clef moves its reference line one legal line; at lines 1/4 the outward
arrow makes no edit. Modifier chords, repeat and composition do not edit it.
Blue selection and a purple dashed keyboard-focus cue are independent. Escape
clears selection through the existing handler (or resolves the active lyric
context first). Delete never removes the required clef. Later-system copies
are decorative repetitions of the effective incoming clef, unless an authored
clef occupies the leading position; authored changes remain independent controls. The score summary and control label name type and line.

While placement is active the clef target is disabled, removed from Tab order
and pointer-inert; the score surface retains placement ownership. Leaving
placement can restore clef focus through the singleton focus request. The first
clef stays in its first-system DOM group through musical reflow, so normal clef
edits and history retain browser focus. Horizontal clef dragging is excluded.

## Mid-score clef placement and contextual editing (Stage 6B)

**C clef** and **F clef** are persistent placement tools in the main notation
palette. They share pressed states, roving Arrow/Home/End navigation and native
Enter/Space activation with neume tools. They do not change the remembered
neume kind: I continues to insert that neume. The required initial clef remains
a separate control.

Hovering a valid staff shows the approved translucent C/F silhouette at a
measured score slot, with the existing caret. Height snaps to the nearest staff
line, bottom 1 through top 4; exact half-line ties go upward. The hit band extends
half a staff space beyond the outer lines. Outside that band (or the extended
staff's horizontal bounds), neither preview nor click is accepted. Hover never
changes the document, lyrics, wrapping or history. Both hover and click use
`resolveGraphicalClefPlacement`; click resolves again against the latest document
and displayed font snapshot in the reducer.

A compact **Pitch handling** radio group appears near the toolbar while placing
a clef, selecting an authored clef, or editing its draft.
**Keep pitches (move existing notes)** is selected at initialization: existing
noteheads shift to retain their interpreted pitches. **Keep note positions
(change pitches)** leaves noteheads in place and changes their interpreted
pitches. This session-only option persists across placements and C/F tool
switches, Select mode and staged edits; it is outside the document and history
and may reset on refresh. Changing it never edits music. It is available during
a draft but disabled during deletion confirmation.

Click applies the selected behavior immediately as one undoable edit, even when
existing notes are affected. No insertion confirmation or Apply step appears.
Trailing/redundant clefs commit under either choice. Unsafe arithmetic rejects
without music/history mutation or fallback; a nearby accessible status explains
how to choose another mode and retry. The tool stays armed, successful placement
clears hover and returns focus to the score. Double-click continuation events
and repeated keyboard activation are ignored. Escape returns to Select.

For keyboard-only insertion, choose C/F in the palette, choose the insertion
behavior, then Tab to **Place clef
with keyboard** and activate it (or focus the score and use an arrow). Left/Right
visits explicit semantic boundaries; Home/End visits the score edges; Up/Down
chooses lines 1–4; Enter/Space inserts with exactly the same pitch/history rules.
The live announcement describes the line and neighboring item; the caret and
ghost reveal the current target. A shared break boundary uses its continuation
system copy. A stale keyboard target rejects rather than silently retargeting.
Pointer motion takes over from keyboard placement; switching tools clears both
preview sources. Keyboard cursor, hover and tools live only in session state.

Clef arming retains a lyric draft without saving or discarding it. Hover, rejected
placement and Escape preserve that draft, anchor and redo branch; successful
insertion preserves the draft and starts a new history branch. Switching to a
neume/division tool still follows their established commit-on-mode-change policy.
Escape from an armed clef returns to Select before acting on a lyric draft.
A document capture handler gives pending existing-clef cancellation precedence
even if focus leaves the draft or deletion prompt for an editable lyric field.

In Select, click or Enter/Space selects an authored clef by stable ID. A compact
**Selected clef** group beside the score offers Edit, Delete and explicit
remembered-neume insertion on either side; there is no global clef picker or
full-score boundary dropdown. I on a focused/selected clef announces those side
controls. Selecting does not itself start an edit.

**Edit clef change**, or Up/Down on a focused authored clef, opens a compact
contextual C/F + line draft with explicit **Apply clef change** / **Cancel clef
change**. Repeated changes remain transient. Where the draft glyph fits safely
between committed ink and staff bounds, an inert purple overlay previews it in
place; the original geometry remains committed and its ink fades. No music or
custos is provisionally transposed or reflowed. Apply compares the final draft
with the original snapshot and uses the currently selected shared pitch mode
immediately, committing one history entry without a preservation popup. Unsafe
Keep pitches leaves the draft pending with an accessible nonmodal error beside
the editor. Switch to Keep note positions or revise the draft and retry Apply;
there is no silent fallback. No-op/Cancel preserves exact music, history, redo
and lyric drafts. The chosen tool option persists even after Cancel. This
retains amended ADR 0015's staged editing contract.

Delete/Backspace or Delete removes an authored clef immediately when pitches are
unaffected, otherwise asking its separate conditional Preserve melody / Preserve noteheads
choice. The shared pitch mode does not decide deletion. Commit selects
and reveals the surviving ID; deletion focuses Select. Edit cancellation retains
the preceding selection and returns focus to the edited glyph. Placement returns
focus to the score, revealing the actual inserted glyph after reflow. Tab focus
alone never selects. Decorative system repetitions, ghosts, draft overlays and
custodes remain noninteractive. Relocation requires delete/reinsert; no existing
clef has horizontal dragging or slot movement.

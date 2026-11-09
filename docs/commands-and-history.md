# Commands and history

## Scope

This document is authoritative for semantic edit contracts, rejection and
no-op behavior, structural sharing, and undo/redo history.

## Related documents

- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Editor interactions](editor-interactions.md)
- [Testing](testing.md)
- [Semantic and derived state decision](adrs/0002-separate-semantic-and-derived-state.md)
- [Stable identity decision](adrs/0003-use-stable-semantic-identities.md)

## Pure semantic commands

Commands accept a `ChantDocument` and return a `ChantDocument`. They do not
mutate their input, calculate SVG geometry, manipulate React state, or touch
browser APIs. Accepted edits create new containers only along the changed path
and retain references to unrelated entities where practical.

Current command families cover:

- creating anchored syllables, editing text/boundaries, deleting and reassigning syllables;
- inserting Punctum, Podatus, Clivis, Scandicus, Torculus, Climacus, and Porrectus;
- moving one note vertically;
- moving every note of a neume vertically as one unit;
- deleting one note with normalization;
- deleting a complete neume.

Insertion resolvers calculate unrestricted complete-neume boundaries from musical selection or pointer intent. Their output is semantic intent, not layout.

## Validation, rejection, and no-ops

Commands validate the constraints relevant to their operation. Multi-note
insertion checks integer boundary range, ID
collisions or duplicate note IDs, and neume pitch/cardinality invariants.
Movement refuses results that would violate a neume invariant. Missing IDs,
unchanged lyric text, and duplicate syllable IDs are no-ops.

Rejected and no-op commands return the exact input document object. This
identity convention is important: callers can distinguish “accepted new
document” from “nothing changed” without a second result channel.

All seven insertion kinds, including Punctum, validate their musical inputs
without requiring syllables. No lyric group constrains insertion.

`createLyricSyllable` inserts at a free anchor in semantic order and normalizes
a new first syllable to word start. Text updates reject blank or delimiter-containing
text. `reassignLyricSyllable` rejects crossing/occupied anchors.
`updateLyricBoundary` refuses continuation on the first syllable.
`deleteLyricSyllable` preserves crossed word boundaries without changing music.
Deleting an anchored neume (including final-note deletion) removes its syllable
in the same history action. Surviving anchors never move.

## Identity and normalization

Commands preserve supplied semantic IDs. Moving notes or neumes changes
`StaffPosition` but not entity identity or semantic array position. Unrelated
objects remain shared.

Individual-note deletion delegates to the domain normalization contract:
Punctum disappears, two-note neumes become Punctum, and Scandicus becomes
Podatus. Torculus becomes Clivis or Podatus according to the surviving
contour; deleting its middle note is rejected when equal outer notes cannot
form either two-note kind. Rejection returns the exact document and creates
no history entry. The owning neume ID and surviving note IDs remain
unchanged for accepted normalization. Climacus normalizes to Clivis after
deletion of any note. Porrectus normalizes to Podatus or Clivis according to
survivor order; equal outer pitches reject middle-note deletion with the
same no-op behavior as Torculus. Whole-neume deletion removes the complete
semantic unit.

See the [domain model](domain-model.md#deletion-and-normalization) for exact
normalization rules.

## Document history

`DocumentHistory` stores three semantic collections:

- `past`: accepted earlier documents;
- `present`: the current semantic document;
- `future`: documents made available by undo.

`applyDocumentEdit` invokes an edit once. If it receives the exact present
document back, it returns the exact history object and creates no false entry.
If it receives an accepted candidate, it moves the previous present into
`past`, adopts the candidate as `present`, and clears `future`.

One call represents one semantic action. Inserting, moving, deleting, or
normalizing a complete neume is therefore undone and redone atomically. Undo
moves the last past document to present; redo moves the first future document
to present. Navigation with no available target returns the original history.

`ChantEditor` commonly computes an insertion candidate once, checks its
identity, and then applies that accepted document once. This avoids repeating
an action that allocates stable IDs.

## What history excludes

History stores semantic documents, not a snapshot of the whole interface. It
excludes:

- note or whole-neume selection;
- lyric mode, target, draft, pending boundary, and history-resolution prompt;
- active tool;
- hover point;
- preview geometry;
- layout coordinates or system assignment;
- browser focus and pending focus;
- lyric draft state.

Those values are transient and are reconciled with the restored semantic
document. Keeping them out of history makes undo and redo musical actions
rather than complete UI rewinds.

## Continuous-entry transactions

The lyric workflow computes a semantic candidate through existing commands;
the session records it once. Text and word-boundary changes in one commit are
therefore one undo step. Click navigation and delimiters commit valid drafts
before moving; skips without text do not enter history. Occupied targets never
convert insertion intent into update intent. Stale dirty targets retain their
draft in recovery. Native input undo stays browser-owned; explicit semantic
history resolves a dirty draft through Save / Discard / Cancel. Save then Undo
undoes that newly saved syllable first, making it available to Redo.

Anchor correction calls `reassignLyricSyllable` once for the accepted destination
and records one semantic snapshot. Candidate browsing, rejected/current-anchor
clicks and cancellation add no history. Activation resolves a valid dirty draft
first as its own existing text transaction; Undo after moving restores the anchor
before undoing that earlier text edit. Reassignment preview and the saved Lyrics
context live only in the session reducer, outside `DocumentHistory`.

## Lyric engraving edits

`updateLyricLanguage` changes only the required document language;
`updateLyricAlignment` sets a validated grapheme range or removes it to reset.
Both return the exact original document for unchanged/rejected requests and
preserve music, stable IDs, anchors and unrelated syllables. Text updates reset
manual alignment in the same transaction as the changed text.

The session's `engraving-edit` action records one semantic edit without changing
selection, browser focus requests, tools or lyric drafts. A language change can
therefore coexist with a dirty draft without saving or discarding it. Subsequent
history navigation still uses the existing Save/Discard/Cancel safeguard.
Manual controls are disabled while a text draft/recovery is active; save or
cancel it first. Pending history and anchor-move modes block engraving edits.

## Division commands and explicit score insertion (Stage 5A)

`insertDivision` accepts a validated division and `ScoreInsertionBoundary`;
the entity anchor must match the boundary. `updateDivisionKind` preserves ID
and position; `deleteDivision` removes only the requested entity. Unsupported
kinds, invalid IDs/anchors, collisions, stale boundaries and unchanged edits
return the exact input document. These commands share ordinary semantic
history: each accepted edit is one action and undo/redo restores the exact
music, lyric and division snapshot together.

All seven neume insertion entrypoints delegate to `insertNeume`, accepting
an explicit score boundary or a legacy number. Numeric boundaries containing
divisions or clefs reject ambiguity. Explicit insertion reanchors the preceding subset
of divisions to the new neume, preserving every division's derived order.
Whole-neume and final-note deletion reanchor punctuation before the next
surviving neume or end, preserving the pre-delete score order on convergence.
Other note deletion/normalization and vertical movement preserve division data.
The existing anchored-syllable deletion policy is unchanged.

See the [domain model](domain-model.md#semantic-divisions-stage-5a) for the
boundary/order invariants and [Accepted ADR 0012](adrs/0012-divisions-at-semantic-boundaries.md)
for alternatives. No new selection model or graphical division handling is
implemented in Stage 5A.

## Initial clef transaction (Stage 6A)

`updateClef` validates both clefs and every neume/pitch before constructing a
candidate. It changes the clef and translates the initial governing passage in one history entry,
preserving relative diatonic melody using the mapping in
[Accepted ADR 0014](adrs/0014-preserve-melody-on-initial-clef-edit.md).
Unchanged/invalid clefs, malformed neumes and unsafe integer pitch results return
the exact original document. Lyrics and divisions retain their references;
notes and neumes retain their IDs and contours. Undo/redo restores exact snapshots.

The session's `change-clef` action preserves selection, tools, remembered neume
kind, focus requests and lyric drafts. It clears stale hover geometry and
announces the new type/line and melody preservation. Pending history resolution
and lyric reassignment block the action. Later history navigation still requires
resolution of a dirty lyric draft. Clef edits never implicitly save that draft.

## Explicit clef transactions (Stage 6B)

`insertClefChange`, `updateClefChange` and `deleteClefChange` construct validated
semantic candidates without choosing a pitch policy. `effectiveOffsets` compares
committed and candidate governing offsets by stable neume ID.
`preserveClefMelody` prevalidates safe integer positions and neume invariants,
then translates only affected surviving passages using the shared domain
`clefOffset`. Preserve noteheads commits the candidate with unchanged positions.
Redundant event identities do not constitute a pitch change.

For existing-clef edits/removals, the session owns one `clefTransaction`: original
snapshot, previous selection,
authored ID, insertion boundary or existing target, draft value, and optional
final candidate awaiting confirmation. Draft adjustments never enter history.
Apply compares the final edit with the original document and immediately uses
`clefInsertionPolicy`, the single shared session option for insertion and edits.
Policy changes during a draft never mutate music/history. Unsafe transformations
leave the draft pending with a nonmodal error; changing policy or draft clears
the error for retry. Cancel/no-op preserves the exact history and redo branch.
Deletion alone creates a final candidate awaiting conditional confirmation;
its policy is independent of the shared setting. Unsafe melody translation
keeps deletion confirmation open, permitting Preserve noteheads or cancellation.
Competing semantic actions and history navigation are blocked while a draft or
confirmation is pending; a stale original snapshot cancels rather than applying
to newer music.
There is no generic transaction framework. Undo/redo restores committed snapshots
without reopening pitch confirmation. See [interaction lifecycle](editor-interactions.md#mid-score-clef-placement-and-contextual-editing-stage-6b).

## Direct graphical clef insertion

`place-clef` uses `layoutChant` with the displayed measurement snapshot and the
shared pointer/keyboard clef resolver, then reuses candidate validation and the
existing atomic commit path. The session's `clefInsertionPolicy` defaults to
`melody` and persists across C/F placements, Select and staged edits outside
semantic history. Insertion
applies that selected policy synchronously, never exposing a pending draft or
confirmation. Unsafe arithmetic returns unchanged music/history and a nonmodal
session error; it never falls back to the alternate mode. Each successful
placement records one snapshot and returns to the armed tool. Pending
existing-clef drafts block competing placement but allow changing the shared
policy; deletion confirmation blocks both.

`clef-keyboard` stores only an explicit semantic boundary and staff line in the
transient session. Traversal derives mixed order anew; commit verifies its
current slot. The cursor advances after an inserted clef and never moves an
existing authored clef. Hover, keyboard cursor and the remembered neume tool
remain outside semantic history. Existing-clef edits still use draft/Apply/Cancel.

`step-clef-change` is a narrow entry point into the existing authored-clef
transaction. It validates Select mode, target/exclusivity and line bounds,
starts the draft when needed, and computes each step from its current value.
The first press stages its movement atomically without editing semantic history.
A transient `keepScoreFocus` hint distinguishes arrow entry from the contextual
Edit button; it adds no new transaction or semantic identity. Other targets,
stale drafts, placement and pending deletion cannot be stepped. Apply/Cancel
continue through the existing shared-policy and focus/history mechanisms.

## Persistence boundaries (Stage 7A)

Committed `history.present` changes, including undo/redo, synchronously pass to
the browser adapter outside the pure reducer. Drafts and history stacks are not
serialized. Recovery, confirmed New and validated/confirmed Import create a fresh
`createEditorSession` root rather than an undoable edit. Failed or canceled
imports do not dispatch semantic actions. See [persistence](persistence.md) for
the shared codec, recovery and conflict policy under Accepted ADR 0016.

`updateDocumentTitle` changes only the semantic title, structurally sharing the
rest of the score and returning the original document for unchanged text.
The editable document heading keeps its text draft outside history. Enter or
blur commits the final text through the existing semantic edit/history path as
one undoable, redoable and autosaved change. Escape and unchanged text leave
history and redo untouched. Document actions explicitly resolve an open title
before acting. There is no additional semantic history authority.

## Rhythmic modifier edits (Stage 8A)

`updateMoraScope` targets a stable neume ID with the contextual choices from
`moraChoices`. It changes both affected notes in one immutable snapshot and one
undoable action. Missing, invalid, unsupported and unchanged requests retain
exact document identity. `updateNoteModifiers` retains selected-note episema
editing and validates any single-note mora edit against the same profile.
Off removes optional fields; unrelated notes and the other modifier are shared.
Movement and deletion retain marks on the same surviving note IDs; they never
infer or retarget a pair. Pending workflows retain existing edit guards.

## Authored form edits (Stage 8B)

`updateNoteForm` changes only the selected stable note's optional form, retaining
pitches, kind, tuple order, IDs, lyrics and rhythmic signs. Default removes the
field. Unsupported and unchanged intents return the original document, preserving
history/redo and avoiding autosave. One contextual change or preselected shaped
insertion commits one snapshot through the existing reducer/persistence path.

Normalization checks every surviving explicit form. Deleting Scandicus's first
note may retain its middle Quilisma as Podatus's first note; deleting its final
note rejects because the surviving Quilisma would become an unsupported upper
Podatus note. Deleting the Quilisma itself is allowed. A surviving Quilisma may
not become a one-note unit. Movement keeps forms on their original IDs and
rejects invalid contours. Rejected form-constrained deletions announce why the required partners must
be preserved; authors can first change Form to default before deletion. Invalid
pitch moves are rejected by the neume contour rules, independently of Form;
removing a form does not permit crossing that contour. Any committed document
mutation clears stale form-deletion feedback. Whole-neume
deletion remains atomic. No preceding-neume condition is imposed.

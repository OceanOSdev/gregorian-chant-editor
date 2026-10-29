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

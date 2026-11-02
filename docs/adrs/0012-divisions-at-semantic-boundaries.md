# 12. Order divisions at semantic neume boundaries

Date: 2026-11-02

## Status

Accepted (2026-11-02), following the owner's approval of the semantic boundary
model implemented in Stage 5A and reviewed in
[PR #47](https://github.com/OceanOSdev/gregorian-chant-editor/pull/47).
No accepted ADR is superseded. Acceptance of this architecture is separate from
merging the PR.

Acceptance covers the semantic entities, explicit insertion boundaries, derived
score order, reanchoring rules and semantic history described below. Graphical
engraving and interaction decisions remain deferred to a separate Stage 5B
handoff: division glyphs and controls, visible insertion-side affordances,
selection/focus, spacing, wrapping, and effects on lyric compaction/hyphenation.
This acceptance does not amend ADRs 0008, 0010 or 0011 or claim browser acceptance
of graphical divisions.

## Context

Divisiones are independent non-pitched entities. The owner requires explicit
insertion on either side: A D B can become A X D B or A D X B. Neume indexes
alone cannot distinguish these intents. Existing commands, lyric anchors,
layout and pointer resolvers depend heavily on the separate neume array.

The four initial kinds follow the terminology of the
[Gregorio separation bars reference](https://gregorio-project.github.io/gabc/#separation-bars)
and [tutorial](https://gregorio-project.github.io/tutorial/tutorial-gabc-01.html).
Virgula, rhythmic meaning and engraving dimensions are outside this decision.

## Decision

Retain `neumes` and add required `divisions`, with stable IDs, kind and
`beforeNeumeId` (null means end). The array orders divisions sharing an anchor;
neume order determines the global order of boundaries. Derive a tagged score
stream rather than persisting a redundant event sequence.

An insertion intent names the neume boundary and the division before which to
insert; null division means after all divisions there. Before inserting a neume,
move only the divisions preceding that slot to its new ID. Inserting before D
keeps D before B; inserting after D moves D before X. The same rule handles
multiple adjacent divisions, leading/trailing punctuation and an empty score.
Legacy numeric insertion rejects boundaries occupied by divisions rather than
silently assigning a side.

Deleting a neume transfers its divisions to the next surviving neume or end.
The derived score order before deletion determines relative order at merged
boundaries, with transferred divisions preceding destination divisions.
Normalization preserving a neume ID does not move divisions. Lyric anchors and
the accepted anchored-neume deletion policy remain unchanged.

Kind replacement and division deletion preserve all neighboring entities.
Ordinary immutable semantic snapshots provide atomic undo/redo. Required
collections are runtime validated; malformed data is not interpreted as empty.
There is no persisted format or migration in this stage.

## Consequences

### Positive

- Explicit slots preserve both insertion sides without pixels or stale offsets.
- Existing pitched-neume tuple types and lyric anchors remain intact.
- Stable division identities and derived order can support accessible controls,
  caret previews and layout integration in Stage 5B.
- No parallel history or persisted second ordering authority is needed.

### Negative

- Insertion must reanchor a subset of divisions; deletion must preserve derived
  order when boundaries converge. Focused pure regression tests are essential.
- Existing index-based UI resolvers cannot choose a side. Stage 5B must expose
  explicit slots, render divisions and reconcile selection/focus by stable ID.
- Current layout ignores divisions. Their spacing, wrapping, accessibility and
  interaction with ADR 0011 compaction/hyphenation require a later explicit
  design review; no visible punctuation behavior is claimed here.

## Alternatives considered

A unified `(Neume | Division)[]` stream makes order and insertion naturally
explicit, but replaces the index contract throughout commands, lyric lookup,
layout, wrapping, pointer resolution and fixtures. That broad migration is not
necessary for this focused milestone; a derived tagged stream supplies consumers
without replacing the pitched collection.

A naive `afterNeumeId` marker with numeric insertion alone cannot express both
sides or slots among adjacent divisions. Persistent array offsets become stale.
Persisting both full event order and boundary anchors introduces competing
ordering authorities. Treating divisions as note-less neumes violates accepted
pitched tuple and lyric-anchor assumptions. None is adopted.

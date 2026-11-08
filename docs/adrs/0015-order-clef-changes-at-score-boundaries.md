# 15. Order explicit clef changes at semantic score boundaries

Date: 2026-11-07
Revised: 2026-11-08

## Status

**Accepted by the owner on 2026-11-08.** This decision includes
automatically derived custos engraving and the reviewed mixed-event boundary
rules for Stage 6B. It narrowly qualifies the boundary operations of Accepted
ADR 0012 and the affected range of initial-clef edits in Accepted ADR 0014;
neither record is superseded. Acceptance authorizes a separate Stage 6B
implementation handoff, not an implementation in this documentation PR.

## Context

Stage 6A has one required initial C/F clef and preserves relative diatonic
pitch when it changes (Accepted ADR 0014). Stage 5A/5B represent divisions
independently from pitched neumes and derive their order from explicit
insertion slots (Accepted ADR 0012). Divisions are not linguistic boundaries
(ADR 0013).

This ADR's first draft attached changes only to `finalis` double bars.
That was too restrictive for the notation being targeted. The *Liber
Usualis* introductory rules, p. xviii, describe mid-staff clef changes
and identify *Cum appropinquaret* as an example. A separate GABC
transcription contains three changes after *mihi*, *est*, and *eum* without
an intervening bar. **Source caveat:** the introduction's reference to
"p. 584" does not match the *Cum appropinquaret* score on the inspected
1961 facsimile's page 584 (that page contains *Occurrunt turbae*).
The GABC transcription's provenance is not a verification of that exact
1961 printed page. The historical evidence supports permitting clef
changes without bars; the detailed wrapping rules below are the editor's
proposed engraving choices, not claims of universal printed practice.

References:
- [Liber Usualis introductory rules, p. xviii](https://gregobase.selapa.net/sources/3/17.png)
- [1961 facsimile p. 584, for edition distinction](https://gregobase.selapa.net/sources/3/729.png)
- [Cum appropinquaret transcription](https://github.com/bbloomf/jgabc/blob/master/gabc/8110.gabc)

## Decision

### Semantic entities and slots

- Retain the required ID-less document-initial `Clef` value object.
  Additional explicit changes have stable IDs and C/F clef values
  (staff lines 1–4). Keep `neumes`, `divisions`, and a distinct
  `clefChanges` collection; **do not persist a unified score stream**.
  A clef change is neither a pitched neume nor a division nor a word boundary.
- An explicit change may occur at any **whole-neume semantic boundary**,
  including before, between, or after divisions at that boundary.
  No bar is required. No clef insertion inside a neume/note tuple;
  authoring an initial clef remains a separate control.
- Each explicit clef change stores, conceptually:

  ```ts
  { id, clef, beforeNeumeId, beforeDivisionId }
  ```

  `beforeNeumeId` is the neume following the containing boundary
  (or null for score end); `beforeDivisionId` is the *next* division
  at that boundary (or null for after all divisions, before the neume/end).
  Both IDs must refer to the same boundary. Clef-array order is
  authoritative **only among clefs in the same division slot**;
  division-array order is authoritative among divisions at one
  neume boundary; neume-array order determines successive boundaries.
  No clef ever points to another clef.
- Extend the insertion intent to distinguish both sides of clefs:

  ```ts
  { beforeNeumeId, beforeDivisionId, beforeClefId }
  ```

  `beforeDivisionId` selects the division slot; `beforeClefId`
  selects the next clef in that slot; explicit null means *after* its
  clef run. Validate membership in exactly the specified slot.
  Preserve ADR 0012's two-field division-only semantics for a slot
  with no clefs; if clefs occupy the targeted slot and clef-side
  information is omitted, reject the ambiguous insertion rather than
  guessing. Likewise reject legacy numeric insertion at boundaries
  containing any division or explicit clef.
- Derive score order by traversing neumes and their boundary divisions,
  emitting the ordered clef run before each following division, then
  the final clef run before the neume/end. This derived order, not
  collection order across distinct slots, governs pitches, layout,
  interaction, and insertion targets. Each explicit clef governs
  subsequent notes until the next explicit change, irrespective
  of automatic line wrapping.

### Mutations and surviving-event order

A command must preserve the relative order and stable IDs of all
surviving semantic entities; reanchor only what is necessary to do so:

- **Insert a clef:** insert it at the chosen position inside its clef
  run, with a unique ID; existing events retain their order.
- **Insert a division:** split the containing clef run at the
  selected slot. Preceding clefs reanchor to *before the new division*;
  following clefs remain in the following slot. For example,
  `A C1 C2 B` inserting `D` between clefs yields
  `A C1 D C2 B`.
- **Insert a neume:** split the boundary at the selected point.
  The preceding divisions/clefs reanchor to the inserted neume;
  succeeding events remain before the original next neume, with
  division references recalculated to preserve semantic order.
- **Delete a division:** merge its preceding clef run with the
  immediately following clef run, in their former derived order.
  Deleting or retyping a division does not remove a nearby clef.
- **Delete a neume:** merge the events from its boundary into the
  next surviving neume's boundary or score end, *before* destination
  events, using their previous derived order. Recalculate division
  references. For example, deleting `B` from
  `A C1 B D C2 E` must yield `A C1 D C2 E`, not
  `A D C2 C1 E`.
- **Delete a clef:** remove only that clef entity; other event
  anchors do not need clef-reference repair.
- **Normalize a neume without changing its ID:** preserve all
  its boundary anchors. After any merge, reestablish collection
  ordering within new slots from the **old derived order**, never
  the old global clef-array order.

This is a narrow extension of ADR 0012's division-only
split/reanchoring policy, not a replacement. A division deletion
continues to preserve all surviving neighbors; an explicit clef
has no bar owner and is never cascade-deleted.

Allow leading, trailing, consecutive, and redundant explicit clefs,
including in empty or division-only scores. The required initial clef
remains visible and editable even if a leading explicit clef
immediately overrides it; it may govern zero notes. Preserve every
authored clef ID and order instead of normalizing away unused
or identical values. Validate all ID uniqueness, slot membership,
supported clef values, anchors, and ordered-collection invariants.
No persistent reference cycles are introduced.

### Clef editing, pitch semantics, and history

- Users may insert, change C/F type or staff line, and delete an
  explicit clef. **No free horizontal relocation/dragging of an
  existing clef** is planned in Stage 6B or 6C. Relocation is
  removal followed by insertion at a different explicit boundary.
- Compare **effective clef offsets** for every surviving existing
  note between the committed pre-operation document and final
  candidate. A changed event ID with the same effective offset
  does not trigger a preservation prompt. Notes under a later
  surviving explicit change remain unaffected.
- When an explicit-clef operation changes the effective offset of
  existing notes, offer **Preserve melody** (default) or
  **Preserve noteheads**. Preserve melody translates each affected
  passage using ADR 0014's relative diatonic mapping:

  ```text
  offset(clef) = base(type) - 2 * (staffLine - 1)
  base(C) = 0; base(F) = 3
  newPosition = oldPosition + oldOffset - newOffset
  ```

  Preserve noteheads leaves stored staff positions unchanged,
  reinterpreting their pitches. Preserve note IDs, neume kinds
  and contours, lyric associations and other semantic identities.
  If there are no affected existing notes, omit the pitch prompt,
  but retain an authored redundant or trailing clef event.
- **Initial-clef edits always preserve melody**, as in Accepted
  ADR 0014. In documents with explicit changes, this transform
  applies only to notes governed by the initial clef, before the
  first explicit change. This **narrowly qualifies** ADR 0014's
  "all notes" Stage 6A statement; behavior in documents without
  explicit changes remains identical. Do not add a preserve-
  noteheads mode for initial-clef edits in Stage 6B.
- Stage type/line edits in transient session state with explicit
  **Apply/Cancel**. Multiple arrow/select adjustments affect
  only the draft; they do not mutate the document or history.
  Apply computes the final candidate relative to the original
  committed document, prompts **once** if necessary, and commits
  exactly one snapshot/history entry. A no-op does not prompt or
  create history. Cancel leaves the document, undo stack, and
  redo branch untouched; undo/redo never reopens confirmation.
  Guard against stale pending actions and competing semantic
  edits/history; preserve lyric draft and focus/selection behavior
  consistent with existing editor controls. Precise keyboard,
  Escape, and pending-placement rules belong in the handoff plan.
- Reject an entire operation if candidate note positions or safe
  integer arithmetic are invalid; do not clamp or partially
  transpose outside-staff notes.
- Deleting/retyping a division or deleting a neume leaves the
  effective clef of surviving notes unchanged if relative
  semantic order is preserved; no preservation prompt is needed.

### Measured engraving, system breaks, and derived custos

- Layout consumes the single derived semantic order and effective
  clef at each placement cursor, **not only** a neume index or
  renderer-side guess. Clefs and guides have measured geometry,
  clearance, hit/selection semantics (only authored clefs are
  interactive), overflow behavior, and bounded wrap progress
  within the authoritative music/lyrics/divisions layout pass.
  Exceptional long mixed runs may split with bounded progress;
  do not drop events or introduce an infinite wrapping loop.
- At a continuation system beginning **with an explicit clef
  as its first semantic item**, use that first authored clef
  in the system-leading clef position, preserving its ID and
  control. Later consecutive explicit clefs remain visible
  in order, including redundant ones. Do **not** replace the
  first with the last or draw the old decorative clef as well.
  If a division precedes an explicit clef on that system,
  show the incoming decorative effective clef, then the
  division, then the explicit change; do not move the
  change across the division. The first score system
  always retains the required initial clef, then any
  separately authored leading events in semantic order.
- A preceding bar may remain at the end of its staff
  while a new explicit clef opens the next, subject to
  actual measured fit. A visual system split does not
  insert/remove any semantic bar or clef; non-interactive
  clef repetitions are derived. The exact split is an
  editor layout policy, not asserted as a universal
  *Liber Usualis* pagination rule.
- **Stage 6B includes automatically derived custos/guide
  engraving**, following the *Liber Usualis* principle that
  a guide anticipates the next pitched note. At a mid-staff
  clef change, use a guide before the change to show
  the next note's pitch under the clef in effect at the
  guide's location. At a system end, show the next pitched
  note under the outgoing system's effective clef,
  including when the next system begins with a different
  explicit clef. Do not draw an additional detached
  mid-staff guide for that same transition at the break.
- Derive the guide from the **final committed document**
  (after any pitch-preserving edit), not from provisional
  transpositions or authored notes:

  ```text
  guidePosition = nextNotePosition
                + offset(nextNoteEffectiveClef)
                - offset(clefAtGuideLocation)
  ```

  The guide is pure, nonselectable geometry with reserved
  width and bounds; it is not a semantic neume, pitch
  event, or history entry.
- Omit a guide if no following pitched note exists, if a
  proposed mid-staff guide would duplicate the normal
  end-of-system guide, or for a redundant change whose
  effective offset does not change. For a consecutive
  clef run with no intervening pitched notes, do not
  generate a guide per unused clef; at most one guide
  may introduce the effective clef governing the next
  pitched note where a guide is musically meaningful.
  Also suppress guides in purely trailing or division-
  only passages without subsequent notes. Preserve
  every authored clef regardless of guide suppression.
- Clef and guide clearance must enter the measured
  compaction/hyphen/wrapping walk even within a word.
  Neither changes lyric word/syllable semantics, forces
  hyphens, nor changes ADR 0013's *division-specific*
  compaction exception. Separation is determined by
  actual geometry; do not silently broaden ADR 0011's
  categorical blockers. A clef does not by itself
  cancel future accidentals. B-flats and naturals are
  outside Stage 6B.

### Stage boundaries

Stage 6B covers semantic clef events, expanded insertion
boundaries, pure validation and reanchoring, scoped pitch
transformations, minimal insertion/selection/editing,
measured engraving and guide marks, transient confirmation,
and atomic history. A later Stage 6C may refine graphical
insertion ghosts and vertical editing UX, **not horizontal
clef relocation**. Do not add a generalized persisted
event model, chromatic/absolute pitch representation,
playback, accidental editing, persistence migrations,
new dependencies, or unrelated refactors.

## Review and implementation handoff

The owner accepted this architecture on 2026-11-08, including
mixed-event ordering, system-start clefs, derived custos, and
the documented edge-case policies. A separate implementation
plan must spell out accessible editing/placement controls,
dirty lyric drafts, keyboard/Escape lifecycle, and focused
verification of mixed-event ordering, same-slot insertion,
merging anchors, consecutive/redundant clefs, guide positions
and suppression, system-break replacement, small-width
overflow, cancellation, and exact history restoration.

This documentation PR records the accepted decision but
does not implement Stage 6B. The implementation should begin
only from a separate Git-backed handoff after this ADR is
merged, following `docs/ai-workflow.md`.

## Consequences

### Positive

- Supports the mid-staff clef changes described by the
  *Liber Usualis* without requiring an artificial bar.
- Stable-ID ordering and reanchoring extend ADR 0012
  without another persistent event ordering authority.
- Scopes pitch transformations and UI prompts to the
  notes whose interpreted pitches actually change.
- Supports genuine guide-note engraving while keeping
  guides derived and noninteractive.
- Preserves authored redundant clefs, division semantics,
  lyric anchors, and one-snapshot history.

### Negative

- Mixed clef/division insertion and reanchoring are more
  complex than bar-owned clefs and require targeted tests.
- Extending the insertion boundary with a clef-side
  field requires careful legacy-slot validation.
- Accurate guide geometry, opening-clef substitution,
  overflow, and caret placement add layout work.
- Relative pitch transforms can still expose extreme
  bounds and missing-ledger-line limitations.

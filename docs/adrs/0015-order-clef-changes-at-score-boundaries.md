# 15. Order explicit clef changes at semantic score boundaries

Date: 2026-11-07
Revised: 2026-11-08

## Status

**Proposed — revised musical placement policy; owner review and acceptance
required before Stage 6B implementation.** This is an architecture proposal,
not an implementation authorization. It extends the semantic boundary model of
Accepted ADR 0012 without replacing its separate neume/division collections or
superseding Accepted ADRs 0013 and 0014.

## Context

Stage 6A has one required initial C/F clef and preserves relative diatonic pitch
when it changes (Accepted ADR 0014). Stage 5A/5B represent divisions
independently from pitched neumes and derive their order from explicit insertion
slots (Accepted ADR 0012). Divisions are not linguistic boundaries (ADR 0013).

The first draft of this ADR required each mid-score clef change to be attached
to a double bar (finalis). That restriction reflected a small sample of
graduals but is too narrow for faithful transcription. The *Liber Usualis*
introductory rules, p. xviii, describe mid-staff clef changes and cite the
antiphon *Cum appropinquaret* (p. 584). A separately maintained GABC
transcription of that antiphon includes three clef changes, after *mihi*,
*est*, and *eum*, without an intervening separation bar at those positions.
The transcription is corroborating evidence, **not a facsimile verification
of every glyph in the 1961 page**. See:

- [Liber Usualis introduction](https://www.gregorianbooks.com/gregorian/pdf/IMSLP/1961_The_Liber_Usualis/LU1_Introduction__Preface__et_alia.pdf)
- [Cum appropinquaret GABC transcription](https://github.com/bbloomf/jgabc/blob/master/gabc/8110.gabc)

The editor should therefore not require any bar type before a clef change.
The change remains a musical event, independent of linguistic word boundaries,
system indexes, and the choice of where lines automatically wrap.

## Proposed decision

### Placement, identity, and ordering

- Keep the required initial `Clef` as an ID-less value object. Additional
  explicit C/F clef changes have **stable semantic IDs** and may be inserted
  at **whole-neume score boundaries**, including before, between, or after
  divisions at those boundaries. No preceding `finalis`, `maior`,
  `minor`, or `minima` is required; an explicit change is not itself
  a bar or a lyric/word boundary. No change is inserted inside a neume's
  note tuple. Initial clef editing remains the preferred operation at
  the very beginning of a score.
- Preserve the existing `neumes` and `divisions` collections and their
  ordering authority. Add a separate collection of explicit clef-change
  entities; **do not persist an additional unified event sequence** or
  pixel/system coordinates. A candidate anchor is
  `{ id, clef, beforeNeumeId, beforeDivisionId }`, where
  `beforeDivisionId` identifies the next division at the same neume boundary,
  or null means after that boundary's divisions and before its neume/end.
  When multiple clefs share the same slot, their collection order within
  that slot is authoritative. The exact shape is subject to boundary review;
  all references and orders must be validated.
- Derive one semantic score walk from neume order, division order at each
  neume boundary, and clef positions within those boundary slots. This
  derived order is authoritative for effective-clef lookup, editing,
  insertion targets, and layout. Each explicit clef governs following notes
  up to the next explicit clef change, irrespective of any bar or automatic
  staff break. Do not equate a change of governing event ID with a
  change of pitch interpretation.
- Extend the existing explicit boundary resolver so a user can insert a
  neume, division, or clef on **either side of an existing clef** (and on
  either side of divisions). A logical slot may identify the next
  division-or-clef by stable ID; new storage fields and compatibility
  behavior must be designed without invalidating ADR 0012's established
  division-only slots. In a clef-occupied ambiguous legacy slot, reject
  rather than silently choosing a side.
- Preserve the **relative order of all surviving semantic events** when
  inserting/deleting neumes or divisions, even if their anchoring neume or
  neighboring division disappears. Reanchor only as required to retain the
  derived order; never silently delete or merge a clef. On neume deletion,
  transfer trailing boundary events to the next surviving neume or end,
  preceding destination events in their original semantic order, matching
  ADR 0012's established division policy. A division's deletion or kind
  change does not own, delete, or automatically alter a nearby clef.
  A clef pointing to a deleted division must be reanchored to the next
  surviving slot while preserving order. This proposed extension to
  boundary operations needs dedicated architecture review.
- Allow trailing clefs after the last neume (including division-only/empty
  scores), consecutive clefs without intervening notes, and redundant
  explicit clefs matching the prior effective clef. Retain their IDs and
  authored positions; do not normalize them away. Re-anchoring and
  validation must remain closed under ordinary deletions. Prevent cycles,
  dangling item references, duplicate IDs, and ambiguous event ordering.

### Permitted edits and pitch behavior

- Authors may insert a clef at a valid semantic boundary, change its C/F
  type or staff line 1–4, and remove it. **No free horizontal movement or
  dragging/repositioning of an existing clef is planned**, including
  Stage 6C. To relocate one, remove it and insert another at a chosen
  boundary; this is separate from choosing its original insertion slot.
- When an explicit clef is inserted, edited, or removed, compare the
  effective clef of **each surviving existing note** in the committed
  before/after semantic score. Only notes whose *effective pitch
  interpretation* differs can require adjustment; notes already governed
  by a later explicit clef are unaffected.
- Offer **Preserve melody** or **Preserve noteheads** if existing neumes
  are affected. Preserve melody applies ADR 0014's relative diatonic
  equation independently for each affected passage:

  ```text
  offset(clef) = base(type) - 2 * (staffLine - 1)
  base(C) = 0; base(F) = 3
  newPosition = oldPosition + oldOffset - newOffset
  ```

  Preserve noteheads retains stored staff positions and allows their
  pitch interpretation to change. Keep neume contours, note IDs, lyric
  associations and unrelated divisions unchanged. An event removal that
  leaves identical effective clefs needs **no pitch-choice prompt**, but
  must not be conflated with automatic removal of a redundant event.
- Keep **initial-clef editing melody-preserving as in Accepted ADR 0014**;
  in a score with explicit changes, its affected range stops at the first
  explicit change. The new two-way prompt applies to **mid-score explicit
  clef operations**, not initial-clef edits. This limits ADR 0014's
  original all-neumes transform to the passage actually governed by
  the initial clef without adding a notehead-preserving initial-clef mode.
- A multi-step vertical/type edit is **staged without mutating the
  committed document**, with an explicit Apply/Cancel boundary. On Apply,
  resolve any preservation choice **once** against the original committed
  score and final staged candidate. If the net change is a no-op or has
  no affected notes, do not ask an unnecessary question. Cancel restores
  committed state/history. One confirmed edit plus optional transposition
  yields a **single undo/redo entry**; undo/redo never reopens the prompt.
  Do not commit transient invalid anchors or pitch states. Confirmations
  and pending edits must not race with other semantic commands/history.
- Validate all note positions and safe integer arithmetic before commit.
  Never clamp off-staff notes. Reject the entire unsafe operation without
  partial changes.

### Division edits and line wrapping

- Divisions and clefs are **independent**. Deleting or retyping a bar does
  **not** delete a nearby clef and needs no clef-removal confirmation.
  Affected notes retain their effective clefs if semantic event order is
  preserved. The first draft's bar/clef compound deletion prompt is
  withdrawn. This maintains ADR 0012's neighboring-entity preservation.
- Explicit clef changes are not the automatically repeated system-start
  clefs. The effective clef for each wrapped system must be derived from
  the semantic score walk, including cases with multiple divisions or
  clefs at one boundary and division-only systems.
- If a clef change falls at an automatic system boundary, print the
  **explicit new clef in the leading clef position** with its normal
  selectable identity; do not also draw a redundant decorative copy of
  the old clef. If a preceding bar fits at the end of the previous
  system, it may remain there instead of being forced onto the next
  system with the clef. This is a proposed engraving policy to validate
  against printed examples, not a claim that every historical source
  imposes exactly that wrap.
- At a mid-staff change, consider the **custos/guide** convention shown
  in the *Liber Usualis*; a guide is derived engraving, not an authored
  pitched neume. The implementation review must decide the exact guide
  behavior and Stage 6B coverage against printed sources before coding.
  No rendered glyph may be moved or deduplicated independently of
  measured semantic layout, hit areas, or accessible control identity.
- Use the existing single measured layout/wrapping pipeline for neumes,
  lyrics, divisions and clef geometry. No clef or custos event forces a
  word boundary or changes ADR 0013's division-compaction rule. Clef
  changes alone do not imply accidental cancellation. B-flats and
  naturals remain outside Stage 6B.

### Scope boundary

Stage 6B may add semantic clef entities, boundary-aware insert/edit/delete
commands, validation, derived pitch lookup, engraving, minimal selection
and insertion controls, staged confirmation, and ordinary history. More
polished graphical affordances may be deferred to Stage 6C, **but not
horizontal relocation by dragging**. Do not add a unified persistent
score event array, chromatic/absolute pitch schema, playback, general
accidentals, persistence migrations, or unrelated redesigns.

## Review gate before acceptance / implementation

The following require a focused second architecture pass, not unilateral
implementation decisions:

1. **Boundary encoding and invariants:** Validate the proposed per-slot
   clef ordering, how an insertion boundary distinguishes before/after
   a clef while preserving ADR 0012 division-only behavior, and how
   clefs reanchor after division and neume removal without losing
   authored order. Adjust the illustrative fields if a simpler
   stable-ID boundary model closes all cases. Explain any necessary
   narrow qualification of ADR 0012 explicitly.
2. **Wrapping and guide engraving:** Verify explicit-clef-as-opening-clef
   handling; bar-at-previous-system handling; mid-staff guide placement;
   exceptional long division runs; and semantic control identity. Consult
   actual *Liber Usualis* facsimiles, not only GABC encoding, before
   asserting historical conventions.
3. **Edge-case policy:** Check leading versus initial clefs, trailing
   changes in empty scores, multiple clefs at one slot, and redundant
   edits for unambiguous validation and predictable UI behavior.
4. **Interaction lifecycle:** Specify Apply/Cancel, selection/focus,
   lyric drafts, pending-command lockout, and cancellation for the
   implementation plan without introducing a new history mechanism.

The owner must explicitly accept a final ADR revision before a separate
Codex implementation handoff. This PR remains documentation-only.

## Consequences

### Positive

- Supports the mid-staff clef changes described by the *Liber Usualis*
  without requiring an otherwise unnecessary division.
- Preserves authored division and lyric semantics; avoids unexpected
  cascading deletion of clefs when bars are edited.
- Keeps the existing ID-based, separate-collection architecture and
  the ADR 0014 melody-preservation mapping.
- Reuses the measured wrapping pipeline and single-snapshot history;
  scope stays focused on musical boundaries and observable behavior.

### Negative

- General boundary ordering and reanchoring are more complex than
  a one-to-one finalis/clef attachment and require careful tests.
- The existing two-field `ScoreInsertionBoundary` does not, by itself,
  distinguish both sides of an inserted clef; its resolver must
  be extended while preserving older division behavior.
- Mid-staff guide rendering and system-edge deduplication require
  measured layout and historical review.
- Pitch-preserving edits can still expose missing ledger-line and
  extreme-system-bounds limitations.

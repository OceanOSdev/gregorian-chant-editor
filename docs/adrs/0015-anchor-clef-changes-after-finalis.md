# 15. Anchor mid-score clef changes after divisio finalis

Date: 2026-11-07

## Status

**Proposed — explicit owner review and acceptance required before Stage 6B
implementation.** This proposal extends the score model without superseding
Accepted ADRs 0012, 0013, or 0014. The decisions below are not implemented.

## Context

Stage 6A introduced one required initial C/F clef and Accepted ADR 0014's
melody-preserving global edit. The semantic score stores ordered neumes and
separately ordered, stable-ID divisions at neume boundaries; ADR 0012 derives
their joint order rather than persisting a redundant universal event stream.
ADR 0013 keeps musical divisions independent of lyric word boundaries.

The owner wants additional clef changes when a chant transitions into another
section, without arbitrary horizontal repositioning. The GregoBase examples
reviewed for this milestone showed changes after double bars, particularly
before gradual verses. This motivates a deliberately narrow first profile;
the examples do not prove that other historical placements never occur.

A clef change alters the interpretation of following staff-relative notes.
Authors need a choice between retaining their existing melody and retaining
their written notehead positions. An attached bar may also be edited or deleted.
These interactions must not silently alter or discard music.

## Proposed decision

### Placement, identity, and ordering

- Retain the required document-initial `Clef` as a value object without an ID.
  Additional explicit clef changes have stable semantic IDs.
- Allow an explicit clef change **only immediately after a `finalis` (double
  bar)**, never between arbitrary neumes or after `minima`, `minor`, or
  `maior`. This is an editing constraint, not a claim about all manuscripts.
  Do not derive clef events from automatically wrapped staff systems.
- Associate the change with the **stable ID of its owning finalis**, rather
  than an x-coordinate or a rendered system index. An illustrative shape is
  `{ id, afterDivisionId, clef }`. At most one change belongs to a given
  finalis. The exact property and collection names are implementation details.
- Derive musical order from the existing neume/division model: emit each
  division in its ADR 0012 order, then its attached clef change if present,
  then subsequent music. Do not persist a competing unified event stream.
  A clef applies to all following notes until another explicit clef change.
  A clef event is not a lyric or word boundary.
- When existing neume insertion/deletion reanchors a finalis under ADR 0012,
  its attached clef follows **that same finalis ID**. It is not independently
  reanchored to a neume or silently dropped. The trailing case below still
  needs an owner decision.

### Permitted edits and history

- Authors may insert a C/F clef after an eligible finalis, change its type,
  change its staff line (1–4), or remove it. There is **no horizontal clef
  movement or drag-to-another-boundary feature planned**, including Stage 6C.
  To relocate a change, remove it and insert a new one after another finalis.
- For an edit, insertion, or removal, compute which existing notes would
  receive a different *effective clef* before versus after the operation.
  Only those notes are candidates for a pitch/staff-position change. An edit
  to a middle clef does not change notes governed by a later explicit clef.
  Editing the initial clef in a document with explicit changes similarly
  affects only notes it governs; ADR 0014's full-document rule describes
  Stage 6A's single-clef documents.
- If existing neumes would be musically reinterpreted, ask the author:
  **Preserve melody** or **Preserve noteheads**. For preserve melody, use
  ADR 0014's diatonic mapping, with each affected note's old and new effective
  clefs, to shift its staff position while retaining its relative pitch.
  For preserve noteheads, do not move notes; their interpreted pitches change.
  Both options preserve IDs, neume kinds, lyric links, and unrelated divisions.
- Do not ask for a preservation choice when there are no affected existing
  neumes, or when the effective pitch interpretation is unchanged.
- Preview or stage a multi-step vertical clef edit and prompt **once at the end
  of the gesture**, not for each arrow-key step. Cancellation restores the
  prior state. A confirmed clef operation, including any note transposition,
  produces **one atomic undo/redo entry**. No partial state or intermediate
  history entries are committed.
- Validate all affected staff positions, including integer safety, before
  committing. Do not clamp extreme notes; the existing outside-staff and
  missing-ledger-line limitations remain.

### Deleting or changing an owning bar

- If an author deletes an owning finalis or changes its kind to anything
  other than finalis, the attached clef must also be removed.
- **Confirm this consequence first**, explicitly naming the clef that will
  disappear. Cancel leaves the document unchanged. If existing neumes would
  be reinterpreted, include the same preserve-melody/preserve-noteheads
  choice. If none are affected, still confirm the clef's removal, but omit
  the unnecessary pitch choice.
- Commit the bar change/removal, clef removal, and optional note adjustments
  as one atomic undo/redo operation. Deleting/changing an unassociated bar
  retains the normal existing division behavior.

### Derived engraving and later accidentals

- The effective clef at each automatically wrapped system start follows
  semantic score order, not the system number. Auto-repeated clefs are
  decorative and are not persisted as explicit changes.
- An explicit change at a system boundary must not produce two redundant
  clef drawings; layout must still account for the finalis, clef, notes,
  lyrics, and clearance within the established measured layout pipeline.
- Do not implement B-flats or naturals in this milestone. Future accidentals
  should retain musical meaning when their rendering position changes with
  the effective clef. A clef change is not itself a word boundary or an
  accidental-cancellation event.

### Scope boundary

Stage 6B may include semantic entities, validation, insertion/edit/deletion
commands, derived order, measured engraving, atomic history, and minimal
usable confirmation/selection controls. Polished graphical insertion previews
and drag gestures are later UX work (Stage 6C) **without horizontal relocation**.
No broad pitch-schema rewrite, accidental editor, audio, persistence migration,
or generalized score event stream is authorized by this proposal.

## Open questions for owner review before acceptance

1. **Trailing or empty passage:** If a finalis is at the end of the score
   with no following neume, may it own a clef change in anticipation of
   later composition? What if deletion of the last neume leaves a finalis
   with an attached clef at the end?
2. **Consecutive bars and redundant changes:** If multiple finalis divisions
   occur at the same neume boundary, may each carry a change? Should an
   explicit change identical to the preceding effective clef be rejected as
   redundant, or remain a legitimate notation event?

These questions must be resolved explicitly in the proposed ADR/owner review
before a Codex implementation handoff. The confirmation UI's exact component,
focus handling, and staged keyboard interaction can be specified in the later
task plan without inventing new musical semantics.

## Consequences

### Positive

- Placement matches the narrower observed modern chant usage and respects the
  owner's decision not to support arbitrary horizontal movement.
- Stable division references reuse ADR 0012 order and reanchoring behavior,
  avoiding an independent ordering authority.
- Explicit choice prevents accidental pitch changes or silent clef removal.
  Scoped transformations and atomic history are testable without new pitch data.
- System wrapping derives the correct effective clef from semantic order.

### Negative

- This intentionally excludes clef changes after smaller bars or at arbitrary
  boundaries, which could limit transcription of less common sources.
- Removing/retyping a finalis with a clef requires compound confirmation and
  changes an existing division command's behavior.
- Deferred trailing/redundant-change rules must be resolved before
  implementation, and staged multi-step editing adds transient UI complexity.
- Melody-preserving transpositions can expose existing extreme-pitch clipping
  until ledger-line rendering is improved.

# Architecture Decision Records

This directory contains the project's Architecture Decision Record (ADR) log.
Each ADR captures one significant architectural decision or proposal, its
context, and its consequences.

The lyric relationship decision is [ADR 0008: Anchor lyric syllables to independent neumes](0008-anchor-lyrics-to-neumes.md).

The **Accepted** [ADR 0010: Derive wrapping from combined music and lyric geometry](0010-derive-wrapping-from-music-and-lyric-geometry.md) governs Stage 4B layout and supersedes [ADR 0005](0005-derive-wrapping-from-rendered-geometry.md), which remains in the log as historical context.

The **Accepted** [ADR 0011: Word-aware compact spacing and derived continuation marks](0011-word-aware-chant-engraving.md) introduces a narrow contextual Stage 4C exception to ADR 0010's fixed musical minimum for eligible same-word syllables and governs derived hyphenation. **Both ADR 0010 and ADR 0011 are Accepted**; ADR 0011 qualifies rather than supersedes ADR 0010. Additional editorial hyphen preferences and within-syllable note grouping remain possible future work.

The accepted engraving decision is
[ADR 0007: Share derived neume engraving geometry](0007-share-derived-neume-engraving-geometry.md).

The log uses a Nygard-style ADR format. Contributors may generate new records
with Nat Pryce's [`adr-tools`](https://github.com/npryce/adr-tools), using the
repository-local template:

```markdown
# N. Decision title

Date: YYYY-MM-DD

## Status

Proposed

## Context

## Decision

## Consequences

### Positive

### Negative
```

Additional sections are allowed when they clarify the decision. General
subsystem documentation belongs in the owning guide rather than being copied
into an ADR. Positive and negative consequences are the normal project
structure so trade-offs remain explicit, but an inapplicable category may be
omitted rather than left empty.

For a retrospective ADR, use the date on which the architectural decision was
made when that date is known. Otherwise, use the date the record was written
and identify it as retrospective in the Context.

## Workflow

The repository-level `.adr-dir` points `adr-tools` to `docs/adrs`. The
repository-local `templates/template.md` causes `adr new` to create a Proposed
record with the project's usual Positive and Negative consequence sections.

The tool is an optional user-level utility, not a project dependency.
Contributors may create or edit the Markdown files manually while preserving
the format and numbering.

Common commands include:

```bash
adr list
adr new Decision title
```

Generated records begin as **Proposed** and are discussed through pull requests
or linked GitHub issues before their status is changed to **Accepted**.

Do not use `adr new -s` to draft a proposed replacement because upstream
`adr-tools` immediately marks the referenced decision as superseded. Instead:

1. Create the proposed replacement with ordinary `adr new`.
2. State in its Context or Status that it is intended to supersede the older
   ADR.
3. Discuss the proposal while the existing decision remains Accepted.
4. After accepting the replacement, change the new ADR to **Accepted**, change
   the old ADR to **Superseded**, and add reciprocal links between them.

This manual acceptance step avoids superseding an accepted decision while its
replacement remains only Proposed. Superseded decisions remain in the log
rather than being rewritten.

[ADR 0009: Keep lyric engraving language in the semantic document](0009-document-lyric-language.md)
records the owner-approved Stage 4A language preference without superseding the
existing anchor or wrapping decisions.

[Accepted ADR 0012: Order divisions at semantic neume boundaries](0012-divisions-at-semantic-boundaries.md)
records the owner-approved Stage 5A semantic boundary model. Graphical division
engraving and interaction, including spacing, wrapping and lyric hyphenation
integration, remain deferred to a separate Stage 5B handoff.

[Accepted ADR 0013: Divisions interrupt contextual word compaction](0013-divisions-interrupt-word-compaction.md)
records the owner-approved division exception to contextual compaction. ADR 0011
remains Accepted, narrowly qualified by ADR 0013.

[Accepted ADR 0014: Preserve relative melody on initial clef edits](0014-preserve-melody-on-initial-clef-edit.md)
records Stage 6A's owner-accepted global-clef transform (accepted 2026-11-04).
It does not decide Stage 6B event ordering or boundaries.

[Accepted ADR 0015: Order explicit clef changes at score boundaries](0015-order-clef-changes-at-score-boundaries.md)
records the owner-approved Stage 6B architecture (accepted 2026-11-08):
bar-independent clef placement, mixed-event boundary ordering, scoped pitch
edits, and derived custos engraving. It narrowly qualifies ADRs 0012 and 0014
without superseding them. Implementation follows in a separate handoff.

[Accepted ADR 0016: Persist only versioned semantic chant documents locally](0016-persist-versioned-semantic-chant-documents.md)
records the owner-approved Stage 7A native JSON interchange and browser-local
recovery contract (accepted 2026-11-08). Only committed semantic documents
are persisted; editor transient state and history remain outside the format.

[Superseded ADR 0017: Model rhythmic modifiers on individual chant notes](0017-model-rhythmic-modifiers-on-notes.md)
records the owner-approved Stage 8A note-level puncta morae and horizontal
episemata (accepted 2026-11-09), including safe native v1-to-v2
compatibility. ADR 0016 remains Accepted.

[Accepted ADR 0018: Constrain mora presence to conventional rhythmic patterns](0018-conventional-mora-patterns.md)
supersedes ADR 0017 with single-note presence, supported scopes, derived paired
signs and protected recovery of the withdrawn draft-v2 format.

[Accepted ADR 0019: Represent authored note shapes separately from semantic neume contours](0019-authored-note-forms-and-neume-contours.md)
records the owner-approved Stage 8B authorable Virga, Punctum inclinatum
and Quilisma forms on stable notes, including preselected one-click insertion,
a limited context whitelist and version-3 native-file migration (accepted
2026-11-09). ADRs 0004, 0007, 0016 and 0018 remain Accepted.

ADR 0019's owner clarification after PR #65 reference review allows independent
quilisma-pes authoring without preceding-context validation and selects the
traditional connected three-note Scandicus silhouette. No fusion flag or semantic
kind is added; the original research remains available in the verification record.

[Accepted ADR 0020: Author vertical episema presence; derive its engraving position](0020-vertical-episema-presence-and-derived-placement.md)
records Stage 8C's independent note flag, local derived placement, strict native
v4 compatibility and vertical-tick-only screen rasterization tolerance.
**Owner-approved 2026-11-10.** It narrowly qualifies ADR 0007's screen-rendering
contract; ADR 0007 remains Accepted and is not superseded.

[Accepted ADR 0021: Author B accidentals at neume boundaries with stable note ownership](0021-author-b-accidentals-at-neume-boundaries.md)
records the owner-approved Stage 8D design (2026-11-11): Roman/Solesmes
word/division resets, register-specific derived pitch interpretation,
independent written signs owned by stable B notes, shared repeated-B
neume placement, targeted destructive-clef confirmation and strict
native v5. The owner-approved placement amendment in PR #72 permits a
stable earlier-note engraving anchor, independent of musical B ownership. ADR 0015 is narrowly qualified; no existing ADR is superseded.
Implementation is in PR #72; owner visual acceptance remains pending.

[Accepted ADR 0022: Explicit repeated-note neumes](0022-explicit-repeated-note-neumes.md)
records Stage 9A's fixed written-unison tuples, square-head profile, split-button
interaction and native v6. Its owner-approved none-only mora scope extends
ADR 0018 conservatively; historical expanded mora support remains deferred.
Implementation in PR #74 was owner-accepted on 2026-11-13, based on automated
browser verification and a qualitative reference comparison.

[Accepted ADR 0023: Allow a bounded union of fixed tuples for Pes subpunctis](0023-bounded-tuple-union-for-pes-subpunctis.md)
records Stage 9B-1's one named family with four- or five-note tuples, narrowly
qualifying ADR 0004 (which remains Accepted) and extending ADRs 0007, 0016 and
0018 with native v7. Its owner-approved mora matrix is none or final note
(2026-11-13); final-two remains deferred. Implementation in PR #75 was
owner-accepted on 2026-11-13, based on automated browser verification and
qualitative historical comparisons.

[Accepted ADR 0024: Extend Scandicus and Climacus to bounded three- to five-note tuples](0024-bounded-tuple-union-for-scandicus-and-climacus.md)
records Stage 9B-2 (owner-approved 2026-11-13). The existing kinds become
unions of three-, four- and five-note tuples with count-aware form and mora
rules and native v8. This extends ADR 0023's bounded-tuple qualification of
ADR 0004 to two more named families. Approved decisions:

- the Mocquereau Fig. 34 staircase as the initial extended Scandicus profile;
- a `{none, final}` mora matrix for the longer groups;
- a narrow amendment to ADR 0023, under which Pes subtripunctis deletion
  leaving four strictly descending notes normalizes to a four-note Climacus.

ADRs 0004 and 0023 remain Accepted.

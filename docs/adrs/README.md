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

[Accepted ADR 0017: Model rhythmic modifiers on individual chant notes](0017-model-rhythmic-modifiers-on-notes.md)
records the owner-approved Stage 8A note-level puncta morae and horizontal
episemata (accepted 2026-11-09), including safe native v1-to-v2
compatibility. ADR 0016 remains Accepted.

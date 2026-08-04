# Architecture Decision Records

This directory contains the project's Architecture Decision Record (ADR) log.
Each ADR captures one significant architectural decision or proposal, its
context, and its consequences.

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

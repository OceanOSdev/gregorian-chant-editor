# 4. Use explicit neume types and ordered tuples

Date: 2026-07-26

## Status

Accepted

## Context

The supported neumes have different note counts, pitch ordering, normalization,
engraving, graphical entry, and accessible descriptions. Those invariants need
to remain visible across the domain and every exhaustive consumer.

This ADR was written retrospectively to record a decision already reflected in
the implementation.

See the [domain model](../domain-model.md#supported-neumes-and-tuple-order) for
the current shapes.

## Decision

`Neume` is a discriminated union of explicit Punctum, Podatus, Clivis, and
Scandicus interfaces. Each kind uses a fixed-cardinality tuple in semantic
order:

- Punctum has one note;
- In a Podatus, the first note is lower than the second;
- In a Clivis, the first note is higher than the second;
- Scandicus is three strictly ascending notes.

TypeScript expresses tuple cardinality. Runtime validation also checks
cardinality and pitch ordering because data can be malformed outside correctly
typed construction.

Kind-specific behavior is handled exhaustively across domain helpers,
commands, layout, interaction, rendering, and accessibility.

Graphical placement remains a separate explicit whitelist; a semantic kind is
not automatically placeable.

## Consequences

### Positive

- Invalid cardinality and order are harder to represent in typed code.

### Negative

- Consumers must deliberately handle every semantic kind.
- Adding a semantic kind requires coordinated updates and tests across
  exhaustive seams.

## Alternatives considered

One arbitrary note-array shape would make cardinality, tuple order, and
kind-specific rules implicit. Consumers would rely on length checks and
conventions instead of a discriminant and precise tuple type.

## Subsequent evolution

Torculus was later added as another explicit three-note neume type under the
same decision. The current supported shapes are documented in the
[domain model](../domain-model.md#supported-neumes-and-tuple-order).

# 4. Use explicit neume types and ordered tuples

Date: 2026-07-26

## Status

Accepted

## Context

The supported neumes have different note counts, pitch ordering, normalization,
engraving, graphical entry, and accessible descriptions. Those invariants need
to remain visible across the domain and every exhaustive consumer.

See the [domain model](../domain-model.md#supported-neumes-and-tuple-order) for
the current shapes.

## Decision

`Neume` is a discriminated union of explicit Punctum, Podatus, Clivis, and
Scandicus interfaces. Each kind uses a fixed-cardinality tuple in semantic
order:

- Punctum has one note;
- Podatus is lower then higher;
- Clivis is higher then lower;
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

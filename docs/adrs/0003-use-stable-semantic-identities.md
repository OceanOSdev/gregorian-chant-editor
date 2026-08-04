# 3. Use stable semantic identities

Date: 2026-07-26

## Status

Accepted

## Context

Neumes and notes may be selected, moved, normalized, re-rendered, or reassigned
to another system after reflow. Syllables are referenced from neumes and edited
independently. These relationships must survive array reconstruction and React
rendering.

See the [domain model](../domain-model.md) for entity ownership and lookup.

## Decision

Lyric syllables, neumes, and notes receive stable string IDs. Neumes refer to
syllables by ID and own notes with their own IDs.

Layout copies neume and note IDs into derived data. Selection and pending focus
store IDs. Commands preserve IDs for surviving entities, including a neume and
its surviving notes after normalization. History preserves the complete
semantic snapshots containing those IDs.

Value objects that do not need continuity do not receive IDs merely because
they are represented by an interface.

## Consequences

### Positive

- Selection and focus can resolve an entity after reflow or re-rendering.
- Layout can be discarded and regenerated without losing semantic identity.
- React and SVG can use semantic IDs for stable keys and data attributes.

### Negative

- ID generation, preservation, and collision handling become explicit
  responsibilities of constructors and commands.

## Alternatives considered

Array indexes are temporary positions and can change after insertion,
deletion, or system repartitioning. Rendered object or DOM identity changes
when React mounts or reparents elements. Neither is a suitable substitute for
semantic identity.

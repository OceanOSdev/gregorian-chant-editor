# 2. Separate semantic and derived state

Date: 2026-07-26

## Status

Accepted

## Context

Musical meaning must survive rendering changes, responsive scaling, automatic
reflow, and transient editor interactions. Pixel geometry, system membership,
selection, focus, and pointer state change for reasons that do not constitute a
musical edit.

This ADR was written retrospectively to record a decision already reflected in
the implementation.

See the [architecture overview](../architecture.md) for current layer
responsibilities.

## Decision

`ChantDocument` is the canonical semantic representation and contains no
layout, SVG, React, DOM, or editor state.

`layoutChant` derives systems and score geometry from the current document.
Selection, active syllable, tools, hover, previews, focus requests, and lyric
drafts remain transient editor state. Document history stores semantic
documents only.

## Consequences

### Positive

- Reflow and responsive rendering do not alter semantic content.
- Pure commands and layout are testable without a browser.
- Undo and redo restore musical actions without rewinding incidental UI state.

### Negative

- Transient selection and focus must be reconciled by stable semantic identity
  after a document change.
- Layout must be recomputed when semantic input changes.

## Alternatives considered

Storing pixel coordinates or system assignment in `ChantDocument` would couple
musical data to current engraving and wrapping. Storing selection, focus,
tools, or drafts in semantic history would make undo restore incidental
interface state. Both alternatives conflict with the current pure data flow.

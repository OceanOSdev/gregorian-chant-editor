# 9. Keep lyric engraving language in the semantic document

Date: 2026-11-01

## Status

Accepted by the owner in the updated Stage 4A handoff plan.

## Context

Latin-script text alone cannot reliably select Latin versus English alignment
rules. The owner explicitly approved the document language design in
[the Stage 4 plan](../plans/stage-4-lyric-engraving.md#approved-document-language-design-for-4a).
This record captures that approved decision; it does not replace ADRs 0002,
0005, 0007 or 0008.

## Decision

Require one document-wide `lyricLanguage` engraving preference: Latin, English,
Greek or explicitly unspecified. New chants explicitly use Latin; unknown
runtime values fall back to unspecified. Do not infer language or add
per-syllable language fields. Language and optional per-syllable grapheme-range
editorial alignment overrides participate in semantic history; measured pixels
remain derived. Owning contracts live in the [domain guide](../domain-model.md)
and [layout guide](../layout-and-rendering.md).

## Consequences

### Positive

- Alignment intent survives undo/redo and is independent of browser locale.
- Unspecified/unsupported text has a predictable fallback, with manual control.
- Existing anchor ownership and music-only wrapping remain intact.

### Negative

- Mixed-language chants require editorial overrides.
- Conservative rules fall back frequently; platform fonts still vary.
- All typed document constructors must provide a language explicitly.

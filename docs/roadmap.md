# Roadmap and current limitations

## Scope

This document separates current limitations from possible future work.
Roadmap items are non-binding, have no promised order or date, and may change.

## Related documents

- [README](../README.md)
- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Layout and rendering](layout-and-rendering.md)
- [Editor interactions](editor-interactions.md)

## Current limitations

- Engraving uses placeholder square noteheads, connectors, and a letter C clef.
  It is not publication-quality chant typography.
- The semantic vocabulary contains only Punctum, Podatus, Clivis, and
  Scandicus.
- Graphical entry uses fixed contours for those four whitelisted kinds.
- Lyrics center the whole SVG string and have no vowel-aware typography,
  automatic hyphenation, collision avoidance, word-spacing logic, or
  continuation marks.
- Systems wrap automatically from measured geometry, but there are no manual
  system breaks, pagination controls, or alternate wrapping policies.
- There is no persistence layer or persisted document format. Consequently
  there is no document schema version yet.
- There is no GABC import/export or other interchange adapter.
- There is no backend.
- The test suite has no DOM, React component, or browser automation
  environment. Actual focus, pointer, tab-order, event, clipping, and responsive
  behavior require manual checks.

## Possible future work

- Expand the modern square-notation neume vocabulary.
- Improve notehead, connector, clef, ledger-line, and spacing engraving.
- Add vowel-aware lyric alignment and lyric spacing/collision behavior.
- Add explicit manual system breaks.
- Define versioned local persistence.
- Add GABC import and export adapters around the internal semantic document.

Automatic measured multi-system wrapping, graphical placement on rendered
systems, active-syllable clamping across systems, hypothetical post-reflow
previews, and the removal of an explicit global semantic creation cap are
current behavior, not roadmap items.

Features excluded by the repository's current scope rules are not implied
commitments merely because they are technically possible.

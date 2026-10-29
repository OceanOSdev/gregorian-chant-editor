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

- All seven initial neume kinds use the project square-notation conventions;
  the clef is still a letter C.
  See [drawing metrics](engraving-metrics.md) for exact choices and extrapolated
  intervals beyond the reference coverage (Porrectus ribbons through Δ5,
  explicit Climacus spacing cases through Δ4). This is not complete publication-quality
  chant typography; extreme pitches can exceed fixed vertical system bounds.
- The semantic vocabulary contains Punctum, Podatus, Clivis, Scandicus,
  Torculus, Climacus, and Porrectus.
- Graphical entry uses fixed contours for those seven whitelisted kinds.
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
systems, independent musical insertion across systems, hypothetical post-reflow
previews, and the removal of an explicit global semantic creation cap are
current behavior, not roadmap items.

Features excluded by the repository's current scope rules are not implied
commitments merely because they are technically possible.

## Lyric redesign stages

Stage 1 introduced independent music and unique ordered syllable anchors. Stage 2
provides continuous Lyrics mode, scoped L activation, underscore skipping,
commit-on-navigation, explicit replacement, occupied-anchor pauses, end-of-music
resumption and draft/history recovery. Anchor-correction UI remains Stage 3;
generated hyphens remain Stage 4. No persistence migration is required.

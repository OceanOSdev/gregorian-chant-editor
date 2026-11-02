# Roadmap and current limitations

## Scope

This document describes the `one-shot-test` implementation probe. The owner asked
for autonomous design extrapolation on a throwaway branch; implemented experiments
are not accepted product commitments or a recommendation to merge the whole branch.
The [probe plan](plans/one-shot-test.md) records its inferred scope. Roadmap items
remain non-binding, with no promised order or date.

## Related documents

- [README](../README.md)
- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Persistence and interchange](persistence-and-interchange.md)
- [Layout and rendering](layout-and-rendering.md)
- [Editor interactions](editor-interactions.md)
- [Experimental playback](playback.md)

## Implemented probe workflow

The branch connects the existing seven-neume editor to new/example documents,
title and C-clef editing, validated version 1 JSON files, one browser recovery
copy, strict-subset GABC interchange, passive SVG export and browser printing.
The responsive workspace adds visual neume tools, selection controls and zoom.
The listening probe adds equal-note browser playback, transport controls, tempo,
volume, octave and a presentation-only moving note highlight. Its interpretation
is documented in [experimental playback](playback.md), while ADR 0006 stays Proposed.

The app also enables experimental measured lyric clearances, word gaps,
conditional hyphens and outgoing cross-system continuation marks. This policy
can expand vertical bands and the score viewport for oversized content. The
accepted music-only layout remains the default API behavior and is available
through the app's comparison toggle. [ADR 0010](adrs/0010-experiment-with-lyric-aware-layout.md)
is Proposed and leaves [ADR 0005](adrs/0005-derive-wrapping-from-rendered-geometry.md)
Accepted.

## Current limitations

- The semantic vocabulary remains Punctum, Podatus, Clivis, Scandicus, Torculus,
  Climacus and Porrectus with a document-wide C clef. Bars, accidentals, ornaments,
  in-score clef changes and other neumes/traditions are not modeled.
- Graphical entry uses fixed initial contours; individual pitch edits preserve
  the selected kind's invariants. See [drawing metrics](engraving-metrics.md) for
  the project shapes and interval extrapolations. The vector clef and notation
  are not complete publication-quality chant typography.
- Lyric alignment uses explicit-language spelling heuristics and optional manual
  grapheme ranges, not pronunciation inference or automatic syllabification.
  Platform fonts affect measured geometry. Experimental clearances and hyphens
  need broader visual and musical evaluation; legacy music-only layout can still
  allow lyric collisions and extreme-pitch clipping.
- There are no manual system breaks, authored page breaks, alternate score sizes
  or full justification. Browser printing breaks between passive systems and can
  shrink oversized content to page width.
- JSON files have explicit size, collection and pitch limits. Browser recovery
  is one site-local semantic copy, not a library or durable backup; drafts and
  history are not persisted. See the [file contract](persistence-and-interchange.md).
- GABC supports only the documented subset and rejects unsupported constructs.
  It omits editorial alignment and regenerates IDs. It is not a general Gregorio
  compatibility layer.
- Playback is an equal-note organ-like listening aid, not vocal synthesis or
  chant-rhythm interpretation. Audio controls and timing are not persisted.
  Accidentals, expressive phrase shaping, MIDI/audio-file export and broader
  performance engines are not implemented.
- There is no backend, account system, cloud storage or collaboration, and no
  dedicated PDF export engine.
- Vitest has no DOM or component environment. Separate Chromium drivers exercise
  actual browser behavior; they do not establish Firefox or spoken screen-reader
  acceptance. [Testing](testing.md) owns verification requirements and records.

## Possible future work

- Evaluate which probe workflows and architecture choices should be adopted,
  revised or removed as separate, reviewable milestones.
- Broaden notation vocabulary and interchange only with corresponding semantic,
  engraving, validation and editing contracts.
- Refine font/ink-aware lyric metrics, justification, hyphen density, oversized
  fallback behavior, and cross-browser/assistive-technology acceptance.
- Evaluate the playback probe’s pitch reference, equal-note interpretation and
  browser behavior before adopting it or adding more musical interpretation.
- Design explicit manual system/page controls and a durable document library if
  those become agreed product requirements.

Features excluded by the repository's scope rules are not implied commitments
merely because they are technically possible.

## Lyric redesign stages

Stages 1–3 provide independent musical order and lyric anchors, continuous lyric
entry, and constrained anchor correction. Stage 4A provides explicit document
language, measured vowel alignment and manual grapheme segments.

The original staged [Stage 4 plan](plans/stage-4-lyric-engraving.md) remains a record
of the methodical main-project path. This separately authorized probe explores
4B/4C-like spacing and continuation behavior without claiming those planned
milestones have been reviewed or accepted. Broader 4D acceptance remains open.

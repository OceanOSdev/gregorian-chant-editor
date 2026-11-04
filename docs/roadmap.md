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
  C/do and F/fa clefs now use original SVG contours.
  See [drawing metrics](engraving-metrics.md) for exact choices and extrapolated
  intervals beyond the reference coverage (Porrectus ribbons through Δ5,
  explicit Climacus spacing cases through Δ4). This is not complete publication-quality
  chant typography; extreme pitches can exceed fixed vertical system bounds.
- The semantic vocabulary contains Punctum, Podatus, Clivis, Scandicus,
  Torculus, Climacus, and Porrectus.
- Graphical entry uses fixed contours for those seven whitelisted kinds.
- Lyrics support measured vowel/manual alignment and minimum clearances.
  Stage 4C introduces contextual same-word composition, conditional hyphens
  and outgoing continuation marks under Accepted ADR 0011 (PR #45 merged).
  Safe musical geometry can still prevent joining. Exceptionally oversized
  lyrics require local horizontal scrolling. ADR 0010 remains Accepted.
- Systems wrap automatically from measured geometry, but there are no manual
  system breaks, pagination controls, or alternate wrapping policies.
- There is no persistence layer or persisted document format. Consequently
  there is no document schema version yet.
- There is no GABC import/export or other interchange adapter.
- There is no backend.
- Vitest runs pure TypeScript tests without a DOM or React component-test
  environment. Separate standalone drivers exercise the real editor in Chromium
  (CDP) and Firefox (BiDi), including native input, DOM/ARIA, geometry and
  responsive checks; these drivers are outside Vitest and hosted CI. See the
  [testing guide](testing.md) and [Stage 4D evidence](verification/stage-4d/README.md).
  Headless automation is distinct from foreground manual keyboard/zoom/IME
  testing and spoken screen-reader verification. The owner reported successful
  non-screen-reader manual workflows without itemized scenarios/environment;
  speech remains Not run and detailed 320px usability signoff is uncaptured.

## Possible future work

- Expand the modern square-notation neume vocabulary.
- Refine notehead, connector, clef, ledger-line, and spacing engraving.
- Revisit word-continuation hyphen aesthetics and whether authors should be
  able to prefer a hyphen at a particular syllable boundary, e.g. historical
  `audi-ti-óne` versus geometry-derived `auditi-óne`. This is a future
  editorial/domain/UI decision, not part of ADR 0011's accepted baseline.
- Investigate tighter intra-syllable spacing or musical grouping for repeated
  successive notes, such as `et(hh)` in the Requiem gradual, without changing
  current first-note vowel alignment or globally compressing music.
- Add explicit manual system breaks.
- Define versioned local persistence.
- Add GABC import and export adapters around the internal semantic document.

Automatic measured multi-system wrapping, graphical placement on rendered
systems, independent musical insertion across systems, local caret/ghost
previews, and the removal of an explicit global semantic creation cap are
current behavior, not roadmap items.

Features excluded by the repository's current scope rules are not implied
commitments merely because they are technically possible.

## Lyric redesign stages

Stage 1 introduced independent music and unique ordered syllable anchors. Stage 2
provides continuous Lyrics mode, scoped L activation, underscore skipping,
commit-on-navigation, explicit replacement, occupied-anchor pauses, end-of-music
resumption and draft/history recovery. Stage 3 provides explicit constrained anchor
correction with pointer and keyboard targeting. Stage 4 supplies generated hyphens.
No persistence migration is required.

Stage 4A provides explicit document language, measured vowel alignment and manual
grapheme segment overrides. Stage 4B is merged: measured lyric clearance and whole-neume wrapping share one derived
layout, with local scrollable overflow only for unbreakable oversized text.
ADR 0010 is Accepted and supersedes ADR 0005 following owner review.
Stage 4C composition was merged in PR #45 and its baseline visuals were
owner-accepted; ADR 0011 is Accepted as a narrow qualification of ADR 0010.
Stage 4D's verification milestone merged in PR #46, with the
[verification report](verification/stage-4d/README.md) recording automated results
and a qualitative owner report of successful non-screen-reader visual, keyboard
and editing checks. Individual manual scenarios and environment/zoom were not
itemized. Spoken screen-reader checks remain **Not run**; detailed 320px usability
signoff is uncaptured, and ordinary score text/targets remain small. Completion
does not imply comprehensive accessibility verification.

## Division stages

Stage 5A (PR #47 merged) supplies semantic divisions and explicit insertion
boundaries under Accepted ADR 0012. Stage 5B (PR #48 merged) implements four staff-relative bar forms, persistent
placement, explicit before/after neume insertion, stable-ID selection/focus,
kind replacement/deletion and semantic history in the measured layout.
Accepted ADR 0013 blocks contextual compaction across divisions without changing
linguistic boundaries or forcing hyphens. Extremely long punctuation runs may
split across systems after bounded progress; normal phrase-ending bars stay
with the preceding neume. Stage 5C’s verification milestone is complete with
qualitative owner acceptance (2026-11-02): the owner tested division workflows
in foreground Firefox and reported no issues needing fixes before merge.
The [Stage 5C record](verification/divisions/stage-5c.md) separates this report
from headless results. Individual scenarios, browser version, OS and viewport/zoom
details were not supplied; detailed 320px/actual-zoom usability and the Firefox
headless HTML activation gap are not separately verified by that report.
Small responsive notation remains a limitation. Screen-reader and foreground
IME testing remain **Not run**; completion does not imply comprehensive
accessibility or publication-quality engraving. PR #49 has not been merged.

## Clef stages

Stage 6A implements initial C/F clef engraving and melody-preserving type/line
editing, with selection, keyboard movement and atomic history.
[Proposed ADR 0014](adrs/0014-preserve-melody-on-initial-clef-edit.md) records the
implemented relative diatonic rule and awaits owner review. Glyph appearance
also requires owner acceptance before merge. Extreme pitches retain the fixed
vertical bounds and absent ledger-line limitations.

Stage 6B remains deferred pending a separate proposed ADR and owner acceptance
of mid-score event ordering, boundary/deletion rules and downstream pitch
preservation. Stage 6C's graphical insertion, horizontal movement and dragging
are also deferred. No persisted clef-change collection or new boundary model
is implemented in Stage 6A.

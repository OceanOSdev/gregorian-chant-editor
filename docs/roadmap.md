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
- Stage 7A provides one browser-local active document and native JSON (v2 writes, v1/v2 reads)
  interchange. See [persistence](persistence.md). Storage is best-effort; export
  files for backups. No document library or cloud synchronization is provided.
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
- Consider explicit future schema migrations as the semantic vocabulary evolves.
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
[Accepted ADR 0014](adrs/0014-preserve-melody-on-initial-clef-edit.md) records the
owner-accepted relative diatonic rule. The shared-C-body F engraving has also
received owner acceptance. Extreme pitches retain the fixed
vertical spacing and absent neume ledger-line limitations.

Stage 6B is **completed and merged via [PR #60](https://github.com/OceanOSdev/gregorian-chant-editor/pull/60)**. It implements [Accepted ADR 0015](adrs/0015-order-clef-changes-at-score-boundaries.md)
(owner-approved 2026-11-08), following the _Liber Usualis_ investigation.
Explicit clef changes may be inserted at whole-neume semantic boundaries
**without a preceding bar**. Independent clefs and divisions use derived
score order and an extended stable-ID insertion boundary; deleting a division
does not delete its nearby clef. Explicit-clef insertion and staged edits share
a preselected pitch mode, with no preservation popup on insertion or Apply.
Deletion retains its conditional pitch choice; the initial clef
remains automatically melody-preserving within its governing passage.
Stage 6B includes automatically derived custos at mid-staff changes and
staff endings, with effective-clef-aware guide pitches and measured wrapping.
Custodes now carry measured short ledger lines outside the staff; guide ink
can extend the canvas vertically. This does not add neume ledger support or
vertical system collision handling.
The graphical C/F tools with snapped ghosts and direct clicks, keyboard slot
placement with a remembered preselected pitch policy and no insertion prompt,
existing-clef Up/Down arrow editing with staged Apply/Cancel using the shared mode, scoped
initial edits, measured clefs/custodes and atomic history are implemented.
See the [completed historical plan](plans/stage-6b-mid-score-clefs-and-custos.md)
and [verification record](verification/mid-score-clefs/README.md). Remaining
foreground keyboard, engraving and accessibility checks are recorded separately
from milestone completion; merge does not imply comprehensive manual verification.
Stage 6C may refine cosmetic polish and vertical editing, but **free horizontal clef movement is not
planned**. Native save/load was introduced in Stage 7A; Stage 8A writes v2 with v1 compatibility. There is no accidental support,
playback, or general neume ledger-line support.

## Rhythmic note modifiers (Stage 8A)

Completed (owner-accepted 2026-11-09). Implementation and engraving were accepted
in PR #64; merge remains an owner action.

Stage 8A implements conventional mora (single-note and final-pair signs) plus
automatic horizontal episema on all seven supported neumes, with atomic history,
measured shared ink and native format v2. Exact v1 files and the existing v1
browser autosave slot remain recoverable; new saves write v2. See
[Accepted ADR 0018](adrs/0018-conventional-mora-patterns.md),
[persistence](persistence.md) and [verification](verification/note-modifiers/README.md).
Vertical episema/ictus, accidentals, manual orientation/spacing, authored bridges,
across-neume joins, new neume kinds and playback remain deferred.

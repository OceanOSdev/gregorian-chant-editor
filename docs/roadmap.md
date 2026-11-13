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
- Stage 7A provides one browser-local active document and native JSON (current v7 writes, exact v1–v7 reads)
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
planned**. Native save/load was introduced in Stage 7A; Stage 8A writes v2 with v1 compatibility. Stage 8D adds B accidental support; there is no broader accidental vocabulary,
playback, or general neume ledger-line support.

## Rhythmic note modifiers (Stage 8A)

Completed and merged in [PR #64](https://github.com/OceanOSdev/gregorian-chant-editor/pull/64)
(owner-accepted 2026-11-09).

Stage 8A implements conventional mora (single-note and final-pair signs) plus
automatic horizontal episema on all seven supported neumes, with atomic history,
measured shared ink and native format v2. Exact v1 files and the existing v1
browser autosave slot remain recoverable; new saves write v2. See
[Accepted ADR 0018](adrs/0018-conventional-mora-patterns.md),
[persistence](persistence.md) and [verification](verification/note-modifiers/README.md).
Accidentals, manual orientation/spacing, authored bridges,
across-neume joins, new neume kinds and playback remain deferred.

## Additional authored note shapes (Stage 8B)

**Completed and merged (owner-accepted 2026-11-09)** in
[PR #65](https://github.com/OceanOSdev/gregorian-chant-editor/pull/65).
The owner completed manual acceptance of the new note shapes and localStorage
recovery verification. PR #65 was merged on 2026-11-09.

Stage 8B provides one-click standalone Virga and Punctum inclinatum,
preselected one-click quilismatic Podatus/Scandicus, and contextual form editing.
Scandicus uses the traditional connected construction; independent quilisma-pes
is an intentional authoring allowance. New saves write v3 while exact v1/v2
readers and protected draft recovery remain. See the
[completed plan](plans/stage-8b-authored-note-shapes.md),
[Accepted ADR 0019](adrs/0019-authored-note-forms-and-neume-contours.md) and
[verification and owner acceptance](verification/note-shapes/implementation.md).
Forced orientation, generic fusion and other new forms remain deferred.

## Post-Stage 8B follow-ups (non-blocking)

These are separate follow-up items, not blockers for the completed Stage 8B:

1. **Blocked-autosave warning visibility.** Improve the visibility of warnings
   when incompatible cached documents block autosaving. Preserve original-source
   recovery, strict version compatibility and confirmed replacement safeguards.
2. **Extreme-pitch SVG viewBox investigation.** Continue investigating the
   pre-existing extreme-pitch viewBox issue and a focused rendering policy.
   [The reproduced cases](verification/note-shapes/review-follow-up.md#separate-extreme-pitch-finding)
   preserve stored pitches and bytes; any later fix must retain semantic/native
   compatibility.

## Authored vertical episemata (Stage 8C)

**Completed (owner-accepted 2026-11-10).** Final engraving and contextual
note-editing UX are owner-accepted; PR #67 was merged on 2026-11-10.
Selected-note Off/On authors independent ictus presence on all seven kinds and
supported forms, with measured automatic local placement and native v4 writes.
Exact v1/v2/v3 readers and protected recovery remain; the bundled Pater Noster
was subsequently updated to owner-authored native v4 with five vertical episemata. See the [plan](plans/stage-8c-vertical-episemata.md),
[Accepted ADR 0020](adrs/0020-vertical-episema-presence-and-derived-placement.md)
and [reference/verification evidence](verification/vertical-episemata/README.md).
The contextual panel consolidates Form, Mora scope and both episema controls.
ADR 0020 is Accepted, including the narrowly scoped screen rasterization
qualification to ADR 0007; canonical geometry and print remain unchanged.
No rhythmic inference or manual side override is included. Manual vertical-episema
orientation overrides, blocked-autosave warning improvements and extreme-pitch
layout issues remain deferred/separate follow-ups. See the
[final comparison and verification record](verification/vertical-episemata/rasterization.md).

## Stage 8D implementation awaiting owner review

Authored B-flats/naturals, independent glyph editing, register-specific scope,
earlier-note placement, chromatic clef preservation and strict native v5 are
implemented on the Stage 8D branch. The historical placement gate is resolved by
amended ADR 0021. [Actual verification and acceptance limits](verification/b-accidentals/implementation.md)
separate automated/browser evidence from remaining owner visual review. Broader
accidental vocabulary, regional rules and playback remain outside scope.

## Repeated-note neumes (Stage 9A)

**Completed (owner-accepted 2026-11-13)** in PR #74. Explicit Bistropha and
Tristropha, with the Punctum family split control, follow the
[plan](plans/stage-9a-repeated-note-neumes.md) and
[Accepted ADR 0022](adrs/0022-explicit-repeated-note-neumes.md). New saves write
native v6; exact v1–v5 readers reject the new kinds, and older builds cannot
read v6 files. Acceptance rests on the recorded automated Chromium/Firefox
verification and qualitative historical engraving comparison. Foreground owner
interaction and screen-reader testing were not performed. See the
[verification record](verification/repeated-note-neumes/README.md).
Mora is none-only by owner approval. This limits authoring scope and makes no
claim about historical practice. Broader repeated-note mora patterns await a
future sourced investigation. Historical stropha forms, bivirga/trivirga and
Stage 9B remain outside this milestone. Separate follow-up maintenance: repair
or retire the `lyric-anchors` and `lyric-move` browser drivers, which were
already failing before Stage 9A.

## Pes subpunctis (Stage 9B-1)

**In review.** Pes subbipunctis and Pes subtripunctis as one bounded semantic
family with a Podatus split control, following the
[plan](plans/stage-9b1-pes-subpunctis.md) and the **Proposed**
[ADR 0023](adrs/0023-bounded-tuple-union-for-pes-subpunctis.md). New saves
write native v7; exact v1–v6 readers reject the new kind. Mora is
**provisionally none-only** pending the owner's decision on the sourced
[mora gate](verification/pes-subpunctis/README.md#mora-gate); this cannot merge
until that gate is resolved. Extended Scandicus/Climacus, other subpunctis
families, intra-syllable fusion and the complete Kyrie XI remain later work.

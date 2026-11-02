# Plan: Stage 4D — final lyric engraving acceptance

Branch: `test/stage-4d-acceptance`
Target: `master`
Baseline: `46b1d597277d428b20231301c3b3306d13bd3a01` (PR #45 merged)
Status: **verification delivered; owner acceptance pending**. See the
[Stage 4D verification report](../verification/stage-4d/README.md) for actual
results and outstanding foreground checks. No new engraving feature or ADR is authorized.

## Problem and definition of done

Stages 4A–4C are merged:

- 4A: lyric-language preference, measured vowel/nucleus alignment and manual
  grapheme-range overrides;
- 4B: unified measured music/lyric clearances, whole-neume wrapping,
  exceptional locally scrollable oversize and consistent pointer layout;
- 4C: conditional same-word neume compaction, derived same-system hyphens and
  outgoing continuation marks, interaction-safe ownership clipping.

ADR 0007, 0008, 0009, 0010 and 0011 are **Accepted**. Stage 4D is an
**acceptance audit**, not a license to redesign those contracts. We need
cross-browser visual and real-input evidence that the complete lyric
workflow works after those changes, an honest accessibility assessment,
targeted regression fixes where genuine defects appear, and a final
owner signoff. It is not a requirement for perfect historical chant engraving.

## Read before implementing

- `AGENTS.md`, `docs/ai-workflow.md`, `docs/testing.md`.
- `docs/plans/stage-4-lyric-engraving.md` (original 4D outline),
  `docs/plans/stage-4c-word-composition.md` (completed historical handoff);
  `docs/roadmap.md`, `docs/verification/README.md`.
- `docs/editor-interactions.md`, `docs/domain-model.md`,
  `docs/commands-and-history.md`, `docs/layout-and-rendering.md`,
  `docs/architecture.md`, `docs/adrs/README.md`.
- All relevant Stage 4A–4C verification records and browser drivers under:
  `docs/verification/vowel-alignment/`,
  `docs/verification/lyric-spacing/`,
  `docs/verification/word-composition/`,
  `docs/verification/continuous-lyrics/`,
  `docs/verification/lyric-move/`.
  Existing records (especially early 0.4-em Stage 4C screenshots) are
  **historical**. Never mistake them for current master results.

No new ADR is expected for verification. If testing exposes a _material_
change needed to an accepted semantic, alignment, music spacing, hyphen
or selection contract, stop and bring evidence/options back to the owner;
do not silently revise ADR 0010/0011.

## Scope: audit first, then focused fixes

### 4D.1 — Inventory and acceptance matrix

- Create a **single durable Stage 4D verification record**, e.g.
  `docs/verification/stage-4d/README.md`. Classify each important
  behavior as covered by current pure tests, a current runnable browser
  driver, foreground human testing, or a known gap. Link actual
  commands/files and revision being tested.
- Prefer running/reusing and, if necessary, repairing _existing_ browser
  drivers. Consolidate duplicate tests only if doing so clearly
  improves maintenance; do not replace them with a new broad framework.
- Track each result as **Pass / Fail / Not run / Not supported**,
  including browser/version, operating system, viewport/zoom,
  tester/method, date, and evidence. Never turn an automated assertion
  into an unqualified claim of screen-reader or foreground focus testing.

### 4D.2 — Visual and responsive acceptance

Exercise actual rendered scores with representative Stage 4 cases:

- `Al ... leluia ah` with intervening music and a true word boundary;
- `Kyrie eleison`, `Gloria`, `Miserere`, `Deo` and the
  eight-word/five-arrangement Stage 4C corpus as useful;
- reference-informed `au / di / ti / ó / ne` and
  `et(hh) lux(h) per...pé...tu...a` cases, using the saved fixtures
  and honestly documented approximations;
- same-word joins versus actual spaces, wide neumes, multi-note kinds,
  melisma across systems, outgoing and non-outgoing hyphens,
  a full-staff near-edge hyphen, distinct-word breaks;
- exceptionally long, left/right-overhanging syllables and local
  horizontal scrolling without clipped characters or compressed glyphs;
- language choices Latin/English/Greek/unspecified, manual segment
  override, accented characters and combining graphemes; if metrics
  vary with fonts, document the variation rather than freezing glyph
  coordinates.

At minimum test Chromium and **Firefox** at a desktop width (roughly
1440 px), a 320 px viewport, plus a meaningful zoom or font substitution.
Verify relative musical and lyric geometry: no painted ink collisions;
no selection/focus/preview decoration drawn over adjacent glyphs;
separate words distinguishable; hyphens legible, inert and owned by
the correct system; no page-wide horizontal overflow for an
oversized score. Review actual screenshots **as editorial evidence**,
not pixel-difference golden files.

Preserve the owner-approved **good-enough** geometric word composition.
Current `auditi-óne` versus GregoBase `audi-ti-óne`, and wider
spacing between repeated puncta in `et(hh)`, are _documented future
refinements_, **not** Stage 4D failures. Do not change hyphen thresholds,
global music spacing, neume kinds or lyric anchor policy solely to
imitate a reference image.

### 4D.3 — Interaction and keyboard audit

On the real editor, including after score reflow and font loading:

- Keyboard-only navigation: natural Tab/Shift+Tab through controls
  and SVG syllable/note targets, correct Enter/Space activation,
  visible **focus distinct from semantic selection**, no trapped focus,
  Escape returns to selection from placement/Lyrics, and no document
  shortcuts stealing typing/IME composition in inputs.
- Lyrics workflow: continuous entry, `_` skipping, explicit
  `Starts word` / `Continues word`, edit with `L`, save/cancel/
  discard, occupied-anchor handling, deleting focused versus selected
  syllables, reassignment/move target preview, and history/undo/redo
  preserving semantic IDs and corresponding visible focus.
- Musical editing: insertion/preview/commit and seven-kind note and
  whole-neume selection/movement/deletion; compact hit ownership
  and Shift selection; focus restoration after system wraps;
  pointer-to-SVG conversion and caret placement while locally scrolled.
- Real pointer tests in addition to pure geometry unit tests. Check
  click targets, clip paths, selections, and move-preview cues at
  compact boundaries and 320px. Verify different user input paths
  resolve to the **displayed measured layout**, not music-only layout.

Use automated browser checks where feasible, but explicitly include
**foreground Firefox keyboard/manual testing**. Past headless Firefox
BiDi pointer checks did **not** validate foreground Tab/focus or
speech output. If a local automation environment cannot drive those,
supply a short executable owner checklist and capture the owner's
actual result; never claim it passed by inference.

### 4D.4 — Accessibility acceptance

- Review role, name, accessible state and reading order for note,
  neume and syllable controls; score summary, placement and Lyrics
  instructions, selected/focused state, and announcements after
  edits/errors. Inspect browser accessibility information when
  available; test actual focus and keyboard in the foreground.
- Confirm generated hyphens, hover ghosts and selection decoration
  remain non-focusable, aria-hidden/pointer-inert and do **not** add
  spoken syllables or duplicate word continuation in accessibility.
- Check that keyboard-only use does not depend on mouse hover,
  focus cues remain visible on the light background and are not
  obscured by scroll clipping/selection, and that zoom/narrow layouts
  retain usable controls.
- **Screen-reader testing is distinct** from DOM/ARIA inspection.
  Where an actual local screen reader (e.g. Orca on Linux) is
  available, perform an explicitly documented foreground test of a
  representative score and lyric editing flow. If unavailable, mark
  **Not run**, explain the limitation, and request owner review of
  that remaining risk. Never claim WCAG conformance or comprehensive
  screen-reader compatibility from a static scan.
- Fix genuine accessibility defects within existing feature
  contracts. For broad semantic redesign or a new accessibility
  architecture, stop and present a scoped follow-up proposal.

### 4D.5 — Reliability, docs, and closeout

- Inspect font readiness, invalid/partial metrics, rerender/focus
  recovery, stable IDs and undo/redo after reflow, repeated
  long-score edits and multiple-system scrolling. Assess obvious
  hangs, console errors and runaway layout behavior. If testing
  performance, record scenario, hardware/browser and measurements;
  **do not invent a performance budget** or add heavy profiling tools.
- Fix only reproducible Stage 4 regressions and high-value
  accessibility/interaction faults. Add focused pure/browser tests
  for each fix with a causal regression example and rerun affected
  suites. Prefer small, reviewable commits by logical change.
- Update `docs/testing.md` with reproducible current commands and
  the final Stage 4D acceptance record. Update owning guides only if
  verified behavior actually changed.
- Audit stale statuses/links in _current_ documentation. Keep dated
  PR-specific verification records historically accurate; if their
  old claims could mislead, add a short "historical" note or link
  from the current index rather than rewriting old observations.
- `docs/plans/lyric-system-redesign.md` explicitly calls for removal
  when the complete Stage 4 has been accepted. Include its
  retirement in the final 4D closeout **after** verifying its
  durable decisions are in ADRs/owning guides. Update the
  overarching Stage 4 plan and any retained handoffs to completed
  at owner acceptance, or propose removal of obsolete one-off plans.
  Do not delete historical research images or audit evidence
  merely because a milestone ended.

## Exit criteria and deliverables

- All 4A–4C invariants and new 4D regressions pass relevant pure
  tests and applicable real-browser checks; all actual failures
  are fixed or individually reported with severity and reproduction.
- A **foreground Firefox keyboard/focus checklist** exists and
  results are recorded by whoever actually performs it, preferably
  the owner. This is a distinct signoff from headless BiDi testing.
- Accessibility coverage and screen-reader availability are stated
  precisely. Any untested assistive-technology risk is made explicit
  for the owner's final decision; no false "all accessible" claim.
- Visual evidence covers mixed joined/hyphenated text, real word
  boundaries, compact selection cues, multi-system continuation,
  responsive views and exceptional overflow. No screenshots serve
  as hard-coded pass/fail goldens.
- A final verification report gives a **pass/fail/not-run matrix**,
  reproducible commands, environment, links to relevant evidence,
  known limitations, deferred editorial improvements, and an
  explicit owner acceptance checklist.
- Stage 4D **does not automatically become Accepted** just because
  CI passes. The owner reviews visual and interactive results and
  signs off on any remaining manual or screen-reader limits.
  No new ADR unless a material accepted contract truly changes.

## Verification and delivery

Run `npm run format:check`, `npm run lint`, `npm test`,
`npm run build`, and `git diff --check`. Run relevant existing
browser drivers sequentially (they share ports/tabs) in Chromium and
Firefox where available. Capture what actually ran; don't copy prior
PR test counts or screenshot dates as new evidence. Use temporary
directories for generated screenshots/JSON; retain only selected
review evidence where useful. Do not commit local profiles, font
files, transient screenshots, test caches, or secrets.

Work on this branch, open a PR against `master`, and report:
(1) verified and fixed regressions, (2) actual automated/manual
results, (3) owner foreground Firefox checklist still needed,
(4) remaining assistive-technology limits and deferred polish,
(5) final cleanup proposal.

**Stop before merge.** Do not introduce new neume types, notation
import/export, playback, persistence, pagination, manual system
breaks, word entities, authored pixel offsets, a new hyphen UI,
a new automated syllabifier, or a broad engraving redesign.
Stop and ask the owner for a design decision if acceptance exposes
a conflict with ADR 0007/0008/0009/0010/0011.

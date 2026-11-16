# Plan: Stage 11B — Dynamic vertical system layout

Branch: `feat/dynamic-vertical-layout`
Target: `master`
Base: `3d5a93f8c5c8bd4024e0ffe6a476fdc3a754fda7` (PRs #91 and #92 merged)
Status: owner-approved design; implementation pending.

## Problem and goal

The completed [Dominican Salve Regina](../../src/editor/examples/Salve-Regina-Dominican.chant.json)
has a punctum at position -3 on Je of Et Jesum. Stage 11A draws its ledger
at -2, but the fixed lyric baseline can collide with the note. High and low
ink can also intrude into adjacent systems. Make system heights and lyric
baselines depend on content, preserving ordinary spacing and all semantics.

[ADR 0028](../adrs/0028-compose-before-vertical-lyric-clearance.md) is the
owner-approved dependency and engraving policy. Follow the existing
[layout contract](../layout-and-rendering.md), [engraving metrics](../engraving-metrics.md),
[Stage 11A plan](stage-11a-neume-ledger-lines.md) and
[verification record](../verification/neume-ledger-lines/README.md).

## Agreed design

### 1. Compose horizontally once

Use a common canonical local staff origin for all composed systems. Keep
the existing walker, horizontal musical minima, intra-syllable and same-word
compaction, division exceptions, lyric width and vowel alignment, wrapping,
oversized progress, continuation marks and structural event ordering.
Preserve exact ordinary x geometry and wraps where no removed lyric exclusion
was involved. Remove baseline-dependent AccidentalLyricBox from score geometry
construction, the preceding-lyric accidental shift, and lyricBandAccidentals
reservations and hyphen exclusions. Audit all callers and tests; remove dead
helpers/types only when no legitimate callers remain. Preserve musical
collision clearance, actual accidental occupied width, default prefixes,
explicit placement/owner distinction, clef/register interpretation and
accidental-to-anchor alignment. Low accidental cases may deliberately change
width, hyphenation and system membership. Do not horizontally optimize after
vertical measurement or iterate to convergence.

Retain current lyric-to-lyric clearance, measured text extent policy and
font-readiness behavior. Hyphen separation depends on the resulting horizontal
gap and structural boundaries, not musical signs in the lyric row. Preserve
outgoing hyphen reservations and oversized text. Music-only provisional
horizontal composition remains until the full measurement snapshot is ready.

### 2. Measure local vertical requirements

Introduce a focused pure module (e.g. system-vertical-layout.ts) rather than
growing layout-chant.ts into another monolith. Resolve the local staff origin,
shared lyric baseline, occupied extents and height from the composed system.
Keep the canonical staff scale, default baseline 180, minimum height 220 and
gap 24. Measure complete musical bounds, including initial/mid-score clefs,
staff, divisions, custodes, neume body, ledgers, rhythmic signs and accidentals.
Use actual musical ink, not pointer padding, selection outlines or ghosts.

Use a single conservative lyric ascent/descent band (20/5 units initially,
matching existing 20-unit font), with explicit minimum music-to-text clearance
(proposed 3 units, the existing sign-band clearance). Preserve ordinary
baseline and dimensions when sufficient. If measured browser text (including
accented Latin, descenders and hyphens) exceeds the band, expand the metric
contract or conservative bounds; do not claim collision freedom using
underestimated bounds. Keep unmeasured/provisional lyrics vertically safe.
All lyrics/hyphens on a system use the same baseline. A lyricless system
requires no new lyric clearance, but still retains minimum height. Account for
high ink above the staff by adding top room and moving staff/lyrics together;
preserve ordinary top/bottom padding. Add height only where required by ink,
text and clearance. Keep inter-system occupied regions separated. Explicitly
document formulas, clearance and coordinate frames.

### 3. Bound exceptional geometry

Stage 11A's offStaffCanvasMargin (1,200 units) remains a rendering safeguard.
Use bounded renderable musical extents relative to the canonical 220-unit
system before computing expansion; no pitch-proportional unbounded height.
Retain real semantic pitches and full derived geometry where needed, and
compact ledger runs. Clip exceptional musical ink (including huge ribbons,
stems, ledgers, accidentals, custodes and associated hit/outline regions) at
a consistent per-system musical render band. Do not allow clipped ink to
intrude into lyrics or neighboring systems. The band must translate with the
system and not simply use the full canvas; preserve near-staff ledger phase
and bounded DOM work. Excluded distant pointer targets must not intercept
other systems. Keyboard editing remains possible; don't promise accurate
engraving for arbitrary safe-integer coordinates. Preserve horizontal
text-relative canvas limits, uncapped legitimate text, and outgoing-hyphen
containment from PR #91. Derive final canvas from resolved systems, text
and bounded ink, not fixed index * advance or full extreme extents.

### 4. Position and consume systems

Stack systems sequentially using measured heights and existing minimum gap.
Keep public ChantLayout/ChantSystemLayout child geometry score-absolute.
Expose authoritative staff origin, lyric baseline and extent/height metadata
as needed. Prefer centralized positioning/translation or rebuild through
existing builders at resolved origins; avoid inconsistent SVG path strings,
bounds, ledger coordinates, note anchors, hit shapes, modifiers, accidentals,
slots, divisions, clefs/custodes and text. Do not introduce scattered
coordinate corrections in ChantEditor.tsx or ScoreSvg. Reuse shared musical
geometry for committed and preview figures. Ghosts do not trigger reflow;
commit may expand the affected system and move later systems.

Audit all fixed vertical assumptions (systemHeight, systemVerticalAdvance,
firstSystemBottomStaffY, firstSystemLyricBaselineY and arithmetic equivalents)
in layout, rendering, graphical neume/clef/division insertion, system hit
mapping, lyric placement/move, selection/range outlines, focus/reveal/scroll,
accessibility and printing. System lookup must use actual bounds and preserve
existing gap/boundary ownership where applicable. Use the actual staff
origin for pitch mapping; no change to permitted first-pitch entry range.
Preserve ID-based selection and focus, including after reflow, viewport resize,
font readiness, undo/redo and document load.

## Scope exclusions

No native schema change (v10), semantics, editing commands, accidental
interpretation, IDs, history, clipboard, new neume family, new lyric alignment
option, new division variant, print-specific pagination feature or general
editor refactor. Preserve bundled Salve Regina source exactly, including the
remaining intentional engraving approximations. No horizontal re-engraving
beyond removing lyric-baseline-dependent accidental exclusions. Do not fix
unrelated historical browser failures without owner agreement.

## Acceptance and verification

- Unit tests: ordinary in-staff geometry and baseline/height/gap unchanged;
  multiple ordinary and variable systems, empty/lyricless systems, low
  punctum at -3 and ledger -2, low compound/modifier ink, high neumes and
  high/low custodes, clefs/divisions, shared baseline and measured clearance,
  descenders, provisional fonts and hyphens. Test exact boundary clearance,
  no overlap, no extra growth when not needed, resize/reflow determinism.
- Low flat/natural specimens: own and preceding syllable, leading and
  interior explicit anchors, continuation/hyphen cases, same-word and word
  spacing, signs at a system wrap. Compare with music-only geometry and
  demonstrate that moving the lyric baseline cannot affect x or membership.
  Retain existing musical clearance, owner/anchor semantics and pitch
  interpretation. Update only obsolete lyric-exclusion assertions, explain
  each changed expectation; retain old coverage for unrelated cases.
- Verify absolute geometry consistency across all forms, paths, note anchors,
  ledger runs and hit areas. Verify variable-height system mapping, graphical
  placement/commit, reflow after transposition, focus/range/lyric move, clef
  insertion and print. Exercise a later system after an expanded predecessor.
- Extreme safe-integer fixtures from 11A (including extreme-ribbon-continuation)
  and opposing high/low adjacent systems: bounded dimensions/work, clipped
  musical/interaction ink, usable subsequent notes and keyboard edit/undo,
  valid text overflow and no loss of normal ledger ink. No per-ledger-level
  loops or DOM nodes. Test near clipping boundaries.
- Real examples: unchanged Kyrie XI and other ordinary layout snapshots
  except explicitly identified affected cases. Load the actual bundled
  Salve Regina; check Et Jesum at desktop and narrow widths, shared lyric
  baseline, ledger, the entire score including concluding O melismas,
  anchored accidental at Nobis, all text visible, later-system interaction.
  Verify import/export and clipboard still preserve the score.
- Add a dedicated dynamic-system browser driver and run it in Chromium and
  Firefox at desktop and narrow (320px) widths. Run affected existing
  drivers (ledger lines, clefs, divisions, accidentals, continuous lyrics,
  vowel alignment, graphical placement, multi-system, range/selection,
  lyric move/spacing, sticky/focus, clipboard, modifiers, bundled examples,
  print where available). Inspect runner inventory; use actual supported
  browser combinations. Broad layout change warrants full browser preset
  both browsers where practicable; document exact runs, revisions and
  unsupported/skipped cases. Reproduce any alleged pre-existing failures on
  clean base rather than silently accepting new failures.
- Standard gate: format:check, lint, test, build, git diff --check, runner
  tests. PR #92 had a transient 5,038ms timeout in the exhaustive extended
  Scandicus/Climacus test; rerun passed. If needed, give intentionally
  expensive parameterized tests a targeted documented timeout (e.g. 30s),
  not global weakening or reduced coverage.
- Foreground owner acceptance: load Salve Regina, inspect Et Jesum and
  adjacent systems, resize, insert/select/transpose/undo in later system,
  compare normal score and print preview. Provide exact steps and screenshots
  where useful. Report actual checks, limitations and no claimed screen-reader
  or print verification unless performed.

## Documentation and gates

Update layout-and-rendering, engraving metrics, architecture/interaction
guides as affected, roadmap and ADR index. Link ADR 0028 from ADR 0021 as a
narrow qualification; keep existing accepted ADRs intact. Record Stage 11A
owner acceptance/merge and Stage 11B actual status, not unperformed checks.
Add a verification record with before/after evidence and explicit policy
for clipped extreme ink. If a significant conflict arises (e.g. inability
to remove exclusions while preserving the approved musical placement or
safe clipping without changing semantic interaction), stop and present
options to the owner; do not add an iterative solver or silently redefine
scope. Ordinary implementation details do not need a separate gate.

## Delivery

Read AGENTS.md and relevant accepted ADRs. Implement on this branch, preserve
unrelated local changes, run verification, commit and push. Open a PR against
master; confirm PR head and remote head match, report revision, actual
results, deviations and remaining owner acceptance. Do not merge.

# Stage 11A — derived neume ledger lines

Status: implemented on `feat/neume-ledger-lines` (master merged in at
fef1d33, PR #90); owner review of PR #91 at 121d8b3 accepted the
architecture, engraving choices and canvas margin (see
[owner decisions](#owner-decisions-after-pr-91-review)); awaiting foreground
visual acceptance. Agreed 2026-11-15 as the 11A ledger / 11B dynamic
vertical layout split. The implementation record, checks and deviations are
in [the verification record](../verification/neume-ledger-lines/README.md).
Base: master at 404b84a318cb25aa6f09a67cd0365f116d6be1eb (PR #89 merged).

## Motivation and evidence

The owner's Dominican Salve Regina transcription reached Et Jesum and
exposed two separate limitations: the low A has no ledger line and its
ink overlaps the lyric. This stage fixes the missing line, not the vertical
collision. Stage 11B will address the latter without changing pitches.

- [GregoBase #4577](https://gregobase.selapa.net/chant.php?id=4577),
  Completorium O.P. (Suarez), 1949, pp. 119–120.
- [GABC](https://gregobase.selapa.net/download.php?format=gabc&id=4577)
  contains `(c4)` and `Et(d) Je(a)sum,(cd ;3)`.
  In our coordinate system these are Punctum 0, Punctum -3, Podatus [-1, 0].
  The low A on Je requires the ledger at -2; neither other neume does.
  The GABC is corroboration of pitch, not a source for line dimensions.
- [Liber Usualis (1961), Rules for Interpretation, p. xvij](https://electronicsandbooks.com/edt/manual/Sheet%20music/Composer/G/Gregorian%20Chant/Liber%20Usualis/LU1_Introduction__Preface__et_alia.pdf),
  section I, The Stave: supplementary lines are used outside the four-line
  staff, with at most one on either side in that described convention.
  Clef changes accommodate wider ranges. This is a conventional notation
  reference, not a restriction to impose on our existing document model.
- Existing `src/editor/layout/custos-geometry.ts` already counts ledger
  levels and represents a run compactly. Preserve its dimensions and output.
  No external font, outline, TeX setup, or additional research gate required.

## Scope and proposed product decisions

1. Ledger lines are derived engraving from constituent pitches, not authored
   objects. No IDs, document edits, palette tools, independent selection, lyric
   boundaries, native schema changes, or new pitch restrictions. Preserve
   effective pitches, clef behavior, history, clipboard, and existing v10.
2. Staff lines are 0, 2, 4, 6; positions -1 through 7 need none. For p <= -2
   require -2, -4, ... through the last even position at or inside p; for
   p >= 8 require 8, 10, ... through the last even position at or inside p.
   Both line and outer-space notes include every intervening level.
   Use arbitrary existing supported integer pitches; multiple ledger levels
   are an intentional editor extension, not a historical Solesmes claim.
3. Proposed metrics: thickness 1.5 layout units, 3 units overhang on each
   side of the constituent's pitch-bearing column (same constants as custos).
   A normal 12-unit square head has an 18-unit ledger. Use actual horizontal
   pitch-bearing footprint for diamonds, reduced terminals and special
   heads; never the full bounding box of a long stem, tail, ribbon, or
   connector. For Porrectus-family ribbon endpoints use the nominal
   endpoint columns (ordinary 12-unit cell about the musical anchor), not
   the first constituent's long selection region. For other unusual heads
   explicitly document the chosen column and compare visually.
4. At each required level, union overlapping/touching horizontal intervals
   within a single neume. Do not bridge a positive gap between disconnected
   components, unrelated adjacent neumes, or structural boundaries. A
   stacked pair shares its common line where intervals overlap. Repeated
   note groups and offset compound figures follow the same rule. Keep
   ledger ink behind note ink, with no extra semantic connector, no duplicate
   strokes and no selection/hit target for a ledger. Use existing score
   color; do not make ledger lines appear as rhythmic episemata.
5. All supported families and authored forms (including liquescents) must
   work. Palette icons are staffless silhouettes: retain their prior
   appearance and dimensions; provide a clear body-only geometry path or
   explicit staffless option, not a second engraving implementation.
6. Keep graphically clickable first-pitch placement range unchanged
   (-1..7). A default multi-note figure may extend beyond that range and
   its ghost must display correct ledgers. Existing keyboard pitch movement,
   import, clef translation and copy/paste can create farther positions.
   Do not add new placement controls or silently clamp pitches.
7. Stage 11A preserves fixed system height, staff origins, lyric baseline,
   system gaps, and the vertical placement policy. It must not claim to
   solve the Je lyric collision or adjacent-system collisions. Include
   all new ledger/ordinary off-staff ink in outer canvas extents so it
   is not clipped at the first/last system; retain baseline canvas bounds
   for ordinary scores. This outer clipping correction is not dynamic
   system spacing.

These are proposed engraving choices for owner visual acceptance, not a
claim that every printed edition uses these exact dimensions.

## Architecture and integration

Read the relevant owning documents and current source before editing:
`docs/layout-and-rendering.md`, `docs/engraving-metrics.md`,
`docs/roadmap.md`, `src/editor/layout/custos-geometry.ts`,
`src/editor/layout/neume-geometry.ts`, `neumes/shared.ts`,
`note-modifiers.ts`, `accidental-geometry.ts`, `layout-chant.ts`,
`graphical-placement.ts`, `src/editor/rendering/ScoreSvg.tsx`,
`NeumeInk.tsx`, and palette icon callers.

### Shared ledger math and compact representation

Extract the common count / first-and-last-level calculation into a pure
staff-relative module. Keep existing custos API/output and tests compatible.
Avoid dependency cycles between staff metrics, shared geometry and ledger
utility. Do not duplicate ledger thresholds in renderers.

Important: the model accepts distant integer positions and has no practical
musical range cap. Do NOT allocate an array, path command, loop iteration,
or DOM element per ledger level. Preserve the compact-run approach already
used for custodes. A run can represent x interval, first/last y, count and
spacing; use a bounded number of runs (based on constituent count, not
pitch distance). For merging, partition by the distinct ledger depth
thresholds of the constituents separately above/below the staff. In each
band the contributing columns are constant; union their x intervals and
emit compact regular runs. Adjacent bands with identical intervals may
coalesce. No duplicate overlapping paint at a common level. Use a
compact SVG pattern or equivalent, stable unique IDs per score/preview
instance, correct local phase and canonical thickness. No per-line DOM
expansion. Preserve ordinary custos rendering/geometry and avoid
unrelated refactoring. Test distant safe pitches using bounded count,
no NaN/Infinity and no unbounded rendering work; do not claim to repair
all existing extreme coordinate/browser limitations.

### Geometry contract

All ledger geometry is produced from the shared neume builder, using
nominal staff positions and pitch-bearing columns, not rendered DOM
measurements or bounding-box extrema as pitch. The builder's body
recipes remain unchanged. Choose either an explicit derived run field
with measured bounds/obstacle helpers, or a suitable bounded geometry
representation integrated into shared ink; audit all consumers and
explain the choice. Never pretend a run's entire envelope is filled ink
when testing note-level collision. Ledger ink must contribute to complete
occupied bounds and advance, wrapping, fit checks, compaction,
selection/range outlines, canvas, and accidental clearance. Preserve
note/head selection contours, note hit bounds, note IDs, anchor relationships
and lyric anchor definitions. Ledger lines alone do not get a target or
tab stop; paint behind neume body, decorative/aria-hidden/pointer-events none.
Do not include new lines in individual note highlight contours.

Integrate after authored body geometry, before modifier/accidental
collision resolution as appropriate. Horizontal and vertical episemata
and mora must not be confused with or overlap ledger strokes; written
accidentals must clear relevant ledger ink and remain independently
selectable. Test same-level and adjacent-level signs, first-note marks on
liquescents, and above-note/prefix accidentals. If a run is separate from
ink arrays, update collision/bounds consumers explicitly; use analytic
regular-line overlap queries, not expansion or blanket blocking of the
whole run envelope. Avoid moving marks unnecessarily or silently dropping
any valid mark. Preserve existing spacing and mark placement when no ledger
is required; tests should assert geometry, not just presence.

The public builder currently normalizes `leftX` as the leftmost complete
ink edge. Retain that contract with ledger overhang, including prefix
accidentals and leftward modifier fallback; verify one-pass correction or
use an explicit measured offset. Measure and rebuild from the same complete
geometry for horizontal fit, lyric composition, boundary insertion, and
wrapping. A ledger may make a neume wider or shift its whole geometry
within the allocated ink box; do not change relative pitch/lyric anchors
or head shapes. Where an anchor is intended to follow the pointer (ghost),
use its measured offset from complete bounds, not a hardcoded head half
width; clamping at staff edges remains allowed. Check first-system/start
clearance and existing compact-boundary ownership/hit clipping.
Existing first-head anchor and byte-identical geometry should remain for
cases requiring no ledger. Do not globally alter 33-unit ordinary gap,
6-unit contextual clearance, accidental semantics or lyric rules.

Render committed and ghost runs with the same geometry, including
translucent preview and print. Palette icons explicitly omit the ledger
decoration even when their staffless synthetic pitches would trigger it.
Check high and low canvas edges and multiple systems; keep Stage 11B
unresolved vertical collisions visible in documentation.

## Verification and acceptance

Add focused unit tests for ledger math at -5..10 and distant positions,
count/top/bottom/phase; ordinary custos regression. Test each family and
authored form in staff, low, high, and crossing a staff edge; multiple
depths, line/space, repeated notes, stacked and offset heads, ribbon
endpoints, diamonds, and all three liquescent figures. Assert exact
required levels and horizontal spans, no duplicates or unsupported
bridges, stable nominal anchors, correct complete bounds/advance and
left-edge contract, unchanged no-ledger shapes/hits, and bounded
representation. Test combinations with every allowed mark and written
accidental, wrap/compaction and preview/commit agreement (allow the
existing horizontal placement translation). Include cases that would
fail if ledger ink were ignored during spacing or modifier collision.

Add a small native fixture (or construct it programmatically in tests)
for C4 Et(d) Je(a)sum(cd), with ordinary Punctum 0, Punctum -3 and
Podatus [-1,0], unique syllables Et/Je/sum. Do not modify the original
Salve Regina WIP fixture. The single ledger at -2 on Je is the decisive
repertoire test; the lyric collision remains a known Stage 11B issue.
Use additional synthetic cases for high pitches and compound neumes.
Record source link and note that fixture is a limited pitch transcription
rather than the full printed chant.

Add one focused browser driver to the existing verification runner,
Chromium and Firefox at desktop and 320px:

- Insert/transpose a note from -1 to -2/-3/-4 and back; same ID, ledger
  added/removed, Undo/Redo, no new semantic edit for derived ink.
- Verify Et Jesum low A's ledger, high note and compound examples.
- Real mouse ghost for a neume extending beyond the staff, then commit;
  same ledger construction and pitch; staff-edge clamp remains correct.
- Confirm ledger rendering beneath notes, note/whole/range selection,
  clipboard, clef translation, export/import, print/outer SVG visibility
  and no ledger artifacts on palette icons.
- Verify nearby marks/accidentals stay distinct, no new hit targets or
  horizontal clipping, and normal no-ledger layout remains unchanged.

Run format check, lint, full unit suite, build, diff check, runner tests,
and focused driver both browsers. Run affected placement, note-modifiers,
vertical-episema, B-accidentals, mid-score-clefs/custos and range/clipboard
drivers as relevant to the changes; no full historical matrix or TeX
research rerun solely for this milestone. Distinguish known baseline
failures and setup failures from actual passes. Include screenshot(s)
of actual editor and concise verification record. No need to commit
copyright-uncertain printed scans. Update engraving/layout docs and
roadmap for 11A vs 11B; use ADR only if an actual cross-cutting decision
warrants it.

Owner acceptance: ledger on Je (one at -2); at -1 no ledger, -2/-3 one,
-4 two; equivalent upper positions; inspect stacked/offset/repeated/ribbon
figures; check signs, pointer/keyboard, Undo and narrow widths. The low
note/lyric collision is not an acceptance failure for 11A; it is the
primary follow-up for 11B. Do not merge before owner review.

## Owner decisions after PR #91 review

1. Accept the 1,200-unit off-staff canvas margin and apply it to all
   musical ink alike (ordinary, marked and authored-form neumes,
   accidentals, ledgers, custodes), with no marked/unmarked distinction.
   It is a rendering safeguard, not a semantic pitch restriction or a
   historical engraving rule: the document model, allowed pitches, native
   v10 format, effective pitches, history and clipboard are unchanged.
   Stage 11B must respect the same safety policy when it derives
   content-dependent vertical system extents.
2. Accept the current horizontal episema placement (no exception to keep
   it above a note when a ledger obstructs that position).
3. Accept the ledger dimensions, merging rules, pitch-bearing columns,
   prefix accidental spacing and first-head offset, pending foreground
   visual acceptance.

Follow-up implemented on the same branch: the bounded containment policy
(also applied horizontally, since an interval-proportional Porrectus
ribbon reaching a distant pitch is ~10^17 units wide); render-time
limiting of painted ledger runs and bounds-derived outlines to the canvas,
because a bounded viewBox alone left ~10^17-unit painted rects that
Firefox dropped and Chromium drew; extreme-pitch regression tests for
marked notes, authored forms, accidentals and distant custodes on both
sides of the staff; exhaustive ledger-aware mark tests across the
liquescent, extended Scandicus/Climacus, Porrectus-family and compound
families; and a browser scenario proving the editor stays usable with
extreme imported pitches. The policy and exactly what is clipped are owned
by [layout and rendering](../layout-and-rendering.md#canvas-containment-and-extreme-pitches-owner-accepted).

## Explicitly deferred — Stage 11B

Content-dependent system origins/heights, common lyric baseline, text
and musical ink clearance, inter-system collisions, placement mapping
with variable heights, scroll/focus and print layout. Horizontal wrapping
and lyric-band accidental clearance may interact with dynamic baselines;
investigate that dependency in 11B rather than designing a partial
vertical solution here. No new neumes or semantic changes in 11A.

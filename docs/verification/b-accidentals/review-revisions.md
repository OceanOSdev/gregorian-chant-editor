# Stage 8D review revisions

This record follows the owner inline review and Giga Review of `8e77a3f` in
[PR #72](https://github.com/OceanOSdev/gregorian-chant-editor/pull/72).
The [original implementation evidence](implementation.md), historical gate,
printed crops and actual Gregorio compilations remain available. The approved
musical semantics, v5 entities, scope policy and historical notation vocabulary
are unchanged. Review threads are left for their reviewers to resolve.

## Findings and resolutions

| Finding                                         | Resolution and regression evidence                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inline lyric collision                          | A subsequent lyric now clears earlier accidental ink in the same vertical band. Deterministic C4/untexted low B-natural/centered Benedictus tests cover same-system and wrapping cases; continuation hyphen placement also excludes intersecting low signs. Musical/lyric anchors and unsigned compaction remain authoritative.                                                                                                   |
| Inline canvas clipping                          | Accidental-bearing groups enter existing measured vertical canvas expansion. F4 B at position 9 tests flat/natural, default/earlier anchor, full ink and canvas containment. Browser captures and high-natural PDF use the expanded viewBox. This fixes ordinary accidental-induced clipping, independently of extreme-pitch limitations.                                                                                         |
| Focused glyph deletion (Giga #8, promoted)      | A dedicated session action deletes the sign and requests focus on its owner, whether selected or merely focused. Both states preserve notes and one-step history; browser input verifies actual activeElement.                                                                                                                                                                                                                    |
| Giga #1 / overlapping inline rejection feedback | Move/delete result variants expose the narrow reconciliation reason while preserving document-returning APIs. Only ownership-conflict rejection mentions a conflicting accidental. No-op, contour and safe-integer-limit cases with two signs reject unchanged without that message. The staff-limit test also exposed missing safe-integer guards in move commands; these now reject before producing an unpersistable position. |
| Giga #2 / overlapping inline placement feedback | Removed component feedback state, its live region, eligibility recheck and rAF focus restoration. Session announcements/focus requests own start, success, unchanged, invalid target and cancellation. One capture-phase Escape path respects IME and pending clef precedence. Competing placement/Delete controls are disabled while targeting.                                                                                  |
| Giga #3 reconciliation contract                 | Finalized commands retain validity for direct callers; history records the returned snapshot without a second repair. Nested deletion uses explicitly named candidates and finalizes once. Clef candidate construction, preflight and preservation remain explicit; preflight results/counts are retained for confirmation and no repair occurs during rendering. See the command guide for new-command rules.                    |
| Giga #4 Cancel claim                            | Corrected: Cancel preserves the committed score/history/cache and discards the pending clef draft.                                                                                                                                                                                                                                                                                                                                |
| Giga #5 accessible labels                       | Rendering's `accidental-accessible-label.ts` constructs labels from structured context; pure tests distinguish owner from earlier engraving anchor. Layout constructs no presentation strings.                                                                                                                                                                                                                                    |
| Giga #6 parallel arrays                         | Each committed `AccidentalLayout` contains its ID, measured geometry and owner/placement context. One grouping by placement neume replaces repeated filtering and index-matched metadata arrays.                                                                                                                                                                                                                                  |
| Giga #7 toolbar handle                          | Typed `AccidentalContextToolbarHandle.focus()` replaces accessible-label queries. It reveals the glyph and handles deferred overlay focus without a component rAF. Contextual keyboard, reflow and viewport drivers remain regression gates.                                                                                                                                                                                      |
| Shared ink / Giga #16                           | Complete `ink` remains authoritative for measurement. Explicit `bodyInk` excludes separately rendered signs. Rendering draws body plus structured accidental records without object-identity filtering; tests protect complete bounds/advances, and browser references retain one glyph per entity.                                                                                                                               |

## Reconciliation decision

Moving all enforcement into history would weaken direct command callers and
clef preflight. Instead, the smallest consistent boundary is the finalized
semantic command. Existing document-returning APIs remain intact, with narrow
result variants only where session diagnosis needs them. Invariant-neutral
appearance/title/alignment commands need no accidental repair. Intermediate
`*Candidate` functions never go directly to history or persistence. Kind-specific
insertions delegate finalization; nested note/neume/lyric deletion composes raw
candidates and repairs the completed edit once. History remains responsible for
identity and atomic snapshots, not domain interpretation.

Clef transactions cache the repaired Keep note positions candidate and its loss
count. Keep pitches returns a finalized preserved document and typed failure
reason. Confirmation adopts these results without repeated repair. Original
owner loss, canonical ownership, strict imports and byte-guarded recovery remain
unchanged. The revised owner-loss test now deletes a canonical owner while a
matching B survives, proving that the sign is removed rather than transferred.

## Hypotheses investigated individually

1. **Excess placement restoration: confirmed.** A C4 score has earlier anchors
   at positions 2/3, a B at 5 and another at −2; an existing C4 clef before the
   second B changes to F2 with Keep note positions, a seven-degree shift.
   Two initially different-register signs then affect the same register. The
   second span contains the first B and must return to default; doing that makes
   the first sign's earlier anchor valid again. Restoring all invalid placements
   simultaneously loses both. Restoring the original loop temporarily made the
   new regression fail, confirming the reproducer. Repair now restores intrinsic
   invalidity first, in musical owner order, then revalidates remaining conflicts
   after each restoration. Reversed entity collection order gives the same
   surviving placement. No signs or owners are reminted.
2. **Accidental-only Keep pitches failure: not reproduced for valid ordinary
   clef candidates.** A bounded comparison of all eight C/F clefs at four score
   boundaries (32 candidates) with/without accidentals finds no additional
   rejection, and verifies full chromatic pitches and exact placement on success.
   This does not prove arbitrary invalid candidates safe. A separate owner-loss
   candidate passes without signs and fails sign preservation without overflow;
   the result now diagnoses accidental-preservation explicitly. The session uses
   the reason and reserves overflow wording for unsafe note arithmetic. No valid
   historical case or Accepted ADR conflict emerged.
3. **Keep pitches across anchor/owner clef boundary: verified.** The actual
   session edits an existing clef between earlier F and owning B, preserving
   every degree/alteration pair, sign ID/kind/owner/exact placement and height
   under the unchanged written-location clef. One history entry is asserted.
   Both browser transports repeat this contextual edit and check sign identity,
   placement and actual glyph height.
4. **Original test count:** already owner-verified in CI run 185; no reinvestigation
   was needed. Revised actual totals are recorded below.

## Historical attribution correction

GregoBase's [source 4 metadata](https://gregobase.selapa.net/source.php?id=4)
identifies **Graduale Romanum, Solesmes, 1974**; its
[Laetatus page](https://gregobase.selapa.net/chant.php?id=292) maps that source to
p. 19 and the retained `sources/4/18.png` scan. [Source 16 metadata](https://gregobase.selapa.net/source.php?id=16)
identifies **Gregorian Missal, Solesmes, 1990**; the
[Ecce virgo page](https://gregobase.selapa.net/chant.php?id=1144) maps it to p. 184
and `sources/16/183.png`. ADR 0021's edition attributions were correct. The
implementation record's Liber Usualis labels were incorrect and are corrected;
the scan filenames are not printed page numbers. Source crops are unchanged.

## Actual verification

The final gate uses Node 24.18.0, matching `.nvmrc`. The full Vitest run passes
**82 files / 1,694 tests**, including 17 added regressions (and strengthened
existing tests). All required commands pass: `npm run format:check`, `npm run lint`, `npm test`,
`npm run build` and `git diff --check`. No bundled example or dependency-file diff
was present at closeout.

Final production bundle: `index-Cio2YIiA.js`. Both final expanded runs passed
with outputs `/tmp/chant-b-accidentals-GJXbxQ` (Chromium) and
`/tmp/chant-b-accidentals-QzYhYh` (Firefox).

The expanded Stage 8D driver passed in Chromium 157/CDP and Firefox 146/BiDi,
including actual v4/current hydration and downgrade protection. Retained run
outputs are `/tmp/chant-b-accidentals-QpaUZN` and
`/tmp/chant-b-accidentals-SDrmNE`; subsequent successful reruns also used
`/tmp/chant-b-accidentals-pRPoD4` and `/tmp/chant-b-accidentals-qAH8sc`. Existing Chromium vertical episema, contextual,
form/modifier, local persistence, bundled example, mid-score clef/custos,
division and initial-clef drivers passed. Firefox vertical episema, contextual
(retry), form/modifier, persistence, example, standalone mid-score clef/custos
and division drivers passed. The initial-clef driver has only CDP transport.
Firefox division checks use pointer activation for HTML insertion buttons and
verify native Tab; headless HTML Enter activation remains a foreground check.

[Revised printed/editor/Gregorio board](review-editor-vs-printed.png),
[normalization](review-comparison-normalization.json) and
[actual reference path metrics](review-reference-metrics.json) confirm the
historical specimens still render after the layout refactor. The original
reference evidence is retained unchanged. Additional inspected captures:
[high default flat](review-high-flat-false.png),
[high anchored natural](review-high-natural-true.png),
[later Benedictus](review-lyric-collision-false.png),
[continuation hyphen](review-lyric-collision-true.png),
[clef between anchor and owner](review-clef-between-anchor-owner.png).
The [rasterized actual high-natural PDF](review-high-print.png) shows the sign
fully visible; this is browser printing, not a native printer acceptance claim.

Chromium and Firefox actual v2/current storage review passed on fresh disposable origin 4257:
unchanged legacy hydration, v5 commit/refresh, old-build rejection, two-tab
conflicts in both directions, 12 immediate refresh cycles and injected write
failure preserve recovery bytes. Outputs: `/tmp/chant-storage-review-TFoSjs`
and `/tmp/chant-storage-review-64Y7SJ`. The repeated extreme-position probe still
shows the pre-existing impractical viewport while preserving the cache; it is
separate from the ordinary high-sign clipping fixed here.
Earlier temporary driver failures were
setup issues: the new clef case tried activating a radio before selecting its
clef, and one Firefox contextual run navigated while the production output was
being rebuilt. They are not treated as passing checks; affected runs are repeated
against the fixed, stable build.

## Limits and scoped deferrals

No new notation vocabulary, dependency or architectural deviation was needed.
No bundled `*.chant.json`, package manifest or lockfile changed. Existing extreme
safe-integer viewport limitations remain separate from the fixed high-sign
clipping. Foreground spoken accessibility, physical keyboard/IME/touch/pinch,
native OS printing and owner visual acceptance remain manual acceptance items.
Browser protocol IME cancellation and PDF checks cover narrower claims.

A general shared overlay-positioning/get-element hook, nonessential helper/type
cleanup, broad theme-color consolidation and
large anchor-search performance work remain optional follow-ups. This revision
memoizes targeting eligibility and groups layout signs once; it does not claim a
performance benchmark or redesign all contextual overlays. Structural validation
remains exact: the native parser checks schema, the shared accidental shape check
protects resolver inputs, and semantic validation no longer repeats those same
shape predicates a third time.

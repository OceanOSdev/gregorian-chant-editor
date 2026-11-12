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
| Giga #7 toolbar handle                          | Typed `AccidentalContextToolbarHandle.focus()` replaces accessible-label queries. It reveals the glyph and handles deferred overlay focus without a component rAF. Contextual keyboard, reflow and viewport drivers remain regression gates. _Qualified in the final revision: a request that could not position the toolbar left stale deferred focus._                                                                          |
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
   (The final revision asserts that all 32 candidates reach that success path.)
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

## Follow-up: continuation hyphen beside current-group accidental

The owner re-review of `947e5de` identified a further synthetic C3 case. It was
added as a failing regression **before changing layout behavior**: three puncta
at positions 4, 4, −4; `und`; “A” on the first group with word boundary, “men”
on the second with continuation; the third note owns a natural anchored above
the second note. Measurements are exactly 20 units per character, including
20 units for the hyphen. The observed bounds confirm the static trace:

| Case                       | First lyric | Natural | Second lyric | Hyphen                             |
| -------------------------- | ----------- | ------- | ------------ | ---------------------------------- |
| Earlier anchor, before fix | 140–160     | 172–180 | 184–244      | **172–192: overlaps sign and men** |
| Earlier anchor, after fix  | 140–160     | 184–192 | 196–256      | **162–182: clear interval**        |
| Default prefix, before fix | 140–160     | 234–242 | 246–306      | **234–254: overlaps sign and men** |
| Default prefix, after fix  | 140–160     | 234–242 | 246–306      | **187–207: clear interval**        |

The equivalent default-prefix case puts “men” on the third, owning group and
omits explicit placement. Both new tests failed on the original implementation;
both now pass. A sign and its own lyric translate together, so shifting that
group cannot enlarge their fixed intervening gap. Reservation now accounts for
the current group's leading low ink and leaves space **before** it. Final
same-system placement chooses the rightmost fitting clear interval, rather than
forcing the hyphen after every sign. Both phases share the same measured
vertical-band accidental exclusions. Existing division/clef/custos clearance,
lyric alignment, local musical anchors, whole-group wrapping and progress remain
in the existing layout walker. No semantic, command, persistence or architectural
contract changed.

Five additional tests cover both exact reproductions plus preceding-and-current
low signs at three filler counts, including wrapping. (Qualified in the final
revision: wrapping was not asserted; 10 and 12 fillers wrap the whole sequence,
and the split-continuation case is now covered separately.) They assert unobstructed
hyphen intervals, stable semantic placement, lyric-to-neume anchors and retained
neume counts. The complete gate passes on Node 24.18.0:

- `npm run format:check`
- `npm run lint`
- `npm test`: **82 files / 1,699 tests**
- `npm run build`
- `git diff --check`

The expanded Stage 8D production driver passed in Chromium 157/CDP and Firefox
146/BiDi, including the two new native-font SVG overlap assertions and a 320px
capture. Outputs: `/tmp/chant-b-accidentals-b8sm6x` and
`/tmp/chant-b-accidentals-TOzSF4`. The retained [anchored](current-group-true.png),
[default-prefix](current-group-false.png) and [320px](current-group-320.png)
captures use real browser font measurements; the table's exact 20-unit metrics
are the separate deterministic unit regression, not a claim about native fonts.
The synthetic default-prefix specimen also puts its low notehead in the lyric
band; that existing notehead/text overlap is unchanged. These new assertions
establish hyphen clearance, not general low-notehead vertical clearance.

The existing word-composition corpus driver (`CHANT_CORPUS=1`) also passed
**47 cases with zero errors in each browser**, covering ordinary joins, hyphens,
word spacing and outgoing continuations. Corpus outputs:
`/tmp/chant-word-composition-kRCnqs` (Chromium) and
`/tmp/chant-word-composition-fvXx1R` (Firefox). All existing pure layout and
compaction tests passed. Historical reference path/hit metrics compare equal to
the retained originals after parsing JSON; the existing specimens remain in the
production browser driver. Historical evidence and bundled examples were not
rewritten. Prior foreground/manual acceptance limits remain unchanged; no new
foreground speech or native printer checks are claimed for this follow-up.

## Final targeted revision: Giga Review of `40a60f2`

Scope follows the owner adjudication of that review: two confirmed test/layout
findings, one test-coverage suggestion and two hypotheses. Command API shapes,
the finalized-command/history boundary, clef transactions, a shared toolbar
abstraction and the remaining optional suggestions are deliberately unchanged.
Semantics, native v5, persistence, notation vocabulary and bundled examples are
unchanged. Every reproduction below was observed **before** the correction; the
base comparison build is `40a60f2` (`index-VQtrrR16.js`, the audited bundle).

### 1. Unnecessary continuation-hyphen reservation: confirmed and corrected

The walker added the full hyphen reservation (`hyphenWidth + 2 × clearance`)
after **every** earlier low sign in the minimum used to decide separation. A
sign ending before the previous lyric's right edge cannot obstruct a hyphen,
which starts after that edge, yet it could force a compact join apart.

Deterministic reproduction (C3, puncta at −4/4, default flat on the lower B,
“A” word + “men” continuation, `und`, 20 units per character, written as a
failing test first): unsigned lyrics join at 160→161. Signed, the flat ink
(144–156) lies before “A” (160–180), yet the reservation term
156 + 4 + 20 + 4 = 184 exceeded the join threshold: a hyphen was inserted
(anchor 192) and “men” moved to 204–264. “Al”/“le” stays joined in both builds
and is retained as the control.

Native fonts (Chromium 157, Georgia 20 px; hyphen 6.66, “i” 5.56): default
prefixes centre narrow syllables well clear of the sign, so they do not trigger
it. An earlier-anchored natural does, because it pushes its anchor's syllable
against itself:

| First syllable (C3; 4, 4, 4, −4; natural on −4 above note 2) | Base `40a60f2`                             | Corrected                |
| ------------------------------------------------------------ | ------------------------------------------ | ------------------------ |
| i, I, l, j, t (≤ 6.66 wide)                                  | **hyphen**; gap 12.67 (hyphen 210.5–217.2) | joined; gap 2 = unsigned |
| e, a (8.88)                                                  | no hyphen; “men” 0.67 further right        | gap 2 = unsigned         |
| A, in                                                        | joined; gap 2                              | unchanged                |

Correction (`layout-chant.ts`): separation is decided from genuine clearance
only (lyric minimum, previous signs + 4, structural events). Only after
separation is required are hyphen intervals reserved, and only beyond earlier
signs that end past the previous lyric edge. Reservation for genuinely
obstructing signs, current-group leading ink, final interval selection,
anchors, structural clearance and wrapping are unchanged; every existing
exact-coordinate hyphen test and historical-specimen browser check passes.
The [native-font capture](final-narrow-join-i.png) and its
[metrics](final-narrow-join-i-metrics.json) show the corrected “i”/“men” join.

Regression coverage: `keeps the compact A-men join …` (failed before, passes),
plus a new native-font check in `browser-check.mjs` comparing signed/unsigned
gaps for “i” and “e”; it fails on the base build with one unexpected hyphen and
passes in Chromium and Firefox. The 47-case word-composition corpus passes with
zero errors in both browsers; it contains no accidentals, so it verifies only
that unsigned compaction is unchanged (the new decision equals the old one when
no signs are present).

### 2. Strengthened assertions: corrected tests, no behavior change

- The intervening-natural hyphen test now checks the hyphen's measured ink
  interval (from the same measurer as layout), asserts that the natural truly
  lies between the syllables, and requires clearance on both sides. The
  current-group tests use the same measured interval instead of a hard-coded
  ±10.
- Wrapping is now asserted, not assumed. For the later-lyric test, 0 and 5
  fillers stay on one system and 12 fillers place the signed group and lyric
  together on system 2. For the preceding-and-current test, 10 and 12 fillers
  wrap the whole sequence; a new 8-filler case splits the continuation across
  systems with an outgoing hyphen. Each case asserts its system placement.
- The 32-candidate clef comparison now counts successful preservations and
  asserts all 32 reach the pitch/placement assertions.

### 3. Accidental deletion during lyric entry: reproduced and corrected

Reproduced in production Chromium and in session tests, with both a clean entry
(“Proba”) and a dirty draft (“Draft”). Glyphs keep `tabIndex=0`, but
`delete-accidental` returned the unchanged session whenever `state.lyrics` was
set: Delete did nothing, with no feedback and focus left on the glyph. The same
investigation found that Tab on a glyph selected during lyric entry was
consumed, although its toolbar is not offered then.

The existing lyric-workflow contract lets note, division and clef edits apply
while preserving a dirty draft; accidental deletion behaved that way before the
dedicated action. The smallest consistent correction removes only the lyric
guard. Deletion is one history entry, the draft object is unchanged, no history
prompt appears and focus returns to the owning B. Targeting, clef-transaction,
lyric-move and pending-history guards remain. The glyph Tab handler now consumes
Tab only when properties focus succeeds, matching notes. Start-placement and the
other toolbar actions are unreachable during lyric entry, so they needed no change.

Coverage: two session tests (clean/dirty) failed before and pass; the acceptance
driver now deletes both signs during clean then dirty entry, checks draft text,
dialogs, focus and exact two-step undo, and checks native Tab. On the base build
it fails first on swallowed Tab and, with that assertion removed, on the
retained sign; it passes in Chromium and Firefox on the corrected build.

### 4. Stale deferred toolbar focus: reproduced and corrected

`AccidentalContextToolbar.focus()` set `focusRequested` before refreshing and
returned `true` regardless. Reproduced in Chromium: a selected glyph outside a
pinch-zoomed visual viewport (page scale 2.5) gets no toolbar position, so Tab
was consumed and the request stayed pending. After moving focus to another note
and restoring scale 1, the resize positioned the toolbar and moved focus into
“Accidental kind”.

Following `NoteContextToolbar`, `update()` now returns its position. `focus()`
focuses an already positioned panel immediately; otherwise it reveals the glyph
and leaves a deferred request only when that refresh produced a position, else
returns `false` so native Tab continues. The cleanup clears the refresh hook.
The typed handle, glyph/properties keyboard path, Escape/Close restoration,
viewport clipping and reflow are unchanged; no shared toolbar abstraction was
introduced. The acceptance driver's Chromium-only check (page scale 6) fails on
the base build and passes after correction. Firefox/BiDi has no pinch emulation,
so this hypothesis is not browser-verified there; the corrected logic is
engine-independent. Physical pinch/touch remains a foreground check.

### Verification

Local gate on Node 24.12.0 (24.18.0 from `.nvmrc` was unavailable locally; hosted
CI uses `.nvmrc`): `npm run format:check`, `npm run lint`, `npm test`
(**82 files / 1,704 tests**), `npm run build` and `git diff --check` pass.
Production bundle `index-DsZpsuuK.js`; Chromium 157/CDP and Firefox 146/BiDi
with disposable profiles:

- `browser-check.mjs` passes in both browsers. Its historical-specimen glyph
  metrics equal the retained `reference-metrics.json` exactly in Chromium; in
  Firefox the only difference is the previously recorded Domini natural
  x=205.552 (versus 206.010).
- `acceptance-browser-check.mjs` passes in both browsers
  ([Chromium](acceptance/final-revision-chromium-result.json),
  [Firefox](acceptance/final-revision-firefox-result.json)).
- `CHANT_CORPUS=1` word composition: 47 cases, zero errors in each browser.

The optional actual-v4-build branch, storage-review and unrelated subsystem
drivers were not repeated; persistence, notes, divisions and clefs are
unchanged. Local run output directories are not retained. The owner-approved
images remain valid: only rare narrow continuation joins after an earlier low
sign change, by removing an unnecessary hyphen. Spoken output, physical
keyboard/IME/touch/pinch and native printing remain foreground items.

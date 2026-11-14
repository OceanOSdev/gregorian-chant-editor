# Plan: Stage 9B-1 — Pes subpunctis

Branch: `feature/stage-9b1-pes-subpunctis`
Target: `master`

Status: implemented in PR #75, in final review. Stage 9A (PR #74) is merged.

## Owner decisions (2026-11-13, after review of `be79a1e`)

- ADR 0023's bounded four-/five-note tuple approach is approved; ADR 0023 is
  Accepted and narrowly qualifies ADR 0004 without superseding its
  explicit-kind contract.
- Mora: approve **{none, final}** for both Pes subbipunctis and Pes
  subtripunctis. The final note derives from the actual tuple length and stays
  attached to its stable note ID. Final-two and all other nonempty patterns
  are deferred pending sufficient historical evidence and unambiguous
  engraving. Document that the four-note form has direct printed evidence and
  that the five-note form follows the same final-note convention, supported by
  Gregorio and the shared descending-tail construction.
- Deleting an earlier constituent preserves a surviving valid mora; deleting
  the marked constituent removes it rather than transferring it. The
  contextual toolbar offers exactly None and Final note.
- Review requests: exhaustive modifier-geometry coverage (including both final
  mora states), focused marked deletion/movement/history/persistence/browser
  tests, matched marked Gregorio comparisons, and the clef, mid-score-clef and
  division browser drivers with a five-note clef-boundary insertion.

## Goal

Add Pes subbipunctis (four notes) and Pes subtripunctis (five notes) in the
existing modern square-notation profile, through a Podatus split button.
This is a deliberately bounded first experiment with a named neume family
having more than one supported cardinality. It is not an arbitrary melodic
sequence model or a complete Kyrie XI implementation.

Read AGENTS.md and the owning domain, command/history, interaction,
layout/rendering, persistence and testing guides. Respect ADRs 0003, 0004,
0007, 0008, 0010/0011/0013, 0014/0015, 0016, 0018, 0019, 0020, 0021 and 0022.

## Reference evidence and target

- Sister Demetria, Basic Gregorian Chant and Sight Reading (1960),
  [Lesson 22, printed pp. 56–57](https://media.musicasacra.com/books/basicgregorianchant_1960.pdf#page=56).
  Page 57 (PDF zero-based page 56) shows the four-note form, interval
  variations in Ex. 86–87, and Liber examples Ex. 88 (In Monte Oliveti)
  and Ex. 89 (Gloria I). The latter show extended descending diamonds and
  vertical episemata. These are useful primary silhouette/spacing references.
  Inspect the scans, not just extracted text.
- Dom Mocquereau, [A Study of Gregorian Musical Rhythm, printed p. 154,
  figures 37–38](https://media.churchmusicassociation.org/pdf/mocq-web.pdf)
  identifies pes subbipunctis and subtripunctis as a pes with respectively
  two and three descending diamond-shaped notes.
- [Liber Usualis 1961, preface p. xi](https://propria.org/wp-content/uploads/2019/10/liber-usualis-1961.pdf)
  shows the principal compound-neume profile.
- [GregoBase Kyrie XI, Solesmes, id 2982](https://gregobase.selapa.net/chant.php?id=2982)
  links the Liber Usualis (1961) p. 46 and Graduale Romanum (1961) p. 38*.
  The Christe syllable ste contains GABC `kv.jkJH'Gh.`: isolate
  `jkJH'G` as the five-note rising-then-descending target (ictus on H),
  with preceding dotted virga and following dotted rising square note
  remaining distinct. The last Kyrie also contains `fgFD'C`, a second
  five-note target. Compare actual printed grouping and Gregorio rendering;
  do not claim that the complete syllable or Kyrie is supported by this
  milestone. If the source establishes a required joining or alternate
  construction not in scope, document the residual gap rather than
  silently fuse independent neumes.
- [Gregorio GABC](https://gregorio-project.github.io/gabc/) and
  [inclinatum orientation](https://gregorio-project.github.io/tips/inclinatum.html)
  supply independent rendering comparisons, not product validity rules.

Collect matched editor/reference images for both counts, adjacent and
wider intervals, line/space cases, and actual Kyrie fragments. Include
source/edition/page, exact GABC pitches/signs, and any differences. Use
original SVG geometry; no copying font outlines or inferring performance
duration. Observe source licensing before bundling any new example score.

## Architectural direction (owner agreed to start Stage 9B-1)

Use one explicit semantic kind, e.g. `pes-subpunctis`, with a union of
four- and five-note tuples, not arbitrary arrays. Canonical spelling is
an implementation choice; use it consistently in the schema and docs.
Derive the displayed name from actual cardinality: Pes subbipunctis for
four, Pes subtripunctis for five. Each constituent has its own stable ID;
one family instance has one stable neume ID and one lyric-anchor boundary.
No persisted variant/count field duplicating the tuple length.

Validate exactly 4 or 5 notes, with p0 < p1 and p1 > p2 > p3 (> p4
when present). The tail may end below, at, or above the initial pitch;
do not require the outer pitches to differ. Cardinality, pitch direction,
note forms and modifier validity remain runtime checked. Existing nine
kinds remain fixed tuples and retain behavior.

ADR 0004 currently specifies fixed-cardinality tuples per kind. Write
an explicit ADR (next available number, currently 0023) narrowly qualifying
that decision to allow a bounded union of fixed tuples for this named
family. Retain discriminated kinds, stable identities and exhaustive
handling; do not supersede the whole explicit-kind contract or generalize
other families in this PR. The owner agreed to begin the proposed bounded
family approach; document the precise scope as the implementation design,
and use the project's ADR review process. If a substantially different
model is necessary, stop the affected implementation with evidence and
options before conflicting with accepted decisions.

Keep semantic family and entry-tool variant distinct: e.g. two explicit
entry choices map to one kind with different tuples. Do not derive tool
selection from the last placed group or store transient tool state in
the score. Audit places currently assuming at most 3 pitches/IDs,
especially InsertionIds, allocateInsertionIds, neume-entry-pitches,
GraphicalNeumeKind, resolved placement, move/delete, native tuple decoding,
geometry, marks, labels and exhaustive switches. Allocate sufficient
distinct note IDs once at the interaction boundary; pure reducers must
not generate IDs. Preserve replayability and existing callers/tests.
Use bounded typed helpers where useful rather than unsafe casts or
silently truncating tuples. Avoid unrelated generic refactoring.

## Toolbar and placement

Use the established Stage 9A split-button lifecycle (PunctumMenu and
its reviewed fixes). The ordinary Podatus primary action always selects
plain Podatus, while its chevron offers Podatus, Pes subbipunctis, and
Pes subtripunctis with identifiable icons and text. Selection arms the
exact tool, no insertion until a staff click or existing Insert action.
One click places the entire group at the snapped first pitch, stays
armed for repeat placement; no modal, drag or per-note entry.

Suggested default contours relative to the first pitch p:

- four notes: [p, p+2, p+1, p];
- five notes: [p, p+3, p+2, p+1, p].
  These are predictable entry templates, not fixed musical intervals.
  Use existing pitch placement policies and allow subsequent valid
  individual movement. Preserve placement/ghost parity at all boundaries.

Extract/reuse the proven split-menu behavior narrowly if this reduces
duplication. Preserve Punctum family semantics, styling and regression
coverage; no wholesale toolbar redesign. Both menus must close
predictably when the other is activated, never leave overlapping
open states or accidental score edits. Primary closes its own menu,
ordinary outside controls retain focus, dismissal-only score click
restores chevron focus and consumes the click. Escape closes menu without
exiting placement; Tab/Shift+Tab leave normally. Preserve one roving
toolbar Tab entry, arrow/Home/End navigation, menu keyboard navigation,
accessible expanded/checked/name states, exact visible active variant
and I/T remembered-tool behavior. T focuses the appropriate family
control without arming plain Podatus; I inserts the exact remembered
count, including selected-boundary cases. Update keyboard help as needed.
Ensure icons fit the existing toolbar at 320px, without clipped menus.
Keep all existing Punctum split-button checks passing.

## Engraving

Use the existing Podatus as the two-note head construction, followed
by detached descending puncta inclinata. Reuse the project's original
Podatus and descending Climacus primitives where consistent with the
printed references. The current Climacus implementation has exactly two
diamonds and a virga stem; factor only the genuinely reusable descending
diamond/spacing/hit geometry. Do not accidentally draw a new virga stem
at the pes apex, duplicate an apex note, introduce a connector to the
diamonds, or alter existing Climacus/Podatus metrics. Verify if optical
spacing needs a distinct pes-to-first-diamond rule rather than copying
virga-to-diamond spacing blindly.

Each note needs independent nonoverlapping pointer ownership and focus,
including stacked pes heads, neighboring diamonds and their modifiers.
Handle adjacent pitches, skips and mixed intervals; test line/space
combinations and extremes under existing layout policy. Derived geometry
must drive ink, selection/hit bounds, note modifiers, accidental
placement, icons, ghost, advance, wrapping and lyrics. Retain the
first-pes-note lyric anchor/alignment convention unless reference
evidence and owner review warrant a change. Whole group stays together
under current wrapping rules. No global spacing or ledger-line overhaul.

## Movement, deletion and rhythm

- Individual movement is allowed only if the resulting ordered contour
  and all existing constraints remain valid. Whole-group movement
  transposes all notes, retaining IDs and intervals; clef changes preserve
  melody under ADRs 0014/0015/0021. No implicit contour conversion on move.
- Deletion: preserve neume ID, order and surviving note objects/IDs,
  lyric anchor, structural boundary and valid signs. Determine resulting
  supported contour from survivors, not merely tuple length.
  Five-to-four: retain pes-subpunctis if survivors satisfy its invariant;
  if deletion creates four descending notes (or another unsupported
  contour), reject without editing; extended Climacus is later work.
  Four-to-three: normalize to Torculus when rise/fall, Climacus when
  strictly descending (including deleting the first note), or any other
  existing three-note kind only if the actual surviving contour satisfies
  its established rule. Equal adjacent or unsupported contours reject.
  Preserve existing equal-outer-note Torculus/Porrectus deletion policy;
  no incidental broadening of unrelated kinds. Derived default glyphs
  may change when normalizing to an existing kind, but do not discard,
  reassign or reinterpret any surviving explicitly authored modifier or
  form. Reject invalid surviving marks, explain rejected normalization
  and test all constituent deletions including both peak and first-note
  deletion with varying pitch relations. Whole-neume deletion follows
  established policy.
- Author independent horizontal/vertical episemata on each constituent
  (including the Kyrie ictus on the inner descending note), with measured
  placement. Derived diamond shape is not an authored inclinatum flag.
  No new authored Virga/Inclinatum/Quilisma contexts in this milestone.
- Mora: unlike Stage 9A, these groups have a descending tail, so investigate
  conventional final-note and final-pair augmentation first. The existing
  `moraIndexes` hardcodes final indices to 2 and [1,2]; do not reuse those
  indices for longer groups. If supporting final/final-two, derive indices
  from actual tuple length and maintain the established policies exactly
  for all prior kinds. Match printed examples and Gregorio rendering for
  each proposed allowed pattern with unambiguous note ownership, including
  line/space, intervals, and normalization. GABC parser acceptance alone
  is insufficient. No arbitrary earlier-note mora or new duration model.
  If evidence fails to settle a nonempty pattern, record it as unresolved,
  propose none-only or the narrower sourced matrix, and request owner
  approval before enabling new mora behavior. Continue independent
  unmarked-family/UI/geometry work and prepare a draft PR if needed rather
  than stop all implementation; provisional none-only must be clearly
  identified as such and cannot be merged before the gate is resolved.
  Update ADR 0018 and the new ADR with the final approved matrix.
- Preserve ADR 0021 B accidental ownership/register and effective-pitch
  scope, including when the contour revisits the same B (possibly separated
  by other notes), owner deletion, above-note anchors and chromatic
  clef-preserving changes. No new accidental policy without explicit review.

## Native persistence

Propose native v7 for the new kind. Strict v1–v6 readers keep exact
legacy kind and note-field whitelists; every older version rejects the
new family, including otherwise valid four/five-note groups. Preserve
existing withdrawn draft-v2 recovery, original cache bytes, same
localStorage key, cross-tab conflict guard, no hydration rewrite, size
limits and exact ID/order/anchor preservation. New saves/exports write
v7. Older builds will not read v7, including scores containing only old
kinds. Validate both counts, all contour/mark/form/identity constraints,
unknown keys and versions at import/export and command boundaries.
Do not reinterpret previous files or silently truncate notes. Update
owning docs, ADR log and affected version assertions/browser fixtures.

## Verification

- Pure tests: valid/invalid 4/5-note contours (including tail crossing
  initial pitch), cardinality/identity, insertion at each mixed-event
  boundary and multiple systems, exact entry count/IDs, all note and
  group movements, deletion outcomes per index and pitch relationship,
  rejected edits/history, stable selection and anchors, modifier matrix,
  B ownership and clef preservation. Test exact legacy v1–v6 readers and
  new v7 round-trip, malformed versions/tuples and blocked-cache recovery.
  Preserve all previous neume tests, especially Stage 9A.
- Geometry tests: line/space, adjacent and wider intervals, expected ink
  and distinct hit regions, all supported sign combinations, lyric
  anchor/clearance, ghost versus committed geometry, whole-neume wrapping
  and narrow layouts. Compare against actual printed source and
  reproducible Gregorio reference; record what is qualitative vs measured.
- Extend/create focused real-browser driver in Chromium and Firefox at
  desktop and 320px, production preview. Exercise both family menus,
  mouse/keyboard, active labels, exact ghost/count, primary reset with
  menu open, outside score dismiss and focus/I/T, Tab/Escape, cross-menu
  switching, contextual modifiers, selection, movement, normalization,
  undo/redo, native save/import/refresh, actual hit targets and wrapping.
  Include screenshots of closed/open controls and marked/unmarked groups
  next to lyrics, neighboring neumes and accidentals. Run prior Stage 9A
  browser checks and relevant accidentals, persistence, modifiers,
  note-shapes, vertical-episema and clef checks.
- Run npm run format:check, npm run lint, npm test, npm run build
  and applicable drivers per docs/testing.md. Record actual results
  and limitations separately; don't equate headless automation with
  foreground interaction or actual screen-reader testing. Owner can
  accept based on automated checks and reference evidence, as in Stage 9A;
  don't claim their acceptance in advance. Delegate as much objective
  testing to the implementing agent as possible.
- Pre-existing lyric-anchors / lyric-move driver failures are documented
  separately from Stage 9A. Do not repair them opportunistically in
  this PR; reproduce baseline if encountered and retain follow-up.

## Exclusions and delivery

No extended Scandicus/Climacus, other subpunctis families, torculus
resupinus, porrectus flexus, scandicus flexus, climacus resupinus,
arbitrary-length neumes, intra-syllable fusion/spacing overhaul,
liquescence, salicus/oriscus, liturgical annotations, GABC interchange,
playback, or unrelated refactors. No full Kyrie acceptance claim.

Implement on this branch, commit, push and open PR targeting master.
Report exact reference findings, ADR decisions/gates, verification,
caveats and a small remaining owner checklist. If significant ambiguity
remains, commit evidence and options and leave the PR draft; do not
invent historical engraving or silently amend an accepted contract.
Keep the plan during review and follow the owner's closeout choice.
Do not merge.

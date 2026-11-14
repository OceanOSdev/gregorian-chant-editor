# Plan: Stage 9B-3 — Compound directional neumes

Branch: `feature/stage-9b3-compound-directional-neumes`
Target: `master`
Base: `5c24857` (Maintenance C merged, PR #79).

Status: research delivered (see the [reference record](../verification/compound-directional-neumes/README.md) and Proposed [ADR 0025](../adrs/0025-compound-directional-four-note-neumes.md)); owner Gates A–C pending, no implementation.
Read AGENTS.md, the owning guides, accepted ADRs and
[Stage 9B-2](stage-9b2-extended-scandicus-climacus.md).
Use the [verification tiers](../ai-workflow.md#verification-tiers-and-efficiency)
and runner. The accepted owner baseline is
[34 passing browser pairs](../verification/runner/README.md#maintenance-c-owner-acceptance-2026-11-13).

## Scope and proposed model

Add four named conventional four-note figures in the existing Roman/Solesmes
square-notation profile. Proposed fixed tuples and strict adjacent directions:

| Kind               | Adjacent contour | Default relative to first pitch p |
| ------------------ | ---------------- | --------------------------------- |
| torculus-resupinus | up, down, up     | [p,p+2,p+1,p+3]                   |
| porrectus-flexus   | down, up, down   | [p,p-2,p+1,p-1]                   |
| scandicus-flexus   | up, up, down     | [p,p+1,p+3,p+2]                   |
| climacus-resupinus | down, down, up   | [p,p-1,p-3,p-2]                   |

All adjacent pitches must differ in the stated direction; nonadjacent
pitches may coincide, or cross the previous extremum. Do not constrain the
fourth note relative to the first or second beyond the adjacent contour.
Retain the existing kinds, bounded counts, forms and meaning exactly.
One neume ID, four stable ordered note IDs, one lyric anchor boundary.
No arbitrary-length array, persisted variant/count, fusion flag, or
intra-syllable grouping redesign. Longer flexus/resupinus extensions,
other subpunctis families, liquescence, oriscus/salicus/pressus, ledger
lines and full reference-score acceptance are excluded. The four fixed
kinds are the recommended scope, subject to owner approval of the ADR.

## 1. Historical investigation and owner gates (first)

The initial research establishes the named four-note forms, not a
verified engraving algorithm:

- [Liber Usualis, 1962, Preface to the Vatican Edition, printed p. xi](https://archive.ccwatershed.org/media/pdfs/18/11/29/00-45-28_0.pdf):
  notation table lists all four, and p. xii explains the two pitches of
  the porrectus stroke.
- [Dom Gregorio Suñol, Método completo de canto gregoriano](https://media.musicasacra.com/books/Sunol-Metodo_Completo_de_Canto_Gregoriano.pdf),
  printed p. 23, lesson 6, §36: lists all four among four-note neumes.
- [Gregorio's discussion of neumatic elements](https://gregorio-project.github.io/structure.html)
  explicitly illustrates alternate grouped and separated written forms of
  Scandicus flexus and Porrectus flexus, citing Nocturnale Romanum
  (2002, pp. 501 and 499). Thus pitch contour alone does not decide
  graphical grouping.
- [Differentiating hands in square chant notation](https://www.cambridge.org/core/journals/plainsong-and-medieval-music/article/differentiating-hands-in-square-chant-notation/AF8AC9204D7B2FC845DB6C2047EA9982)
  documents joined and pes-plus-clivis Scandicus flexus in medieval Dominican
  manuscripts (example 11); historical variation, not the modern profile's
  primary engraving prescription.
- [Gregorio GABC](https://gregorio-project.github.io/gabc/) and
  [advanced notation](https://gregorio-project.github.io/gabc/details.html)
  supply comparison renderings and sign syntax, not proof of historical
  universality. SMuFL's
  [plainchant multiple-note forms](https://www.w3.org/2021/03/smufl14/tables/medieval-and-renaissance-plainchant-multiple-note-forms.html)
  are a secondary technical reference only.

Inspect actual scans of the modern notation tables and printed repertoire,
not just extracted labels. Initial ChatGPT PDF screenshot attempts failed;
the above table references were retrieved as text, not visually verified.
Use source scans locally where available, including the prior Liber
Usualis, Mocquereau and Sister Demetria references. Record edition, printed
page, image excerpt, syllable, pitches, intervals, joins, note forms and
sign ownership. Seek at least one real printed specimen per kind, checking
target Kyrie XI only for genuine matches. Document gaps honestly.

Compare the same pitch patterns in Gregorio with explicit GABC and captured
renderings; inspect adjacent steps, skips, line/space positions and
nonadjacent unisons. For each kind, propose a deterministic modern profile:

- Torculus resupinus: investigate the initial square-note rise and
  following descent/re-ascent, especially whether the middle fall uses a
  porrectus-like stroke and how the first note joins it. Do not just append
  a fourth square to the existing Torculus.
- Porrectus flexus: preserve the first descending stroke as two pitches,
  examine its terminal rising/falling pair and joined vs separated profiles.
- Scandicus flexus: examine fully connected vs pes/clivis constructions,
  including the interval-dependent joins; don't assume Stage 9B-2's
  extended monotonic staircase specifies this contour.
- Climacus resupinus: inspect the initial virga, descending diamonds and
  terminal upward note (including any changed pen/diamond geometry at
  the turn). Don't automatically append a square or add a new connector.

**Gate A:** owner approves the exact four-note scope, named semantic kinds,
and chosen engraving profile(s) using matched reference images and
rationale. Provide concise alternatives if references differ; no invented
universal recipe. An interval-specific variant requires sourced evidence.
**Gate B:** investigate none, final and final-two mora separately for each
kind; distinguish direct marked printed specimens, analogy and Gregorio.
Recommended initial maximum is none/final only if supported and approved;
otherwise none-only for that kind. No earlier-note arbitrary mora, no
implicit duration, no doubled dots on a single note. No authored alternate
forms on these four kinds initially; derived virga/diamond/stroke forms
are not authored flags. Independent existing horizontal/vertical episemata
on all four stable notes, using established sign contracts.
**Gate C:** owner approves deletion normalization and the narrow ADR
qualification below, plus proposed toolbar arrangement and native version.

First deliver a compact reference/decision record in
`docs/verification/compound-directional-neumes/` and proposed ADR 0025
(confirm next number). Request owner decisions before implementing disputed
geometry, mora or normalization, or treating a proposal as Accepted.
Independent unambiguous research and implementation preparation may
continue; do not open a merge-ready PR while gates remain unresolved.
Do not spend a full regression run on research-only changes.

## 2. Domain, entry and persistence (after scope approval)

Create four explicit semantic kinds with exact four-note tuples; derive
direction, note forms and names from validated kind, not additional
persisted flags. Use exhaustive typed construction, runtime validation
and the existing five-ID insertion allocator; allocate IDs only at the
command boundary. Audit all exhaustive dispatch, note count and tuple
rebuild paths (movement, deletion, form/modifier edit, clef transform,
native codec, rendering/geometry, hit regions, preview, accessible labels).
Use a proposed ADR 0025 to extend the named-kind contract; qualify ADR
0004 if necessary without superseding ADRs 0022–0024.

Proposed toolbar: extend Torculus and Porrectus into split families;
add Scandicus flexus and Climacus resupinus to the existing Scandicus/
Climacus menus, preserving ordinary primary buttons and existing extended
variants. Exact new entry variant and label for each named figure. One
click places all four notes; preserve I recall, T family focus, repeated
placement and contextual boundary insertion before/after structural events.
Reuse NeumeFamilyMenu, maintain one open menu across all six families,
keyboard navigation, roving Tab stop, dismissal/focus and clean-document
contracts. No new toolbar redesign or modal.

Propose native v9: v1–v8 reject all four new kinds, with every prior version
whitelist/cardinality/form/mora rule unchanged. V9 validates exact tuples,
contours, marks, IDs and all existing rules. No cache key change, startup
rewrite, draft-v2 recovery weakening, history serialization or silent
truncation. Older apps cannot read v9. Preserve existing bundled examples
and round trips, update current version assertions only where appropriate.

## 3. Geometry, editing and normalization

Build from shared existing neume primitives where the approved profile
allows. Keep prior geometry byte-identical; use one shared derived source
for ink, hit geometry, selection, ghost, palette, signs, bounds, spacing,
lyrics and wrapping. The whole neume stays atomic within a system. Each
constituent has independently selectable geometry, including both ends
of diagonal strokes. Audit line/space and skipped interval geometry,
obstacles, episemata, mora, B sign placement and local clipping. Do not
change global layout policy to accommodate a new glyph. No ledger lines
in this stage.

Individual pitch editing preserves strict contour or rejects atomically;
whole-neume transposition preserves all intervals, IDs and valid signs.
Preserve accepted clef/pitch and register-specific B accidental ownership,
placement-anchor and reconciliation policies.

Proposed normalization: deleting one constituent of a four-note group
yields a valid existing three-note kind based on the remaining adjacent
contour. ++ => Scandicus; -- => Climacus; +- => Torculus; -+ => Porrectus.
Any adjacent unison => reject, not an invented mixed/repeated kind or
split. Outer-note equality is allowed for Torculus/Porrectus under current
rules. This gives the following possible results (indices in musical order):

| Kind               | Delete 0  | Delete 1                       | Delete 2                      | Delete 3  |
| ------------------ | --------- | ------------------------------ | ----------------------------- | --------- |
| torculus-resupinus | porrectus | scandicus / porrectus / reject | scandicus / torculus / reject | torculus  |
| porrectus-flexus   | torculus  | climacus / torculus / reject   | climacus / porrectus / reject | porrectus |
| scandicus-flexus   | torculus  | torculus                       | scandicus / torculus / reject | scandicus |
| climacus-resupinus | porrectus | porrectus                      | climacus / porrectus / reject | climacus  |

The proposal is scoped to these four new kinds; preserve existing deletion
rules for all older kinds. Retain neume ID, lyric anchor, structural
boundaries, surviving note IDs/order and valid marks. Remove marks only
with their deleted owner; reject if surviving authored marks become
invalid rather than silently dropping or transferring. Preserve existing
accidental owner-deletion rules and exact undo/redo. If the accepted ADR
needs a narrow amendment, record and obtain approval before implementing.

## 4. Verification and acceptance

Pure tests cover independent contour/cardinality oracle, invalid inputs,
each deletion index with all possible outcomes, ID and anchor stability,
valid/invalid pitch movement, all approved marks/forms, clef/accidental
reconciliation, exact history, v1–v8 rejection and v9 round trips, legacy
recovery and cross-tab protections. Cover all insertion paths and exact
entry recall.

Geometry tests cover all four shapes across representative and exhaustive
bounded contours, steps/skips/nonadjacent equality, signs and combinations,
hit ownership, bounds/advance, lyric anchors, wrapping and ghost parity.
Check no exceptions, no omitted constituents or signs, and compare old
geometry against the accepted baseline for any reused/modified geometry.
Use actual reference comparisons, not self-generated snapshots as sole
engraving evidence.

Add one current production-preview browser driver, registered in the runner
manifest for both transports. Verify 1440px and 320px, all new kinds and
family menus, pointer/keyboard insertion and constituent selection,
whole movement, rejection/normalization, modifier/accidental and lyric
ownership, undo/redo, persistence and menu dismissal. Natively dismiss
note properties before targeting obstructed score controls, as in
Maintenance C. Do not claim foreground focus, real browser/OS zoom, native
popup/IME or spoken accessibility from headless tests.

During work use focused tests; once substantive implementation is ready,
run standard repository gate once plus the new driver and genuinely
affected existing drivers in both supported browsers. If the runner
manifest is modified, run its Node tests. Owner can run the comprehensive
matrix on the final substantive revision when warranted by this broad
feature. Do not repeat it merely for documentation closeout. Report
actual revision, dirty state, versions, results, limitations and run
directory. Preserve separately unresolved Firefox mid-score-clefs
intermittency. No new performance benchmark or exhaustive unrelated
review requested.

Update owning guides, ADR log, verification inventory and roadmap; retain
this plan through review. Open PR against master, do not merge.

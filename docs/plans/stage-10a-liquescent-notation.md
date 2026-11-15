# Stage 10A — Liquescent notation: research and design gate

Status: Stage 10A research complete; owner gate accepted 2026-11-15. The historical research instructions below describe the pre-approval gate. Implementation is now authorized only by the [approved Stage 10B plan](stage-10b-liquescent-podatus-clivis.md) and [Accepted ADR 0027](../adrs/0027-neume-level-liquescence.md). Continue on `research/liquescent-notation`, draft PR #89 against master (base after PR #88). Do not merge before final implementation acceptance.

## Motivation and repertoire fixture

The next repertoire target is the Dominican Salve Regina, specifically GregoBase #4577, not the Roman solemn setting or another Dominican edition.

- Entry: https://gregobase.selapa.net/chant.php?id=4577
- GABC: https://gregobase.selapa.net/download.php?format=gabc&id=4577
- Original edition: Completorium O.P. (Suarez), 1949, p. 119, linked by GregoBase; inspect the actual scan and any continuation pages, not a search thumbnail.
- Source scan starting point: https://gregobase.selapa.net/sources/13/132.png (verify page correspondence through the entry).
- Owner-authored native v9 baseline: `docs/verification/liquescent-notation/fixtures/salve-regina-dominican-wip.chant.json`. 35 neumes, 62 notes, 24 syllables, six divisions, C4, ending at "spes nostra salve." before Ad te. Preserve this snapshot as authored; no automatic lyric or neume corrections. It is a verification fixture, not a new bundled example.
- WIP contains approximations at di (misericordiae) and sal (salve): punctum + five-note Pes subpunctis; tra (nostra): Clivis + Podatus. Those and subsequent gf{gh} figures are separate later investigations, not liquescence scope. The second sal has continuation boundary instead of new word; known baseline authoring issue, do not silently correct the fixture.

## Research objective

Enable the owner to resume authentic authoring at Ad te. Start with the repertoire's two-note liquescent figures: diminutive ascending (epiphonus), diminutive descending (cephalicus), and the augmentative ascending-neume ending if confirmed by the source. Determine exact supported variant set from the actual chant plus representative Roman/Vatican/Solesmes evidence; do not implement a general unlimited neume grammar. The historic product profile is Roman/Solesmes engraving; if this Dominican witness uses materially different shapes, document that conflict and propose a bounded decision rather than silently changing existing standard glyphs.

### R1. Inventory the actual chant

Fetch the complete exact GABC and inspect every corresponding printed occurrence on the source scan(s). Record textual word/syllable, full local GABC, pitches/intervals, source page/system, type and visual shape; include source links and small reproducible crop references or original annotated sketches (do not redistribute scans unless rights allow). Verify previous discussion's working leads: Ad(d/fg~) twice, Eia fg>, ergo gh~, misericordes hg~, dulcis gf~. These are hypotheses, not a complete or confirmed inventory. Confirm the exact syllable and direction for each, and identify any other liquescent or ambiguous markings. In particular, do not infer an augmentative subtype solely from the rising melodic interval: GABC > and < describe different liquescence encodings, and the graphical end shape must be compared to the print. Distinguish unusual single-note forms (e.g. the contributor's note about ostende), compound grouping, and modified division notation from liquescence. Record GABC transcription limitations/discrepancies independently.

### R2. Historical and renderer evidence

Compare the printed Dominican examples against authentic Vatican/Solesmes or other relevant published notation tables and actual printed chant passages. Start with the existing historical source conventions in ADR 0019 and Stage 9B plans, plus Gregorio's official GABC notation documentation (https://gregorio-project.github.io/gabc/), glyph documentation and, if needed, pinned source revision. Cite exact pages/figures/sections and reproducible URLs; mark print evidence versus renderer convention versus inference. For Gregorio render a minimal fixture of relevant ordinary and diminutive/augmentative pairs at adjacent and wider intervals. Do not treat a GABC rendering or a glyph name as primary historical evidence. If sources unavailable, say so; no invented citations, fabricated historical glyphs, or unsupported claims of universal practice.

Establish which shapes are connected, which notehead/terminal strokes differ, interval-dependent profiles, note centres/anchors and widths. Distinguish diminutive and augmentative liquescence, and spelling/labels (epiphonus, cephalicus, pes/podatus and clivis auctus where applicable). Do not claim diminutive means half duration or augmentative means double duration; no playback or automatic phonetic inference.

### R3. Domain model decision

Read current `src/editor/domain/chant-document.ts`, `domain/note-forms.ts`, `domain/neume.ts`, `domain/accidentals.ts`, mora scope/episema rules, native codec and version migrations, layout geometry/ink and placement, editor tool/palette, note contextual controls, and `commands/musical-passage-clipboard.ts`. Consult accepted ADRs 0018 (mora), 0019 (forms/contours), 0020 (vertical episema), 0021 (accidentals), 0023–0026 (bounded compounds/group spacing), plus persistence and identity/clef ADRs.

Compare:

1. Add an authored terminal note appearance property or NoteForm variant.
2. Add a neume-level discriminated liquescence appearance (ordinary Podatus/Clivis remain same kind and tuple).
3. Add dedicated semantic kinds for epiphonus/cephalicus/augmentative variants.

Recommendation must follow evidence, not assume one of these is already approved. Avoid duplicate state encoding, incompatible combinations, or storing derived geometry. Preserve stable constituent identities and strict pitches/contours. If choosing a neume-level property, audit every reconstruction path (including mapNeumeNotes, deletion normalization, note moves and clipboard templates) for dropped appearance. If choosing a note-level field, explain how whole-contour rendering and whitelist work without invalid combinations. If choosing dedicated kinds, justify why new topology is semantically necessary. Give a concrete proposed TypeScript shape, valid kind/index/cardinality combinations, strict runtime validator, and persistence plan (native v9 remains strictly readable; propose v10 if new persisted fields/kinds needed; preserve old files and reject unsupported features under legacy version tags). No format change in this research PR.

### R4. Editing/engraving contract and owner gates

Propose a bounded matrix with evidence for each supported type, pitch contour/interval limits, allowed authored forms, mora patterns and horizontal/vertical episema compatibility. Existing ordinary-note mark support is not historical evidence for liquescent compatibility; conservative deferred combinations must be explicit product limits rather than historical prohibitions. Consider quilismatic Podatus interaction. No silent clearing, migrating, or normalizing marks unless explicit approved policy.

Decide how liquescence is authored: one-click palette family variant and/or contextual form editing, with a proposal that fits the existing split controls and sticky toolbar. Owner previously prefers one-click common insertion, no unnecessary popups. Propose how to toggle ordinary/liquescent without changing stable IDs, pitch or lyric anchors. Define deletion of either constituent, contour-invalid pitch moves, clef translations and preserving written B signs; explicitly handle a surviving liquescent constituent that becomes an ordinary punctum. Preserve existing accepted behavior for ordinary neumes. No automatic text-derived liquescence.

Geometry proposal: pure derived ink/anchors used by both preview and committed layout; note-specific hit targets and focus, ink bounds/spacing, lyric alignment and inter-neume compaction, marks/accidental placement, selection outline and range highlight, custodes, wrapping. Compare minimal representative profiles to source at 1+ intervals and line/space positions. Avoid copy-pasting renderer glyph paths without license/provenance. No production code in the research gate; optional standalone comparison diagrams or reproducible research fixtures only.

Clipboard: copy/paste must preserve authored liquescent appearance independent of source document, through fresh IDs and clef-relative mapping, without changing pitch-conflict policy or existing signs. History one transaction; persistence round trip. Explicitly address v9 WIP import and continuing with punctum + epiphonus at Ad, then later cephalicus/augmentative variants. Existing approximation fixes remain separate.

## Deliverables (research PR only)

- A concise sourced research record under `docs/verification/liquescent-notation/` with complete repertoire inventory, print/renderer comparisons, observed limits and exact source references.
- A proposed implementation plan under `docs/plans/` (can extend this file or add a linked detailed plan) specifying bounded feature scope, domain/codec/commands/UI/geometry changes, tests, migration, no-op/rejection behavior and acceptance examples.
- A draft ADR if warranted, explicitly marked Proposed and not accepted, with options/tradeoffs. Do not amend accepted ADRs or roadmap to claim implementation.
- Explicit owner decision table: supported diminutive/augmentative variants and engraving profiles, semantic representation, valid marks matrix, deletion/toggle normalization, authoring UX, and any unresolved Dominican vs Roman scope. Recommend defaults and flag genuinely unresolved historical questions. If all evidence supports an uncomplicated choice, still stop for owner approval before application changes.
- Preserve the original fixture and source IDs. Optional minimal new research fixtures must not be promoted to native application examples or silently alter original.

## Future implementation verification (plan now, execute only after approval)

Focused unit tests: every approved shape and validity combination, v9 legacy compatibility and proposed new version round-trip/rejection, pitch move and deletion identity, toggling with existing marks and invalid combinations, clef and accidentals, lyric anchors, exact copied appearance/IDs/effective pitch, undo/redo, preview/committed ink parity, geometry/spacing and focus/hit bounds. Include regression coverage for ordinary variants. Browser verification in Chromium and Firefox: one-click insertion, form toggle, narrow and wide viewports, selection/focus and sticky toolbar, save/reload/export/import, clipboard under different clefs, owner fixture continued with exact Ad te phrase. Sourced visual acceptance against the print (not just pitch equality or a matching GABC renderer), and owner foreground checks. Run standard gate and affected focused drivers; don't run full historical browser matrix merely to rediscover known baseline failures. Note all evidence/limitations.

## Out of scope

Scandicus subpunctis, arbitrary compound grouping/fusion (gf{gh}), other regional single-note forms, division notation extensions, automatic liquescence from text, GABC import/export, playback, unrelated UI/refactors, full Salve Regina transcription. These remain future repertoire findings. No implementation commits, production schema changes, or merging without owner gate.

## Research checkpoint (2026-11-15)

Research deliverables were completed at `88e15fe`, before the owner gate.
No application code or schema changed during research. The owner approved
D1–D12 on 2026-11-15, including the sourced Dominican augmentative pes.

- Research record: [`docs/verification/liquescent-notation/README.md`](../verification/liquescent-notation/README.md)
- Approved implementation plan and decision table: [`stage-10b-liquescent-podatus-clivis.md`](stage-10b-liquescent-podatus-clivis.md)
- Accepted ADR: [`0027-neume-level-liquescence.md`](../adrs/0027-neume-level-liquescence.md)

Fixture `salve-regina-dominican-wip.chant.json` is unchanged. Stage 10B is
now authorized; this historical plan does not constrain that approval.

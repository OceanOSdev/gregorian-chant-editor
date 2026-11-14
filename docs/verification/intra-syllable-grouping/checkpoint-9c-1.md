# Checkpoint 9C-1: contextual spacing and pure layout

2026-11-14. **Implementation complete for checkpoint review.** Owner Gates A–D
and [ADR 0026](../../adrs/0026-derived-intra-syllable-spacing.md) are Accepted.
Checkpoint 9C-2 is not authorized yet. PR #82 remains draft; no merge.

## Change and boundaries

`layout-chant.ts` derives each ready input's syllable ID through the existing
`findSyllableForNeume` lookup. It uses a 6-unit complete-ink minimum for adjacent
same-system inputs sharing a non-null membership, provided no division, explicit
clef or written accidental ink touches that boundary. Written signs are already
grouped by location by `writtenAccidentals`; a later B owner without ink and
carried effective alteration do not block compaction.

The existing walker still owns lyric clearance, combined wrapping, outgoing
reservations, custodes and exact-fit/oversized progress. Existing midpoint hit
clipping applies to the new tight gaps. No renderer, semantic model, commands,
history or persistence code changed; native v9 and all 14 kinds remain intact.
No connector, fusion, grouping UI or lyric transfer was added.

The unit corpus now independently fills anchor intervals to check membership
and spacing. Synthetic long-span fixtures were lengthened to preserve their
cross-system purpose at the denser spacing; the et/lux split control uses two
wide Clives in its lyricless prefix. Source pitches/lyrics and historical image
evidence are retained. Earlier screenshots describe their recorded revisions,
not a new browser run. The shared corpus inspector changed only its pure
spacing oracle; browser drivers and runner are unchanged.

## Actual checks

Passed **423 tests across 13 focused files** with `npx vitest run`:

- `layout/intra-syllable-spacing.test.ts`: all 64 anchor subsets against an
  independent interval oracle; explicit eligibility cases; all division kinds,
  C/F clefs, both accidental kinds and earlier placement; carried alteration;
  form/modifier bounds and left-tick normalization; partial/invalid/missing font
  metrics; long spans/custodes and no internal marks; transition to the next
  distinct same-word syllable and later genuine continuation; all 14 kinds'
  unchanged geometry/IDs/anchors; supported Kyrie XI Christe, final Kyrie and
  nine-note eleison fragments (C4, using the accepted Stage 9B-1 pitch mapping).
- `layout/et-lux.test.ts`, `word-composition.test.ts`, `word-corpus.test.ts`,
  `lyric-spacing.test.ts`, `lyric-alignment.test.ts`,
  `accidental-geometry.test.ts`, `division-layout.test.ts`,
  `clef-changes-layout.test.ts`, `multi-system-layout.test.ts`,
  `clef-review-regressions.test.ts`.
- `commands/lyric-anchors.test.ts` and
  `interaction/multi-system-editing.test.ts` preserve existing edit/history and
  unrestricted insertion contracts. All paths above are under `src/editor/`.

`npx tsc -b`, `npm run lint`, `npm run format:check` and `git diff --check`
passed. A read-only existence check passed for all 187 local Markdown file
links in changed documents; external links and fragments were not crawled.

## Remaining 9C-2 work

No browser or visual acceptance is claimed. Verify native painted-point
ownership, clipped selection/focus, slots and ghost/caret behavior after dense
reflow, fonts and narrow layout in both browsers at 1440px/320px. Review the
6-unit metric against the printed/reference specimens and the actual Kyrie
fragments. Exercise affected existing drivers, including next-syllable outgoing
marks across long melismas and written-sign barriers. Run the final repository
gate only at that integrated checkpoint. Full compatibility comparisons,
comprehensive matrix and benchmarking were not run in 9C-1.

Stop for owner review before proceeding to 9C-2. Design acceptance does not
establish graphical acceptance of the initial metric or completed interaction
verification.

# Verification resources and housekeeping audit

Audited after PR #38, before lyric redesign Stage 3. This directory combines
approved design evidence with historical implementation records and standalone
browser checks. Current contracts belong to [ADRs](../adrs/README.md),
[engraving metrics](../engraving-metrics.md), [editor interactions](../editor-interactions.md)
and [testing](../testing.md); dated verification records do not override them.

## File classification and decisions

Patterns below cover every file in the seven audited directories. A generated
file may also be valuable permanent evidence: being generated is not a reason
to delete approved specimens or independent expected geometry.

| Directory                                          | Permanent design/reference material                                                                                                                                                         | Reusable infrastructure                                                                                                     | Generated outputs and cleanup                                                                                                                                             | Obsolete or uncertain material                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [climacus-porrectus](climacus-porrectus/README.md) | All Markdown, `climacus.svg`, `porrectus.svg`, `interaction-details.svg`, `reference-outlines.json`, `specimen-recipes.json`; preserve research, attribution, geometry and target decisions | Both `make-*.py` generators and `interaction-demo.html`; recipe JSON is imported by `climacus-porrectus-geometry.test.ts`   | Preserve all PNG and other JSON files: proposal crops, measured specimen bounds, interaction checks, integrated focus/preview/reflow evidence support the approved design | Proposal/checklist and implementation-era UX are historical. Correct ADR status; retain comparisons rather than silently rewriting approved recipes      |
| [scandicus-torculus](scandicus-torculus/README.md) | Both Markdown files, both SVG sheets and `specimen-recipes.json`; proposal and implementation deliberately differ on disconnected ink                                                       | Recipe data remains useful independent verification input; no standalone browser driver is committed                        | Preserve `browser-results.json` and all `implemented-*.png` as evidence of the final implementation versus the earlier proposal                                           | Proposal contact patches/connectivity assumptions are superseded as already documented. Correct ADR status; do not replace historical proposal artwork   |
| [engraving](engraving/README.md)                   | All three Markdown records and their research/contour rationale                                                                                                                             | No maintained browser driver in this folder                                                                                 | Preserve all PNG and JSON: initial geometry, compound refinements and Variant C comparisons provide historical design evidence                                            | Initial placeholder forms and prospective preview descriptions are historical. Correct ADR status; current preview contract lives in editor interactions |
| [placement](placement/README.md)                   | README is the PR #35 placement record                                                                                                                                                       | `browser-fixture.html` remains used by the current Stage 2 script; retain `browser-check.mjs` for its substantial scenarios | Retain all PNG and `browser-results.json` conservatively as historical placement/scroll evidence; redirect future driver outputs to a fresh system temporary directory    | Driver uses unanchored fixtures, removed controls and active-syllable constraints. Label it as requiring adaptation, not passing current coverage        |
| [syllables](syllables/README.md)                   | Replace misleading current instructions with a short historical record and coverage mapping                                                                                                 | Preserve `browser-check.mjs` as an adaptation source; redirect its outputs to a fresh system temporary directory            | Remove all nine PNG and `browser-results.json`: obsolete UX run outputs, with no baseline consumers or approved geometry role                                             | Pre-anchor fixtures and Add/Edit/Save/Cancel/roving-strip expectations are superseded. Do not advertise this as a runnable regression                    |
| [lyric-anchors](lyric-anchors/README.md)           | README preserves Stage 1 results and limits                                                                                                                                                 | Preserve `browser-check.mjs` as a compact scenario inventory                                                                | No committed generated outputs                                                                                                                                            | Stage 2 removed its input/Add controls. Label obsolete UI steps and identify the music-deletion browser scenario still needing a port                    |
| [continuous-lyrics](continuous-lyrics/README.md)   | README documents current Stage 2 and PR #38 checks and browser limits                                                                                                                       | Preserve `browser-check.mjs` unchanged, including all assertions and shared-fixture dependency                              | Already writes screenshots to a fresh system temporary directory                                                                                                          | Current Chromium regression; documented Firefox automation limitation remains                                                                            |

## Reproduction and maintenance

Use the [Stage 2 instructions](continuous-lyrics/README.md) for the current
browser regression. Node needs built-in fetch and WebSocket; Vite runs on 5173
(or `CHANT_EDITOR_URL`) and Chromium DevTools on 9230. Run browser drivers
sequentially: they navigate and resize a shared browser tab. No framework,
dependency or CI workflow is introduced here.

The Climacus/Porrectus Python generators intentionally regenerate approved review
assets beside their source. Run them in a temporary copy of that folder for
experimentation; review any deliberate changes to committed specimens as design
changes. They must not be automatically refreshed by verification runs.

JSON measurements and historical screenshots retained here are evidence, not
an image-diff baseline suite. No committed historical browser result is claimed
to be a fresh result against master. Only the current Stage 2 script is runnable
without adapting superseded UI/model assumptions.

## Cleanup verification

On the cleanup branch based on master after PR #38:

- `npm run format:check`, `npm run lint`, `npm test` (38 files, 603 tests)
  and `npm run build` passed.
- The unchanged `continuous-lyrics/browser-check.mjs` completed successfully
  against Vite and headless Chromium, exercising the shared StrictMode fixture.
  Diagnostic screenshots were written outside the repository.
- Both Python specimen generators ran successfully in a temporary folder copy.
  Recipe/reference JSON remained equivalent and regenerated SVG parsed correctly.
- Historical drivers were attempted sequentially against the same browser:
  Stage 1 failed at missing `#new-syllable`; syllables failed while clicking that
  removed control; placement failed its old `.editor-insert` keyboard-focus
  assertion before reaching the other superseded controls. These are recorded
  limitations, not passing browser tests. Both redirected drivers printed fresh
  temporary output paths.
- Local Markdown links in this directory and the testing guide resolved;
  `git diff --check` passed. No application source, geometry or fixture changed.

## Deferred opportunities

- Port placement's pointer sweeps, rapid insertion and scrolling scenarios to
  anchored fixtures and current controls; evaluate remote-boundary assertions
  against the current contract rather than merely deleting failing assertions.
- Port Stage 1 music deletion plus anchored lyric undo/redo to current UI steps.
- Evaluate whether the old syllable driver's long-strip scrolling stress cases
  have a useful current equivalent; keep the source until that review.
- Separately evaluate a dedicated browser-test location, shared DevTools helpers
  and CI integration. This cleanup changes none of those boundaries.
- Revisit historical placement captures only after their reference value is
  assessed; engraving evidence remains deliberately conservative.

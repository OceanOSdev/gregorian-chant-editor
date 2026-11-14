# Verification resources and housekeeping audit

## Current standalone browser drivers (Maintenance A, 2026-11-13)

The latest full-matrix evidence is the
[owner run at clean `eea0095`](runner/README.md#maintenance-c-owner-acceptance-2026-11-13),
accepted 2026-11-13: every supported pair below passed. Earlier revision-specific
results in the inventory are historical; Firefox mid-score-clefs intermittency
remains unresolved.

A human-readable inventory, not a runner manifest. The executable list is the
[runner manifest](runner/manifest.mjs); run drivers with
`npm run verify:browser` ([runner guide](runner/README.md)), which also holds
the Maintenance B results. The table below keeps its dated Maintenance A
"latest known" results; Maintenance B normalized the endpoints it lists:
every routine Chromium driver now honours `CHANT_CHROMIUM_URL` (default 9230)
and `mid-score-clefs` honours `CHANT_EDITOR_URL` (default 5173). Each owning README holds
setup, scenario coverage and dated results; it overrides this summary. Only
`lyric-move` and `continuous-lyrics` were re-run for Maintenance A (headless
Chromium against `npm run dev` on 5173, DevTools on 9230, at 1440px and 320px).
Every other "latest known" entry is copied from its record and is not claimed
as a fresh result.

Shared requirements: Node with built-in `fetch` and `WebSocket`; an already
open browser tab with a fresh disposable profile (never an owner profile:
several drivers clear test-origin storage); drivers run sequentially per
browser because they navigate and resize one shared tab. Screenshots and logs
go to fresh system temporary directories. **CDP** drivers need Chromium with
`--remote-debugging-port`; **BiDi** means Firefox is additionally supported
through `CHANT_FIREFOX_URL=ws://127.0.0.1:<port>/session`. **Dev fixture**
drivers load `placement/browser-fixture.html` from Vite (`npm run dev`) and
take `CHANT_EDITOR_URL` where noted; **preview** drivers load the built app
from `vite preview` and take `CHANT_PREVIEW_URL` (and `CHANT_CHROMIUM_URL` for
a non-default DevTools endpoint).

### Current runnable regression drivers

| Driver                                                                                   | Browsers  | Server and endpoints                                                                      | Latest known result                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`continuous-lyrics/browser-check.mjs`](continuous-lyrics/README.md)                     | CDP       | Dev fixture, `CHANT_EDITOR_URL` (5173); DevTools fixed at 9230                            | **Re-run 2026-11-13 (Maintenance A): Chromium pass**, including the ported Stage 1 anchored-deletion scenario. Firefox focus automation limitation documented.                                                                                 |
| [`lyric-move/browser-check.mjs`](lyric-move/README.md)                                   | CDP       | Dev fixture, `CHANT_EDITOR_URL` (5173); DevTools fixed at 9230                            | **Re-run 2026-11-13 (Maintenance A): Chromium pass** after the stale status-selector repair. Failed at line 189 in Stage 9A–9B-2 records.                                                                                                      |
| [`vowel-alignment/browser-check.mjs`](vowel-alignment/README.md)                         | CDP       | Dev fixture, `CHANT_EDITOR_URL` (5173); 9230                                              | Chromium pass in the [Stage 6B record](mid-score-clefs/README.md). Not re-run since.                                                                                                                                                           |
| [`lyric-spacing/browser-check.mjs`](lyric-spacing/README.md)                             | CDP       | Dev fixture, `CHANT_EDITOR_URL` (5173); 9230. `CHANT_BASELINE=1` is not a test            | Chromium passes Maintenance C; see its linked repair record.                                                                                                                                                                                   |
| [`lyric-spacing/selection-cue-firefox.mjs`](lyric-spacing/README.md)                     | BiDi only | Dev fixture, `CHANT_EDITOR_URL` (5173); `CHANT_FIREFOX_URL` (default 9233)                | Firefox passes Maintenance C; Stage 4D results remain historical.                                                                                                                                                                              |
| [`word-composition/browser-check.mjs`](word-composition/README.md)                       | CDP, BiDi | Dev fixture, `CHANT_EDITOR_URL` (5173); 9230 or `CHANT_FIREFOX_URL`; `CHANT_CORPUS` modes | Chromium and Firefox pass Maintenance C (corpus not re-run; `CHANT_CORPUS=diagnostic` and `CHANT_BASELINE=1` are not tests).                                                                                                                   |
| [`clefs/browser-check.mjs`](clefs/README.md)                                             | CDP       | Dev fixture, `CHANT_EDITOR_URL` (5173); 9230                                              | Chromium pass at `34e7bb7` ([Stage 9B-2 record](extended-scandicus-climacus/README.md)).                                                                                                                                                       |
| [`mid-score-clefs/browser-check.mjs`](mid-score-clefs/README.md)                         | CDP, BiDi | Dev fixture, 5173 fixed (no URL override); 9230 or `CHANT_FIREFOX_URL`                    | Chromium pass at `34e7bb7`. **Firefox: one intermittent, unresolved failure** (line 1032, 150% zoom pointer insertion), then two passes; see the [investigation](extended-scandicus-climacus/README.md#firefox-mid-score-clefs-investigation). |
| [`divisions/browser-check.mjs`](divisions/README.md)                                     | CDP, BiDi | Dev fixture, `CHANT_EDITOR_URL` (5173); 9230 or `CHANT_FIREFOX_URL`                       | Chromium and Firefox pass at `34e7bb7`.                                                                                                                                                                                                        |
| [`extended-scandicus-climacus/browser-check.mjs`](extended-scandicus-climacus/README.md) | CDP, BiDi | Preview (4173), `CHANT_PREVIEW_URL`, `CHANT_CHROMIUM_URL`                                 | Chromium and Firefox pass at `e859f3b` (Stage 9B-2).                                                                                                                                                                                           |
| [`pes-subpunctis/browser-check.mjs`](pes-subpunctis/README.md)                           | CDP, BiDi | Preview (4173), as above                                                                  | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |
| [`repeated-note-neumes/browser-check.mjs`](repeated-note-neumes/README.md)               | CDP, BiDi | Preview (4173), as above                                                                  | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |
| [`note-modifiers/browser-check.mjs`](note-modifiers/README.md)                           | CDP, BiDi | Preview (4173), as above                                                                  | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |
| [`note-shapes/browser-check.mjs`](note-shapes/README.md)                                 | CDP, BiDi | Preview (4173), as above                                                                  | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |
| [`b-accidentals/browser-check.mjs`](b-accidentals/README.md)                             | CDP, BiDi | Preview (4173), as above; optional `CHANT_LEGACY_URL` older build                         | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |
| [`b-accidentals/acceptance-browser-check.mjs`](b-accidentals/README.md)                  | CDP, BiDi | Preview (4173), as above                                                                  | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |
| [`local-persistence/browser-check.mjs`](local-persistence/README.md)                     | CDP, BiDi | Preview (4173), as above; clears test-origin storage                                      | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |
| [`bundled-example/browser-check.mjs`](bundled-example/README.md)                         | CDP, BiDi | Preview (4173), as above; clears test-origin storage                                      | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |
| [`vertical-episemata/browser-check.mjs`](vertical-episemata/README.md)                   | CDP, BiDi | Preview (4173), as above                                                                  | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |
| [`vertical-episemata/context-browser-check.mjs`](vertical-episemata/README.md)           | CDP, BiDi | Preview, default 4174 / DevTools 9236; `CHANT_*_URL` overrides                            | Chromium and Firefox pass at `e859f3b`.                                                                                                                                                                                                        |

### Special-purpose checks (not routine regressions)

| Script                                                                                                                      | Purpose and requirements                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vertical-episemata/raster-browser-check.mjs`, `weight-browser-check.mjs`, `render-weight-board.mjs`                        | Before/after raster and weight comparisons for owner review (preview 4180, DevTools 9246, BiDi 9247 in their [records](vertical-episemata/README.md)); not pass/fail regressions. |
| `b-accidentals/`, `note-shapes/`, `pes-subpunctis/`, `repeated-note-neumes/`, `vertical-episemata/` `render-comparison.mjs` | Compose review boards from a driver's temporary output; some use Chromium via `CHANT_CHROMIUM_URL`. Evidence tools, not tests.                                                    |
| `note-shapes/storage-review.mjs` with `storage-review-server.mjs`                                                           | Old-build storage comparison on its own historical subpath (4255, DevTools 9250); see [review follow-up](note-shapes/review-follow-up.md).                                        |
| `extended-scandicus-climacus/three-note-baseline.mjs`                                                                       | Node/Vitest comparison against a baseline commit in a temporary worktree; no browser.                                                                                             |
| `word-composition/corpus-browser.mjs`                                                                                       | Module imported by the word-composition driver under `CHANT_CORPUS`; not run directly.                                                                                            |

### Historical drivers (not current checks)

| Driver                                                       | Status                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`lyric-anchors/browser-check.mjs`](lyric-anchors/README.md) | Stage 1 scenario inventory; targets the removed `#new-syllable`/Add UI (recorded failing at line 48 in Stage 9A); not re-run. Its anchored music-deletion and atomic undo/redo scenario is ported into `continuous-lyrics` (Maintenance A). |
| [`syllables/browser-check.mjs`](syllables/README.md)         | Pre-anchor syllable UI; adaptation source only (DevTools 9250 via `CHANT_CHROME_URL`).                                                                                                                                                      |
| [`placement/browser-check.mjs`](placement/README.md)         | PR #35 placement scenarios on unanchored fixtures and removed controls; adaptation source only. Its `browser-fixture.html` is the **current** shared dev fixture and must be preserved.                                                     |

### Maintenance A acceptance

Owner-accepted 2026-11-13 in PR #77 at verified implementation revision
`49012eb`. The results above are those recorded at that revision; no further
browser runs were made for the documentation closeout.

Known limitations: browser drivers are not spoken screen-reader checks or
foreground OS-focus checks; headless Firefox reported no document focus in the
[Stage 2 environment](continuous-lyrics/README.md#focus-versus-selection), so
foreground Firefox review remains manual where records say so. Endpoints and
ports were partly hard-coded per driver; Maintenance B made them configurable
and added the isolated parallel [runner](runner/README.md). Its full-matrix run
found pre-existing failures in `word-composition` (both browsers),
`lyric-spacing` (Chromium) and `lyric-spacing-selection-cue` (Firefox); see the
runner guide. Maintenance C repairs those older scenarios by natively closing
the later note-properties panel; all four targeted jobs now pass.
[Completion evidence](runner/README.md#maintenance-c-targeted-completion-2026-11-14-utc)
records the targeted run and standard gate. Maintenance C is complete and
owner-accepted 2026-11-13 at `eea0095`: the
[owner comprehensive verification](runner/README.md#maintenance-c-owner-acceptance-2026-11-13)
records 34 passes, zero failures and six expected unsupported pairs;
Firefox mid-score-clefs zoom intermittency remains open.

## Earlier records and the post-PR-38 audit

For current Stage 4 results and outstanding owner checks, see the
[Stage 4D acceptance record](stage-4d/README.md). The audit below is historical;
its statement that only Stage 2 is runnable describes the post-PR-38 checkout.
Current runnable Stage 3–4 drivers are listed in the Stage 4D record.
Dated Stage 4B/4C records retain their review-time Proposed ADR labels and
unmerged/pending-stage observations; current ADRs 0010 and 0011 are Accepted,
and the Stage 4D record owns the current milestone results and limitations.

Audited after PR #38, before lyric redesign Stage 3. This directory combines
approved design evidence with historical implementation records and standalone
browser checks. Current contracts belong to [ADRs](../adrs/README.md),
[engraving metrics](../engraving-metrics.md), [editor interactions](../editor-interactions.md)
and [testing](../testing.md); dated verification records do not override them.

## Current build reproduction URLs

Historical records retain `/gregorian-chant-editor/` URLs as evidence of the
builds tested at the time. The current build serves from `/`. When reproducing
checks against the current build, use `http://127.0.0.1:4173/` (or the preview
port in the record), including any `CHANT_PREVIEW_URL` override. Keep recorded
results unchanged. The dedicated `note-shapes/storage-review-server.mjs` and
`storage-review.mjs` baseline comparison retain their own historical subpath;
use their documented URLs when reproducing that comparison. See the
[current testing guide](../testing.md) for production preview checks.

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

This paragraph describes the post-PR-38 checkout; the current inventory is
[above](#current-standalone-browser-drivers-maintenance-a-2026-11-13).
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
  (Done in Maintenance A, 2026-11-13: see the
  [Stage 2 record](continuous-lyrics/README.md#anchored-music-deletion-ported-from-stage-1).)
- Evaluate whether the old syllable driver's long-strip scrolling stress cases
  have a useful current equivalent; keep the source until that review.
- Separately evaluate a dedicated browser-test location, shared DevTools helpers
  and CI integration. This cleanup changes none of those boundaries.
- Revisit historical placement captures only after their reference value is
  assessed; engraving evidence remains deliberately conservative.

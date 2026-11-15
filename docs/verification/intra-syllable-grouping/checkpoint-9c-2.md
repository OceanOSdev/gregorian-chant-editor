# Checkpoint 9C-2: integrated spacing verification

2026-11-14. Owner authorized 9C-2 after reviewing `88051f6` in draft PR #82.
Implementation closeout revision: `761f2bcd69cd2459081fd5fd2f4ccea3f87cdd6e`,
rebased on master `e2a1f5b`. Owner visual/implementation acceptance and merge
remain separate.

## Review repairs

- The hosted-CI authored-diamond regression used only twelve puncta, which now
  fit in a compact span. It now uses 32: the first system contains 23 diamonds
  versus 26 squares, with measured origin advances 20 versus 18 and unchanged
  head widths 14 versus 12. The test still checks exact system membership and
  the following system's semantic start index. Production spacing is unchanged.
- Layout membership is derived in one forward traversal of the existing
  ready anchor/index map. The last anchor ID is carried through unanchored
  neumes; the lyricless prefix stays undefined. The independent interval oracle,
  readiness/fallback and both-null exclusions remain in force. This is linear
  membership derivation, not a claim that every layout operation is linear.

- Firefox's new dense fallback-reflow check exposed an untracked focused SVG
  note: the document-level bubbling focus event had not recorded its ID. The
  note ref-detach callback now remembers the actual focused control before React
  removes it. Existing restoration still requires a disconnected old element,
  no explicit focus request and body focus; it does not fall back to selection
  or steal focus from another control. Browser verification below determines
  acceptance of this repair.

## Integrated checks

The existing `word-composition` runner driver now calls
[`browser-review.mjs`](browser-review.mjs), using the real editor in its existing
development fixture and native CDP/BiDi input. No new runner or production
fixture API was added. Selected typed [specimens](fixtures.ts) include et/lux,
the supported full perpetua approximation, three supported Kyrie XI fragments,
a long span with an internal division/explicit clef/earlier-written accidental,
and a dense span containing all fourteen kinds and modifier overhangs.

At 1440px and 320px, checks compare actual SVG ink/system membership with
measured layout, independently derive membership/eligible barriers, test both
sides of midpoint clips, and natively select/focus every constituent of all
fourteen kinds. Selection, placement and lyric-move decorations retain clipping.
The long span checks one lyric per anchor, no fabricated internal continuation,
existing genuine next-syllable marks, focus across provisional/dense reparenting,
native pitch editing/undo/redo, slot-based hover without committed reflow,
painted caret/ghost, insertion with stable anchors, persistent placement focus,
and exact native v9 cache decoding. Font loading events are explicitly simulated
to drive the existing fallback/remeasurement path; pointer and keyboard actions
use browser input rather than dispatched DOM key/click events. Palette/move
activation and fixture mounting use DOM APIs, as in the existing driver.

## Results and visual review

### Integrated browser evidence

The runner artifacts under `.verification-runs/` record the focused
`word-composition` driver against revision `88051f60d1f30c23d1115c73aceae39a7e0e0896`
with the 9C-2 implementation present in the dirty worktree (2026-11-14):

- Chromium 157 passed the integrated driver, including the described specimens,
  all fourteen kinds' native ownership, clipping, dense focus reflow,
  slots/ghost/insertion and v9 history at 1440px and 320px.
- Firefox 146 initially failed `focus survives provisional reparent`. The
  immediately following fresh Firefox run passed the same driver after the
  focus repair described above. Both artifacts are retained in
  `.verification-runs/run-2026-11-14T19-17-22-155Z-57ePbx/` and
  `.verification-runs/run-2026-11-14T19-25-32-140Z-428vtU/` respectively.

The same targeted Chromium/Firefox driver was attempted on clean rebased
revision `761f2bcd69cd2459081fd5fd2f4ccea3f87cdd6e` twice. Both attempts ended
`setup_failed` before launching the driver: runner-owned Vite exited with code 1
before its ready line. See
`.verification-runs/run-2026-11-14T22-33-09-815Z-hjsw4n/` and
`.verification-runs/run-2026-11-14T22-33-39-703Z-TXaJ3X/`. Therefore the prior
browser passes are evidence for the same implementation in its pre-rebase dirty
working tree, not a successful browser run on the rebased revision.

### Rebased repository gate

On clean revision `761f2bcd69cd2459081fd5fd2f4ccea3f87cdd6e`, passed:

- `npm run format:check`
- `npm run lint`
- `npm test` — 90 files, 2,022 tests
- `npm run build` — TypeScript project checks and Vite production build
- `git diff --check`

Focused Stage 9C layout tests also passed on this revision: 112 tests across
`intra-syllable-spacing.test.ts` and `authored-forms.test.ts`.

Retained `matched-reference.png` and the Kyrie/Requiem crops are the committed
reference specimens; they are not new screenshots of the editor. Automated
browser geometry and focus assertions are not owner visual acceptance. The owner
still needs to review the 6-unit spacing against those references and visually
accept the dense and narrow layouts. No performance benchmark, full
compatibility comparison or comprehensive browser matrix was run or is implied.

## Owner regression follow-up

The owner's comprehensive run on `cfb93e22107bb7a4e71c9ff698a3220568e5587d`
reported 29 passed, 7 failed, and 6 unsupported pairs in
`.verification-runs/run-2026-11-14T23-20-04-773Z-WIS0Jn/`. The failures were
reviewed individually; none required a change to ADR 0026's 6-unit spacing
policy or production behavior:

- **lyric-move / Chromium:** the music oracle included absolute `.score__ink`
  SVG markup, so approved anchor-reassignment reflow changed its serialized
  coordinates. It now compares rendered neume/note IDs, kinds, pitch positions
  and accessible modifier labels, then checks the actual eligible `n3→n4`
  derived gap is 6 units. It also derives edge clicks and same-system hit-region
  disjointness from the committed midpoint clip rectangles. The old checks used
  unclipped padded bounds, which could point into a neighboring owner's region.
  Rejected moves, other lyric anchors, history, focus, native input and draft
  checks remain in place.
- **vowel-alignment / Chromium:** the 20-neume fixture no longer wrapped with
  the compact final syllable. It now uses 36 neumes and still checks multiple
  systems, vowel/manual alignment, contours, history, draft and keyboard paths.
- **clefs / Chromium:** the expected layout omitted the SVG lyric measurer that
  the editor uses. It now uses the same measurer and a 50-neume fixture with an
  explicit multi-system assertion; repeated clef geometry, pitch transforms,
  controls and history remain checked.
- **divisions / Chromium:** the first recorded failure left the inserted
  neume in the order after a native Undo-button pointer activation. The same
  native insertion/undo path passed in three subsequent focused runs without an
  application or driver change, so no cause was established and no assertion
  was relaxed. This is recorded as a non-reproduced interaction result, not
  classified as a spacing-oracle defect.
- **divisions / Firefox:** compact spacing kept the second lyric at `n19` on
  the first system. Moving it to `n38` and lengthening the specimen to 40
  neumes restores a real outgoing continuation while retaining division,
  zoom/focus and exceptional wrapping checks.
- **b-accidentals / Chromium and Firefox:** `ownerB`'s fixed `r.left - 10`
  offset did not identify the intended `ga→b` division boundary after
  compaction. The native pointer now targets the midpoint computed from the
  rendered neighboring ink bounds and transformed through the SVG screen CTM.
  The exact `beforeNeumeId=b`, accidental restoration and exact undo assertions
  remain.

Two inexpensive review robustness fixes also require the intended n30 division
slot instead of a fallback slot and require at least one clipped lyric-move
target before `every()` can pass.

The first requested nine-job rerun passed eight and exposed an overly broad
lyric-move semantic snapshot (the dev fixture is not persisted to localStorage)
and then the stale unclipped hit-bound assertions described above. A focused
lyric-move Chromium run passed after correcting those checks. The exact
owner-requested affected matrix then passed all nine runnable jobs, with the
three declared unsupported pairs and no failures:

```text
npm run verify:browser -- --driver lyric-move,vowel-alignment,clefs,divisions,b-accidentals,word-composition --browser both -j 2
```

Run directory:
`.verification-runs/run-2026-11-14T23-36-22-970Z-XXSCP7/` (build passed;
Chromium 157.0.8103.38 and Firefox 146.0; 9 passed, 3 unsupported; cleanup
successful). The summary identifies base revision `cfb93e2` and a dirty tree
containing the six browser-driver changes. The new 50-neume clef multi-system
assertion was added immediately after this matrix and separately passed in
Chromium 157 at
`.verification-runs/run-2026-11-14T23-39-13-902Z-XcSzFo/`.

Division Chromium's initial native Undo failure was not reproduced: the same
native keyboard insertion followed by native Undo passed in three subsequent
focused/integrated runs without changing the driver activation or application.
The failed run's unexpected retained neume therefore remains unattributed;
the check itself was preserved intact. No production, domain, layout or unit
test code changed. `npm run format:check`, `npm run lint` and
`git diff --check` passed at implementation closeout. The comprehensive matrix
and visual acceptance were pending at that point; the final owner acceptance
below completes them.

## Final owner acceptance — 2026-11-14

The owner accepted the implementation, the 6-unit intra-syllable spacing and
the visual engraving after the comprehensive run at clean revision
`00ac462f3c6fe798d8cbd25f3ed784a511588d63`:

```text
npm run verify:browser -- --preset full --browser both -j 4
```

The retained summary is
`.verification-runs/run-2026-11-14T23-59-15-826Z-Cd9OEF/summary.json`.
Chromium 157.0.8103.38 snap and Firefox 146.0 produced **36 passed, 0 failed,
6 expected unsupported**. The production build passed in 335 ms; elapsed time
was 306.383 seconds at concurrency 4. All runner-owned processes stopped and
cleanup reported no errors. All seven previously failing jobs passed, including
the native Chromium division insertion/Undo sequence. The earlier division
Undo failure remains an unexplained, non-reproduced observation; it was not
identified as a root cause or fixed. The known intermittent Firefox
mid-score-clef 150% zoom pointer-insertion limitation also remains unresolved;
that driver passed this run.

The earlier standard repository gate remains recorded above on clean revision
`761f2bcd69cd2459081fd5fd2f4ccea3f87cdd6e`: format, lint, build,
`git diff --check`, and **2,022 tests across 90 files** passed. Hosted CI run
[43654537032](https://github.com/OceanOSdev/gregorian-chant-editor/actions/runs/43654537032)
also passed all four checks (Format, Lint, Test and Build) on the final
implementation revision `00ac462`. Stage 9C is completed and owner-accepted.
Native v9 and Accepted ADR 0026's scope remain unchanged; graphical fusion,
connectors and grouping UI remain deferred. No compatibility comparison or
benchmark was run for final acceptance.

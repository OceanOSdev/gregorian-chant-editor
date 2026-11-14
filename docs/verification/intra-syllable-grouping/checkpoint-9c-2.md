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

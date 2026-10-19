# Persistent graphical placement verification

Milestone 1 implementation; 2026-10-18. No palette consolidation, keyboard
insertion shortcuts, whole-neume insertion semantic changes, zoom, or engraving
changes are included.

## Implementation decisions

- One pure editor-session reducer serializes document edits and transient
  lifecycle decisions. Document history still contains only semantic documents.
  Each placement resolves on the reducer's current document and freshly derived
  layout. Browser-allocated IDs are supplied once per event; reducer replay
  creates neither new IDs nor duplicate notifications.
- The existing fourteen Add/Place actions and toolbar pitch/anchor rules remain.
  Shared typed construction removes duplicated insertion code without changing
  commands or contours. Every accepted Add, including Punctum, exits placement.
- Keep placing starts unchecked and survives Finish, kind/target changes, and
  history. Turning it off while armed affects the next accepted insertion.
- A single button stays mounted in the sticky context strip. It says Finish
  placing while armed and Select/Edit otherwise. This resolves the approved
  control-identity detail without another button, disappearing fallback, or
  extra Tab stop for placement focus. The armed context line reserves its height
  before the first insertion, preventing a narrow-screen strip resize from
  triggering scroll anchoring. The pre-existing body minimum was relaxed to
  the available width so 320 px with classic scrollbars does not overflow;
  this does not change score geometry or wrapping.
- Layout-effect focus requests resolve mounted note refs after React commits.
  Persistent entry focuses the existing root with explicit scroll prevention;
  enabled-note entry and Finish resolve stable note IDs. A separate helper
  minimally reveals clipped notation and accounts for the sticky strip and
  nested containers. There is no root/system centering or stored system index.
- Non-live status is derived from current tool, syllable, repetition, and layout.
  One polite, atomic region gets event-keyed children so identical successive
  accepted messages still produce mutations. No render/hover effect announces.

The approved state/behavior specification is followed. The Finish control's
stable identity is the implementation choice requested for resolution. No new
ADR is warranted: semantic/derived state, IDs, whole-neume wrapping, and shared
engraving geometry retain their existing boundaries.

## Real-browser results

The [recorded results](browser-results.json) come from headless Chromium
150.0.7871.128 on Linux, device scale factor 1, running the actual editor under
React StrictMode through Vite. They are not inferred from the earlier isolated
focus experiment.

| Check                                                                              | Result                                                                                                          |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| All seven neumes, repetition off/on                                                | All 14 cases passed; correct tool, selection, disabled-note state, and focus                                    |
| Twelve successive trusted clicks without pointer movement                          | Twelve insertions, twelve fresh live-region updates, unique IDs; three Undo/Redo steps restored exact IDs/order |
| Thirty more clicks in one JavaScript batch                                         | Thirty additional neumes; no stale-closure edit loss                                                            |
| Invalid point, hover, idempotent arm                                               | No extra document changes or live messages; hover preview clears when switching kind                            |
| Every Add action while armed, repetition off/on                                    | All 14 browser cases exited placement and focused the new first note; repetition retained                       |
| Finish/Escape and whole-neume focus                                                | Correct selected-note/first-neume-note/fallback focus; the same strip button remains mounted                    |
| Syllable selection/addition, native lyric Undo/Redo and Escape, Undo from checkbox | Tool retained, target accurate; lyric autofocus/rollback and native input behavior preserved                    |
| Placement-key guards and checkbox Escape                                           | Root Enter/arrows and guarded disabled-note key events do not edit; checkbox Escape finishes                    |
| Actual 37-system score, insertion in system 24                                     | Scroll offsets unchanged at 1440, 390, and 320 px widths; no disabled-note focus                                |
| Accessible root name/description                                                   | Focused AX group is Score placement with concise kind/target/repetition/Escape description                      |
| Forward/reverse Tab from root, Finish activation                                   | Normal traversal to the existing strip action, followed by visible enabled-note focus                           |
| Actual wrap into system 25                                                         | Minimal required reveal; committed SVG ink exactly matches hypothetical preview ink                             |
| Nested scrolling                                                                   | Both window and scroll-container offsets unchanged for visible late-system insertion                            |
| Invalid SVG transform                                                              | No insertion or success message                                                                                 |
| Undo removes the only target syllable                                              | Placement ends; visible Select/Edit fallback focused with combined outcome announcement                         |
| Default app at desktop/narrow sizes                                                | No horizontal page overflow; controls/status visible                                                            |

During Finish, the status strip loses its placement-help row. Browser scroll
anchoring can therefore adjust the numerical offset as that row collapses while
keeping the selected note visible. This is not a focus-induced jump to the start
of the SVG. Assertions require exact offset preservation for already-visible
persistent insertion, and visible correct note focus for Finish. Native scroll
range clamping after document shrinkage remains allowed.

## Screenshots

- [Desktop persistent placement](placement-1440.png)
- [390 px persistent placement](placement-390.png)
- [320 px persistent placement](placement-320.png)
- [Desktop late-system Finish focus](late-system-1440.png)
- [390 px late-system Finish focus](late-system-390.png)
- [320 px late-system Finish focus](late-system-320.png)

Late-system images are after Finish and show the enabled selected note and
retained repetition preference. Persistent-placement images show the active tool,
local focus cue, and Finish action. The fourteen-button toolbar remains unchanged
in scope, including its existing narrow-screen height.

## Reproduce the browser checks

No browser automation dependency is added. Use a Chromium binary with remote
DevTools enabled and a recent Node supporting built-in fetch/WebSocket:

```bash
npm run dev -- --host 127.0.0.1
chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=9250 --user-data-dir=/tmp/chant-placement-verification about:blank
CHANT_EDITOR_URL=http://127.0.0.1:5173 node docs/verification/placement/browser-check.mjs
```

Use the browser flags appropriate to your environment; `--no-sandbox` was needed
in this test environment. `CHANT_CHROME_URL` can override the debugger endpoint
(default `http://127.0.0.1:9250`). Run from the repository root. The script writes
results and screenshots to this directory, and opens the development-only
[browser fixture](browser-fixture.html). That fixture mounts actual production
components with explicit documents; it adds no debug API to the application.

## Automated checks and remaining limits

Local format checking, Oxlint, all 652 Vitest tests across 35 files, and the
production TypeScript/Vite build passed for this implementation.

`editor-session.test.ts` exercises the complete seven-kind Add × armed kind ×
repetition matrix, sequential placement and preview parity after wrapping,
semantic history identity, target removal, deterministic reducer replay, and
fresh resolution after layout changes. `focus-visibility.test.ts` covers the
pure minimum-scroll decisions. Existing domain/command/engraving suites remain
unchanged and continue covering validation, normalization, geometry, wrapping,
and stable identities.

Real DOM focus, root naming, native input events, pointer ownership, scrolling,
and live-region mutations were checked in Chromium. These do **not** establish
spoken output in a screen reader. Actual screen-reader speech, Safari/Firefox,
physical touch, browser zoom, and IME input-method integration were not available
for verification here. Repeated polite events may be coalesced by assistive
technology, as specified; no promise is made that every rapid click is spoken.
The implementation ignores composing shortcut events, but that guard is not a
claim of a complete real-IME test.

No dependency, semantic format, engraving, wrapping policy, or insertion anchor
change was introduced to address those environment limits.

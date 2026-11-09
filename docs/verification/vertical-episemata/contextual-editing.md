# Stage 8C contextual note editing follow-up — historical

The subsequent [consolidation and weight review](consolidation-and-weight.md)
supersedes the inspector-retention and three-field design below. This record
preserves the first follow-up’s actual verification.

2026-11-09. Implemented for owner review in PR #67; **not visual acceptance,
milestone closeout or permission to merge**. ADR 0020 remains **Proposed**.

The owner-approved [review comment](https://github.com/OceanOSdev/gregorian-chant-editor/pull/67#issuecomment-6740210401)
was incorporated into the committed plan in `9b5ff0d` before implementation.
No semantic, engraving, note-form, command or persistence contract changes.

## Behavior

Selecting a note in Select mode shows three nearby native selects: Mora scope,
Horizontal episema and Vertical episema. The panel and the existing comprehensive
inspector (including Form) read the same note/neume and invoke the same command
callbacks. Mora retains the existing seven-kind legal menus; each accepted
change is one semantic snapshot and synchronous native v4 autosave. No separate
modifier state or alternate validation exists.

The panel is fixed HTML outside the SVG/score scroller, so showing/dismissing it
adds no score layout space. It follows the note's current rendered bounds and
flips/clamps to the visual viewport on scroll, resize and reflow. Short viewports
use a vertically scrollable panel; narrower zoomed widths wrap the controls.
It never covers the selected note. Fully offscreen notes hide the panel unless
its controls hold focus. The inspector remains the fallback if no usable space
surrounds the rendered note.

Selection does not move focus into the panel. Tab from the selected note enters
its controls; Shift+Tab from Mora returns to the note. Tab from Close continues
into the next score control. Escape/Close returns focus to the selected note
without reverting changes or scrolling. Tab or reselecting that note reopens it.
Select keys remain native; notation shortcuts cannot modify music from within
the panel. Undo/Redo shortcuts reuse the existing history action. Placement and
pending-workflow guards hide it.

## Actual verification

Local gates: format check, lint, **77 Vitest files / 1,565 tests**, production
build and diff whitespace check passed. The six new pure placement tests cover
edge flipping/clamping, bounded scrollable height, visual-viewport offsets and
non-overlap at desktop, narrow and short sizes. Existing semantic/history,
engraving and codec tests remain the regression coverage for unchanged commands.

The targeted [standalone driver](context-browser-check.mjs) passed in disposable
Chromium/CDP and Firefox/BiDi against production preview at
`http://127.0.0.1:4174/gregorian-chant-editor/`:

- The actual owner v3 Pater Noster hydrates without a write. A plain note in
  **system index 5 of 8** (the sixth system) is selected by native pointer input;
  the inspector is above the viewport. Selecting and using the panel does not
  change the score's document position or scroll back to the inspector.
- Each sign is added/removed, all three coexist, and removing them restores the
  exact original owner document. Inspector/panel values synchronize in both
  directions. The same-task cache is checked after each change; no-op bytes,
  one-step Undo/Redo, preserved pitch/selection and immediate refresh pass.
- Native Tab/Shift+Tab, select ArrowDown, Escape, pointer Close, reselect/reopen,
  Tab exit back to the score and shortcut isolation pass. Short-panel Tab
  traversal reveals lower controls inside the scrollable panel.
- All seven legal Mora scope menus match their existing families. A late
  Pater Noster compound marks both notes atomically; three-note final-pair
  choices affect only their final two stable notes.
- Desktop 1440px, 320px, reduced-height 260px, scroll-following and below-note
  flipping, width changes, actual horizontal scrolling of an oversized lyric
  unit and placement-tool guarding pass. Rendered panel bounds are checked
  against the viewport and note; controls fit without horizontal scrolling.
- Chromium additionally passes **CDP-emulated 1.5× pinch zoom**, checking the
  actual reduced `visualViewport` and retaining all controls. Firefox's narrow
  and short viewports pass; actual browser-menu/OS zoom was not tested.

The existing vertical-episema, note-modifier, authored-form, local-persistence
and bundled-example drivers also passed in both production browsers. Blank-score
pointer helpers now find an actual unobscured canvas point, since a contextual
panel can legitimately occupy the formerly assumed fixed corner. They still
use native pointer events for deselection. No original native fixture or bundled
Pater Noster bytes changed. No dependencies were added.

Retained client-coordinate reports: [Chromium](context-chromium.json),
[Firefox](context-firefox.json). These are numeric observations, not screenshot
goldens. Local Node was v24.12.0; the repository declares v24.18.0. Hosted CI is
separate from these local results.

## Screenshots

- Chromium lower score: [before selection](context-before-chromium.png),
  [after adding all three signs](context-after-chromium.png).
- Firefox at 320px: [before](context-before-firefox-320.png),
  [after](context-after-firefox-320.png), [compound mora scope](context-compound-firefox-320.png).
- Edge cases: [flipped below the note](context-flipped-firefox-320.png),
  [short scrollable panel](context-short-firefox-320.png),
  [horizontal score scrolling](context-scroll-firefox-320.png),
  [Chromium pinch zoom with wrapping controls](context-zoom-chromium.png).

These are actual captured editor screenshots. They do not establish owner visual
acceptance or spoken screen-reader behavior.

## Reproduce

Build and serve preview, then launch new disposable browser profiles (the driver
replaces test-origin localStorage). This run used Chromium debugging port 9236
and Firefox BiDi port 9237. The contextual driver defaults to those Chromium and
preview endpoints; overrides are supported:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
CHANT_CHROMIUM_URL=http://127.0.0.1:9236/json CHANT_PREVIEW_URL=http://127.0.0.1:4174/gregorian-chant-editor/ node docs/verification/vertical-episemata/context-browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9237/session CHANT_PREVIEW_URL=http://127.0.0.1:4174/gregorian-chant-editor/ node docs/verification/vertical-episemata/context-browser-check.mjs
```

Run the other five drivers sequentially on each browser's shared tab using the
same environment overrides, as in the [main Stage 8C record](README.md).
The contextual driver emits a temporary directory with screenshots and results.

Native select value setup uses DOM change events for deterministic matrices;
closed-select ArrowDown and keyboard/pointer focus/activation are independently
exercised through browser input. Inspector-side synchronization dispatches its
real DOM change without focusing/scrolling it. OS dropdown/file dialogs, real
browser-menu zoom, IME and spoken screen-reader output remain unverified. The
actual foreground convenience and engraving remain for owner review. Existing
extreme-pitch canvas and blocked-autosave-warning follow-ups remain out of scope.

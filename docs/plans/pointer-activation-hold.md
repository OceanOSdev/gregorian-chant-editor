# Plan: Hold focus-derived presentation until pointer activation (issue #121)

Branch: `fix/pointer-activation-hold`
Target: `master`
Base: `0a46178` (PR #122 merged)
Status: Owner-approved direction (Option A in
[issue #121](https://github.com/OceanOSdev/gregorian-chant-editor/issues/121#issuecomment-7078382122)).
Implemented on this branch and in review; the PR records the actual
verification.

## Problem and user-visible goal

A pointer press moves focus at `mousedown`, before release. Some UI is derived
from that focus and changes layout or scroll at once, so the pressed control
moves before release and the click goes to a common ancestor. Issue #121 has
the traces. Affected, in Chromium and Firefox unless noted:

1. **Division click:** focusing an unselected division mounts the Divisions
   panel above the score (+141 px at 1440px). The division is focused, not
   selected.
2. **Reverse:** with a division keyboard-focused, clicking a note unmounts the
   panel at press (−141 px). The note is not selected.
3. **Syllable strip:** the strip button's `onFocus` reveal scrolls the strip
   (about 38 px at 320px) during the press. The syllable is not opened.
4. **Touch (Chromium):** focus arrives at the compatibility `mousedown`,
   after `pointerup`, and the tap on a division is lost the same way.

Goal: a pointer click or tap activates the control it pressed. Focus still
moves at press. Focus-derived presentation (the Divisions panel's focused
target, the focused lyric) and focus-triggered reveals apply only after the
press's activation has been dispatched. Nothing else in the UX changes: the
Divisions panel may still appear and move the score after a successful click.

## Agreed decisions

- **One lifecycle.** Add a small press-activation hold in
  `src/editor/interaction/`. Its consumers are the `ScoreSvg` focus reveal
  (replacing PR #107's local `pressed` tracking), `ChantEditor`'s
  focus-derived presentation and the syllable-strip focus reveal. No general
  interaction framework.
- **Start.** A primary-button `mousedown` (`button === 0`), captured on
  `window`. Its default action is the focus change, for mouse, pen and touch
  alike. For touch it is the compatibility `mousedown` that follows the touch
  `pointerup` within the tap, so the hold cannot race touch compatibility
  events. A press whose `pointerdown` is prevented (the dismissal-only presses
  of the open neume-family menu and playback options) fires no `mousedown`
  and moves no focus. Other buttons do not hold. _(Revised in review: the
  first draft started on `pointerdown`.)_
- **Settle after activation.** In a task queued from inside that press's
  `click` dispatch (captured on `window`). Guaranteed by the event loop: it
  runs after the dispatch has finished, whatever listeners stopped
  propagation, and after the following microtask checkpoint. Not assumed:
  that React has committed. Settling derives presentation from the live
  `document.activeElement`, React applies state updates in order, and focus
  moved later by a committed focus request is applied directly. A stale click
  task cannot settle a newer press.
- **Settle at once when no click can follow:** a `pointermove` from the
  press's own pointer without the primary button held (the release was not
  delivered, as in Playwright Firefox when releasing outside the window, or
  `mouseup` brought no click), `pointercancel`, `dragstart`, `contextmenu`,
  the window's own `blur`, or a non-primary `mousedown`. The press's pointer
  is the one whose primary `pointerdown` preceded the `mousedown`; moves of
  other pointers (a hovering pen while the mouse is held) never settle it.
  Without a recorded pointer, any pointer's buttonless move settles. _(Added
  in owner review.)_
- **A new primary `mousedown` supersedes, it does not settle.** Running the
  earlier press's deferred presentation inside the new `mousedown` would
  change layout during the new press: in a fast double-click the second
  press can arrive before the first click's settle task, and this reproduced
  the original lost click (Chromium, and Firefox under load). The waiting
  callbacks carry over to the new press and run when it settles, reading the
  focus of that time. _(Revised in owner review: the previous revision
  settled on every new `mousedown`.)_
- **`keydown`** settles only after `mouseup`: while the button is
  down the press can still produce a click, so a key press neither settles
  the hold nor applies focus presentation (including `syncNotationFocus` on
  `keyup`). _(Revised in review: the first draft settled on every
  `keydown`.)_
- **Observed, not relied on.** In Chromium and Firefox, `click` was dispatched
  in the same task as `mouseup` for mouse and touch, and React 19 had
  committed the click's updates before the queued task. Settling early would
  only reintroduce the original lost click; it never leaves stale state.
- **Never outlives the press.** After `mouseup` a hold that received no click
  ends at the next buttonless move of its pointer or the next key; a new
  primary press takes it over (with its waiting callbacks) rather than
  ending it. Without a delivered release, the first buttonless move of the
  press's pointer or the window blur ends it. Reveal suppression applies only
  to focus on, or containing, the pressed node during the hold, as in #107.
  Keyboard and programmatic reveals are unaffected, including a Tab while
  the button is held.
- **Presentation reconciles, not replays.** A focus change during the hold
  marks presentation stale. On settle, `focusedDivisionId` and
  `focusedLyricId` are derived again from `document.activeElement` with the
  existing `onFocusCapture` rules. Explicit selection updates in click
  handlers (for example `handleSelectDivision`) are not held.
- **Focus versus selection unchanged.** Tab focuses without selecting;
  Enter/Space select. Keyboard paths never hold.
- **Scope of reveal suppression.** As in #107, a press-given focus is not
  revealed (the control is under the pointer). The syllable strip adopts the
  same rule. No reveal is added after settling.

## Scope and exclusions

In scope: the hold module and its Vitest tests, the three consumers, Playwright
regressions, and the Focus section of
[editor interactions](../editor-interactions.md#focus). Excluded: floating or
reserved-space Divisions controls, any change to notation, selection or
history semantics, other layout changes during a press that are not derived
from focus, and Playwright M2.

## Acceptance criteria and verification

- [ ] Vitest: start and every settle signal, settle only after the click
      task, secondary buttons ignored, new press settles the old, other
      pointers' moves ignored, pressed node cleared, subscribers notified once.
- [ ] Playwright, Chromium and Firefox, without `test.fail()`: division
      click selects (desktop, 320px, scrolled, near the sticky tools); the
      reverse note click selects; the syllable-strip edge press opens the
      syllable; a touch tap selects; keyboard Tab/Enter/Delete unchanged;
      interrupted presses (release away from the target, release outside the
      window, `pointercancel`) leave no held presentation, and a key press
      while the button is down keeps the hold so the click still selects.
- [ ] The legacy `divisions` driver (including #107's edge-press checks) and
      `score-focus-reparenting`, `contiguous-selection`, `editor-toolbar` and
      `continuous-lyrics` pass in each supported browser.
- [ ] Standard gate: `format:check`, `lint`, `test`, `build`,
      `git diff --check`.

## Stop conditions

Stop and report options if settling cannot be ordered after activation
without a timing assumption, if a consumer needs presentation during the hold
for correctness, or if a keyboard or programmatic reveal would be suppressed.

## Delivery

Implement on this branch, commit and push, and open a PR against `master`
that closes #121. Do not merge. Report the implementation commit,
verification, decisions and caveats.

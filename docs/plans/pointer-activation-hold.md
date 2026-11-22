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
- **Start.** A primary-button `pointerdown` (`isPrimary`, `button === 0`) on
  `window`, in capture, for any pointer type. Secondary buttons do not hold.
- **Settle (end).** Settling must never happen before click activation, and
  must never depend on an unguaranteed timer:
  - `click` (captured on `window`): settle in a task queued from that click
    dispatch. The event loop runs it after the dispatch completes, including
    React handlers that call `stopPropagation`, and after React's
    synchronous commit of the click's updates.
  - Immediately, when no activation can follow: `pointercancel` (for example
    a touch scroll), `contextmenu` (long press), `keydown`, window `blur`, a
    new primary `pointerdown` (which settles the previous press first) and a
    `pointermove` with no buttons from the same mouse or pen pointer after
    its `pointerup` (release outside the window with no click).
  - `pointerup` alone never settles, because Chromium touch focus and click
    come after it.
- **Never outlives the press.** Every input that could start keyboard,
  programmatic or new pointer focus settles first. Reveal suppression applies
  only to focus on, or containing, the pressed node during the hold, as in
  #107; keyboard and programmatic reveals are unaffected.
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
      interrupted presses (release outside the target, `pointercancel` from
      a touch scroll, Escape during a press) leave no held presentation.
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

# Plan: Pointer-focus reveal regression

Branch: `fix/pointer-focus-reveal`
Target: `master`
Base: `cfcbd6ac72edfbaffe160a01323651798bd07cb5`
Status: Owner-authorized production bug fix, implemented on this branch and in
review. The PR records the actual verification.

This is a prerequisite of the lyric-move driver repair (maintenance task 0 of
the [M4B plan](editor-readability-m4b.md)). That repair stays on its own branch,
`fix/lyric-move-driver`, and is not part of this change.

## Regression

Pointer-clicking a visible score control inside the reveal margin (8 px) of the
window edge, or just below the sticky tools, can focus it without activating
it. For a lyric, that means it is focused but not selected.

1. `pointerdown`/`mousedown` focuses the control.
2. Since `e3fb1fd` ("fix: reveal native score focus …", PR #86), `ScoreSvg`'s
   `focusin` tracker schedules a minimal reveal one animation frame later for
   **every** focus of a score SVG control.
3. During a human press, that frame runs before release. The page scrolls under
   the held button, the release lands outside the control and no click reaches
   it.

**Reproduction.** At 320×700 with the M4B lyric-move fixture, press the "ri"
lyric at the bottom edge and release after 120 ms:

- at `e3fb1fd^` the lyric is selected;
- at current `master` it is only focused.

Bisecting `7062268..master` with this probe identifies `e3fb1fd`. Chromium
reproduces it. Headless Firefox does not move the page during the press in the
same setup.

## Intended behavior

- Focus produced by a pointer press on the pressed control is not revealed.
  The control is visible under the pointer, which matches behavior before
  `e3fb1fd`.
- Keyboard (Tab/Shift+Tab) and programmatic focus reveal exactly as before,
  including the sticky-toolbar clearance.
- A selection made by the click may still request focus and reveal after
  release, as before.
- Selection, focus requests and the editor session are otherwise unchanged.

## Event-lifecycle boundary

A browser focuses on press as the default action of `mousedown`. That happens
in the same input task as `pointerdown`, before any later `pointerup`,
`pointercancel` or `click` task. The fix:

- records the `pointerdown` target in a capture listener;
- clears it with a zero-delay timer at the end of that task;
- skips the reveal only when the `focusin` target is, or contains, the pressed
  element.

No state survives into a later task. Pointer cancellation, a release outside the
window, or touch focus that arrives after the tap therefore cannot suppress a
later keyboard or programmatic reveal. No global "pointer mode" flag is kept.

## Scope

- `src/editor/rendering/ScoreSvg.tsx` focus tracker only.
- The owning guide: the Focus section of `docs/editor-interactions.md`.
- Browser regression in the existing `divisions` driver, beside its native Tab
  reveal checks. It covers the top and bottom edges with real press/release
  input, a 120 ms hold, no scroll before release, and the lyric **selected**.
- No change to focus ownership, focus requests, the session reducer, keyboard
  handling or sticky-toolbar geometry.

## Verification

- Standard gate: `format:check`, `lint`, `test`, `build`, `git diff --check`.
- The `divisions` driver in Chromium and Firefox, red-to-green in Chromium.
- Focus-related drivers in both browsers where supported:
  `score-focus-reparenting`, `contiguous-selection`, `editor-toolbar`,
  `mid-score-clefs`, `b-accidentals`, `continuous-lyrics`, `vowel-alignment`.
  Compare against `master`.

Stop and report if the fix requires changing focus ownership or browser event
semantics beyond this boundary.

# Plan: Maintenance D — lyric-move browser driver repair

Branch: `fix/lyric-move-driver`
Target: `master`
Base: `2875471c2e0b7b9ce5a77e9f6b54f8030cb1115f` (PR #107 merged)
Status: Implemented on this branch and in review. The PR records the actual
verification.

This is maintenance task 0 of the
[M4B plan](editor-readability-m4b.md#0-maintenance-first-prerequisite-for-m4b-1-onward-repair-the-lyric-move-driver).
That plan owns the background, constraints and stop conditions. This document
records only this task's scope and findings.

## Problem

`docs/verification/lyric-move/browser-check.mjs` (Chromium only) failed on
`master` with `Missing button Move syllable`, at the first `startMove()`
(line 194). Investigation found two independent causes. Both arrived on
2026-11-14 with the sticky-toolbar work (PR #86), after the driver's last
recorded pass on 2026-11-13.

## Root cause 1: stale driver assumption (repaired here)

1. **The click misses the lyric.** The driver selects note 3, then
   pointer-clicks the centre of the `middle` lyric (anchored at n4). The
   element at that point is the **Mora scope** `<select>` in
   `.note-context-toolbar`. The lyric is never clicked, so the selection-gated
   **Move syllable: ri** button never renders.
2. **Why the panel covers it.** Commit `7062268` made `NoteContextToolbar`
   use `scoreViewportTop` so that the panel avoids the sticky tools. At
   1440×1000 there is no longer room above note 3, so `positionNoteToolbar`
   places the panel below the note, over the neighbouring lyric.
3. **Bisection evidence.** The unchanged driver passes at `0cf584e` (the
   parent of `7062268`) and fails at `7062268` with the same assertion. That
   commit updated other drivers for the new placement, but not this one.
4. **Not an application defect.** The
   [documented contract](../editor-interactions.md#consolidated-nearby-note-properties-stage-8c-owner-feedback)
   says the panel "prefers above, then below or spare side room" and "stays
   outside the selected note's bounds". Covering a neighbouring lyric is
   permitted.

## Root cause 2: pointer-focus reveal regression (fixed in PR #107)

With cause 1 repaired, every section passed until the final narrow-viewport
section (320×700). There, a lyric clicked within 8 px of the window edge was
focused but not selected:

- `e3fb1fd` revealed every score focus one animation frame later, including
  focus from a pointer press;
- the page scrolled under the held button, so the release missed the lyric.

Bisecting `7062268..master` identified `e3fb1fd`, and a press held for 120 ms
reproduced it. This was a genuine application defect. With owner
authorization it was fixed separately in
[PR #107](https://github.com/OceanOSdev/gregorian-chant-editor/pull/107),
which also added edge-click regression coverage to the `divisions` driver
(see [plan](pointer-focus-reveal-regression.md)). This branch needs no change
for it: the narrow-viewport section stays exactly as it was.

## Repair scope (driver only)

- Before each pointer click, the driver's click helpers check that the element
  at the click point is the intended target, a descendant of it, or part of the
  target's own neume group. During a lyric move, that neume's destination
  rectangle owns pointer input by design. A covered target now fails with a
  message naming the covering element, instead of silently clicking something
  else.
- After the initial `note(3)` selection, the driver closes the note-properties
  panel with its own **Close note properties** button, which is a real user
  action. It then asserts that the panel is gone and that note 3 is still
  selected.
- Every existing assertion and test case stays. Nothing is removed or loosened
  and no delay is added. The narrow-viewport section is unchanged.
- No production code, reducer, focus, keyboard or layout changes, and no other
  drivers are changed.

## Verification

Run the full driver in its only supported browser (Chromium) to its final
success line, so that every section is exercised. Run it again for stability.
Also run the standard gate and the closely related lyric and focus drivers
(`continuous-lyrics`, `word-composition`, `vowel-alignment`,
`score-focus-reparenting`), comparing each with `master`.

## Delivery

One maintenance PR against `master`. The owner reviews and merges it.

# Plan: Maintenance D — lyric-move browser driver repair

Branch: `fix/lyric-move-driver`
Target: `master`
Base: `cfcbd6ac72edfbaffe160a01323651798bd07cb5` (M4B plan / PR #106 merged)
Status: Implemented on this branch and in review. The PR records the actual
verification.

This is maintenance task 0 of the
[M4B plan](editor-readability-m4b.md#0-maintenance-first-prerequisite-for-m4b-1-onward-repair-the-lyric-move-driver).
That plan owns the background, constraints and stop conditions. This document
records only this task's scope and findings.

## Problem

`docs/verification/lyric-move/browser-check.mjs` (Chromium only) fails on
`master` with `Missing button Move syllable`. The failure is in `startMove()`,
at the first call (line 194).

## Root cause (investigated before any change)

1. **The click misses the lyric.** The driver selects note 3 (`note(3)`), then
   pointer-clicks the centre of the `middle` lyric (anchored at n4). At that
   point, `document.elementFromPoint` is the **Mora scope** `<select>` inside
   `.note-context-toolbar`. The lyric is never clicked or selected, so the
   selection-gated **Move syllable: ri** button is not rendered.
2. **Why the toolbar covers it.** Commit `7062268` (2026-11-14, sticky editor
   toolbar) made `NoteContextToolbar` compute its usable viewport top with
   `scoreViewportTop`, so the panel avoids the sticky tools. In the driver's
   1440×1000 viewport there is no longer room above note 3, so
   `positionNoteToolbar` places the panel below the note. That position covers
   the neighbouring lyric.
3. **Bisection evidence.** The unchanged driver passes at `0cf584e` (the parent
   of `7062268`) and fails at `7062268` with the same assertion. That commit
   updated other drivers for the new placement but not this one.
4. **Classification: stale driver assumption, not an application defect.** The
   documented contract
   ([editor interactions](../editor-interactions.md#consolidated-nearby-note-properties-stage-8c-owner-feedback))
   says the panel "prefers above, then below or spare side room" and "stays
   outside the selected note's bounds". Covering a neighbouring lyric is
   permitted, and a user can close the panel or select the lyric another way.

## Repair scope (driver only)

- Before every pointer click, the driver's click helpers check that the
  element at the click point is the intended target or one of its
  descendants. A covered target then fails with a message naming the covering
  element, instead of silently misclicking.
- Where the note-properties panel legitimately covers the next pointer target,
  the driver closes it with the panel's own **Close note properties** button.
  This is a real user action, and the note selection is kept.
- Every existing assertion and test case stays. No assertion is removed or
  loosened, and no arbitrary delay is added.
- No production code, reducer, focus, keyboard or layout changes. No other
  drivers are changed.

## Verification

Run the repaired driver in its only supported browser (Chromium). Confirm that
every section runs to the final success line, and that the original failing
step is now exercised. Also run the standard gate and the closely related
lyric drivers (`continuous-lyrics`, `word-composition`), comparing each with
`master`.

## Delivery

One maintenance PR against `master`. The owner reviews and merges it.

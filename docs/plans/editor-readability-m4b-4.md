# Plan: Editor readability M4B-4 — named `ScoreSvg` handlers and view-model projections

Branch: `refactor/editor-readability-m4b-4`
Target: `master`
Base: `f1850dd` (PR #114 merged)
Status: Completed (historical record). Implemented and merged in [PR #115](https://github.com/OceanOSdev/gregorian-chant-editor/pull/115) (merge `e155bf1`). The PR holds the actual verification, including any checks not performed. The branch and base above describe the milestone as implemented.

This is milestone M4B-4, the last milestone of the
[M4B plan](editor-readability-m4b.md#m4b-4-named-scoresvg-handlers-and-view-model-projections).
That plan owns the background, agreed decisions (Approach A), behavior
preservation, verification strategy and stop conditions. This document records
only this milestone's scope and specifics.

## Scope

1. **Named handlers in `ChantEditor`** replace the non-trivial inline
   `ScoreSvg` callbacks: note activation, neume-for-note (Shift) activation,
   note-modifier focus, note and neume moves and deletions, clef placement and
   deletion, and division selection and placement. One-line dispatch bindings
   stay inline.
2. **Pure intent mappers** in `interaction/score-note-activation.ts` decide
   lyric navigation versus selection for note and neume-for-note activation,
   including the recovery exclusion and missing-note behavior, with pure
   tests. The shell keeps the toolbar `show()` call before the decision and
   maps each intent to the same session action as before.
3. **View-model projections** `lyricMoveView` and `clefEdit` are computed once
   before the JSX. `clefEdit` and `clefDraftPreview` share one
   editable-draft condition (`editableClefDraft`).

Preserved specifically: the two-dispatch clef deletion; placement guards and
`crypto.randomUUID()` allocation after validation, inside the dispatched
action; `measureLyrics` and point payloads; the lyric-move `''` anchor
fallback and `lyricMoveTargets`. `ScoreSvgProps`, `ScoreSvg` internals, the
reducer, `ClefChangeControls` and toolbar ownership are unchanged. No
`useCallback` is added: the replaced callbacks were recreated every render.

## Verification

- The standard gate and the M4B-4 driver set (`score-focus-reparenting`,
  `contiguous-selection`, `lyric-move`, `continuous-lyrics`,
  `mid-score-clefs`, `divisions`, `b-accidentals`), plus `clefs` and
  `editor-toolbar` for clef placement and toolbar behavior, in Chromium and
  Firefox where supported, compared with `master` at the base.

## Delivery

One PR against `master`. Do not merge. After review, the owner assesses
whether the M4B readability goals are met.

# Plan: Editor readability M4B-3b — pitch handling, division and accidental-properties panels

Branch: `refactor/editor-readability-m4b-3b`
Target: `master`
Base: `24265b8` (PR #113 merged)
Status: Implemented on this branch and in review. The PR records the actual
verification.

This is milestone M4B-3b of the
[M4B plan](editor-readability-m4b.md#m4b-3b-pitch-handling-division-controls-and-accidental-properties).
That plan owns the background, agreed decisions (Approach A), behavior
preservation, verification strategy and stop conditions. This document records
only this milestone's scope and specifics.

## Scope

1. **`ClefPitchHandlingControls`** renders the Pitch handling fieldset
   unchanged. Props: `policy`, `error` (the session's clef-insertion error),
   `disabled` and `onChangePolicy(policy)`. The shell keeps the
   `pitchHandlingShown` visibility check and passes `pitchHandlingBlocked` as
   `disabled`, so an editable clef draft stays enabled and deletion
   confirmation disables it, as before.
2. **`DivisionControls`** renders the Divisions fieldset unchanged. Props:
   `division` (the shell's division target), `lastFocused`, `disabled`
   (`exclusiveModeActive`), `placing`, `insertName`, `onChangeKind(kind)`,
   `onInsert(side)` and `onDelete()`. The shell keeps target selection
   (focused division, else the selected one) and binds the target's ID into
   each callback. The insert callback still goes through
   `insertRememberedNeume`, which allocates IDs when the button is clicked.
3. **`AccidentalPropertiesControls`** renders the content previously passed as
   children of `AccidentalContextToolbar`, as a fragment. Props: `accidental`,
   `document` (read only, for candidate labels), `choosingPlacement`,
   `anchorNoteIds`, `onChangeKind`, `onStartPlacement`,
   `onRestoreDefaultPlacement`, `onDelete`, `onChoosePlacement(noteId)` and
   `onCancelPlacement`. It owns the earlier-note list's ref, which only its
   "Use highlighted note" button reads. The list stays uncontrolled, with the
   same `defaultValue`, `size` and Enter handling.
   `AccidentalContextToolbar`, its ref, `key`, `onEscape` and `onHistory` stay
   in the shell unchanged.

No component receives `session` or `dispatch`. `ClefChangeControls` is
unchanged. `docs/architecture.md` lists the three components and their
ownership.

## Verification

- The standard gate and the M4B-3b driver set (`mid-score-clefs`, `divisions`,
  `b-accidentals`, `b-accidentals-acceptance`), plus `css-zoom-toolbars`,
  `editor-toolbar` and `clefs`, in Chromium and Firefox where supported,
  compared with `master` at the base.
- The DOM baseline comparison of `main.chant-editor` and portal content in the
  planned states, plus targeted pitch-handling, division and accidental
  placement states, with temporary, uncommitted capture tooling.

## Delivery

One PR against `master`. Do not merge. Do not begin M4B-4.

# Plan: Editor readability M4B-2 — keyboard routing and documented event precedence

Branch: `refactor/editor-readability-m4b-2`
Target: `master`
Base: `36adb0a` (PR #109, M4B-1, merged)
Status: Implemented on this branch and in review. The PR records the actual
verification.

This is milestone M4B-2 of the
[M4B plan](editor-readability-m4b.md#m4b-2-keyboard-routing-and-documented-event-precedence).
That plan owns the background, agreed decisions (Approach A), behavior
preservation, verification strategy and stop conditions. This document records
only this milestone's scope and specifics.

## Scope

1. **Pure classifiers.** `src/editor/interaction/editor-shortcuts.ts` holds one
   classifier per `ChantEditor` keyboard listener. Each reproduces that
   listener's current conditions and order exactly:
   - `getPendingTransactionCancel` for the document capture listener
     (accidental placement, then clef transaction);
   - `getLyricMoveKeyIntent` for the `<main>` capture handler;
   - `getDocumentShortcut` for the document bubble listener (clipboard, L,
     I/T, Escape fallback, Undo/Redo). It reuses `getClipboardShortcut`,
     `isLyricEntryShortcut` and `getNotationShortcut` unchanged.

   A held repeat that a listener claims without dispatching is the named
   intent `held-repeat`.

2. **Listeners stay the owners of events.** Attachment points, phases,
   `preventDefault`/`stopPropagation`, DOM reads (target ancestry, native text
   selection, editable targets), ID allocation and dispatch order stay in
   `ChantEditor`. The listeners build the classifier's inputs from the DOM
   and translate its intent into the same dispatches as before.
   - The L target (focused note, else focused lyric, else selection) and the
     I pre-selection of a focused division or clef change stay in the
     listener. They are DOM reads and a two-dispatch sequence, not key
     classification. Pre-selection is M4B-4 territory, if anywhere.
   - The `<main>` handler passes React's normalized `key` and modifiers, and
     the native `isComposing`, exactly as it read them before.

3. **Effect dependencies.** `placementKind` and `history.present` are removed:
   neither handler reads them. Every value the handlers read is still a
   dependency, so closures stay fresh. The listeners are now re-attached less
   often (not on every document edit). No other document-level `keydown`
   listener exists, so listener order is unaffected.

4. **Documentation.** `docs/editor-interactions.md` gains the authoritative
   "Keyboard event precedence" table and shared-key resolution.
   `docs/architecture.md` links to it from the `interaction/` section without
   copying it.

No component-local handler, JSX, DOM, reducer, action, focus, clipboard or
shortcut changes. Issue #99 is not implemented.

## Verification

- Pure classifier tests: every exclusive mode, Escape precedence across the
  three listeners, editable targets, composition, `defaultPrevented`,
  autorepeat, modifier combinations, clipboard scope and native text
  selection, notation and score scope, and existing exclusions.
- The standard gate and the M4B-2 driver set, in Chromium and Firefox where
  supported, compared with `master` at the base.
- Manual keyboard focus and Escape checks in a real browser, recorded only if
  performed.

## Delivery

One PR against `master`. Do not merge. Do not begin M4B-3a.

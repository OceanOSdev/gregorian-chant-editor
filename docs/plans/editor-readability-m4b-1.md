# Plan: Editor readability M4B-1 — availability rules, accidental projection, toolbar origin

Branch: `refactor/editor-readability-m4b-1`
Target: `master`
Base: `667d49f` (PR #108, maintenance task 0, merged)
Status: Implemented on this branch and in review. The PR records the actual
verification.

This is milestone M4B-1 of the
[M4B plan](editor-readability-m4b.md#m4b-1-pure-availability-rules-accidental-projection-explicit-toolbar-origin).
That plan owns the background, agreed decisions (Approach A), behavior
preservation, verification strategy and stop conditions. This document records
only this milestone's scope and specifics.

## Scope

1. **Presentation availability rules.** `src/editor/state/editor-availability.ts`
   names each distinct UI availability condition that `ChantEditor` used
   inline. Each rule's comment says how it differs from similar rules. The
   conditions are unchanged, and the shell calls the named rules. They are
   presentation only: `reduceEditorSession` keeps every guard.
   - Single-field conditions (for example `Boolean(session.clefTransaction)`
     on **Place clef with keyboard** and `transactionBlocked`, and
     `!!accidentalTarget` inside the accidental panel) stay inline, because a
     name would only repeat the field.
   - `clipboardBlocked` stays in `editor-session.ts`, because the reducer
     shares it.
   - Keyboard-handler conditions are M4B-2. `ScoreSvg` callback conditions
     (`onExtendSelection`, `onClearSelection`) are M4B-4.
2. **Selected-note accidental projection.**
   `src/editor/state/selected-note-accidental.ts` returns the written sign,
   the effective B, its source (`written`, `inherited` or `default`) and the
   existing toolbar wording. The JSX passes the projected values through.
3. **Neume-toolbar origin.** `recordNeumeToolbarOrigin` is the only writer of
   `neumeToolbarOrigin`. `getSelectedNeumeElement` only reads.
   - `onFocusNoteModifiers` calls `recordNeumeToolbarOrigin` directly, where
     it previously called the getter only for its side effect.
   - The whole-neume `NoteContextToolbar` receives `getNeumeToolbarAnchor`,
     which records first and then reads. The origin is therefore recorded at
     exactly the same moments as before: every anchor read during
     positioning, focus, Escape and Tab.
   - `NoteContextToolbar`'s props are unchanged.
4. **Documentation.**
   - `docs/architecture.md` describes the availability module and records
     `ClefChangeControls(session, dispatch)` as an intentional exception to
     the narrow-props convention.
   - `docs/plans/editor-readability-m4a.md` is marked completed in PR #105.

No JSX structure, DOM order, ARIA, labels, reducer, history, command,
persistence or shortcut changes.

## Verification

- A pure matrix covering every rule in every reachable mode:
  - idle;
  - neume, division and clef placement;
  - clef-change and passage selection;
  - clean lyric entry, dirty draft and recovery;
  - lyric move;
  - pending history;
  - clef transaction, with and without a candidate;
  - accidental placement.

  Named tests pin each intentional difference.

- Pure tests of the accidental projection: non-B, default, written,
  inherited, a natural cancelling an earlier flat, and a later B in the same
  neume.
- The standard gate, plus the M4B-1 driver set from the overarching plan and
  `lyric-move`, in Chromium and Firefox where supported. Compare against
  `master` at the base.

## Delivery

One PR against `master`. Do not merge. Do not begin M4B-2.

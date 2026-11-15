# Plan: Sticky editing toolbar and unified division insertion

Branch: `feat/sticky-editor-toolbar`
Target: `master`

## Goal

Keep frequently used notation and editing tools accessible while authoring a
long chant. The bundled Kyrie XI is the motivating example. Make division
insertion consistent with neume and clef insertion at the same time.

## Agreed scope

- Move the existing DocumentControls above the notation toolbar; the document
  header and document-level settings (lyric language and initial clef) scroll
  normally. Preserve all document and persistence behavior.
- Group the existing notation palette, Quilisma figure selector, and
  Lyrics/Insert/Undo/Redo actions in one compact sticky region. Prefer native
  CSS sticky positioning in the existing page scroll, with an opaque
  background and appropriate stacking. Keep the score's horizontal scrolling
  and engraving/layout unchanged. Leave keyboard help, clef pitch handling,
  and selected-division/clef editing controls outside the sticky region.
- Add one division split control to the notation palette, after the clef
  tools. Its primary arms Minima; its menu offers Minima, Minor, Maior and
  Finalis. Choosing a variant arms it immediately. Follow the existing
  primary/variant, pressed-state, roving focus, menu keyboard and dismissal
  conventions. Reuse the existing split-control implementation by
  generalizing it narrowly as appropriate; do not duplicate menu logic.
  Provide recognizable division glyphs using existing division geometry where
  practical, with accessible names.
- Remove the standalone division placement kind selector and Place division
  button. Keep the existing change-kind, delete, and Insert remembered neume
  before/after controls for a selected or last-focused division, with existing
  target resolution, guards and semantics. Do not introduce a new contextual
  division toolbar.
- Preserve existing division placement behavior: semantic-slot ghost and
  insertion, one history edit per placement, persistent armed mode, Escape to
  Select, and existing lyric-draft/transaction policies. Division placement
  must not change the remembered neume or the existing I/T shortcut meanings;
  T still recalls the remembered neume's palette control. Do not treat a
  division as a pitched neume or change its semantic representation.
- Preserve palette roving Arrow/Home/End, native activation, split-menu
  focus/dismissal, notation shortcuts, selection and focus restoration.
  Reconcile any DOM Tab-order documentation with the deliberate reordering.

## Implementation considerations

Inspect ChantEditor, App.css, NeumeFamilyMenu, palette-navigation and the
existing focus and context-toolbar helpers. Use CSS-first positioning; no new
scroll surface, duplicated toolbar, fixed-height assumption, global state or
dependency. Keep menus unclipped and ensure sensible stacking with floating
note/accidental toolbars. Account for the actual sticky region's occupied
bounds in focusAndReveal for score targets and in note/accidental context
toolbar visibility/positioning, so focused notation and panels are not
obscured. Preserve normal behavior when the toolbar is not sticky, and
avoid forcing scroll when the target is already visible. Do not change
engraving geometry. Use existing responsive wrapping, with a simple non-sticky
fallback where viewport height is too small for useful score editing.
Choose exact CSS thresholds/geometry based on implementation and browser
evidence; no mobile redesign. Ensure clef pitch handling and existing
transaction controls remain accessible and keyboard operable.

## Acceptance and verification

- Load bundled Kyrie XI, scroll several systems down: document header leaves
  view, toolbar stays accessible. Choose neumes and place them in lower
  systems without jumping to the document top; verify undo/redo and selection.
- Exercise the division primary and all four menu variants by pointer and
  keyboard, including repeated placement, ghost, Escape, and existing
  selected/last-focused division editing and explicit before/after insertion.
  Verify remembered-neume I/T behavior, draft guards and atomic history.
- Check existing split menus (including dismissal-only score click), roving
  focus, Tab/Escape, and focus restoration. Menus must not clip or trigger
  unintended edits.
- Exercise score focus/reveal in both directions, including targets behind
  the sticky region, no unnecessary page scrolling, and horizontal score
  reveal. Verify note and accidental contextual toolbars remain accessible
  and do not overlap the sticky toolbar; exercise clef and lyric controls
  and focus transitions.
- Check wide, narrow/wrapped, and short viewports (including non-sticky
  fallback). No score width or engraving regressions from toolbar changes.
- Add focused unit regression tests where pure navigation/visibility logic
  changes and targeted browser regression coverage using the existing
  verification runner. Run affected browser drivers in Chromium and Firefox
  and the standard repository gate (format:check, lint, test, build,
  git diff --check). Use the bundled Kyrie XI or an equivalent long fixture
  for the sticky-scroll scenario. Record actual results and any unsupported
  or unrun checks; no comprehensive matrix unless the change warrants it.
- Update the relevant sections of docs/editor-interactions.md and any
  affected verification/roadmap documentation; follow AGENTS.md and the
  testing guide. No new ADR expected unless a durable architectural decision
  unexpectedly changes.

## Exclusions and delivery

No range selection, clipboard, repertoire transcription, vertical spacing,
engraving refinements, schema changes, or broad toolbar/interaction refactor.
Ordinary implementation choices need no second design review; report material
conflicts or scope expansion before implementing them.

Commit and push to this branch, open a PR targeting master, and report the
implementation SHA, actual verification, caveats and remaining owner checks.
Include a screenshot or short recording of the sticky UI if practical.
Do not merge.

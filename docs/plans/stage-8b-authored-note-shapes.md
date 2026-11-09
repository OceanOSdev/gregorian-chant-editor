# Plan: Stage 8B — Virga, punctum inclinatum, and quilisma

Branch: `feat/stage-8b-note-shapes`
Target: `master`

Status: **Planned — awaiting owner approval of proposed ADR 0019.**
No implementation has been authorized on this branch.

## Goal

Expand the vocabulary of **authored square-notation note shapes** without
turning every decorated note into a new melodic neume kind. A user should be
able to insert or select a standalone Virga or Punctum inclinatum, and **place
a quilismatic ascending figure with one click**, while retaining correct
selection, rhythmic modifiers, lyrics, document persistence and engraver
geometry.

This is the next limited notation milestone after merged Stage 8A (PR #64),
not a general rewrite of notation, pitch, grouping or layout.

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`,
`docs/domain-model.md`, `docs/commands-and-history.md`,
`docs/layout-and-rendering.md`, `docs/engraving-metrics.md`,
`docs/editor-interactions.md`, `docs/persistence.md`,
`docs/testing.md`, Accepted ADRs 0003, 0004, 0007, 0010, 0016, 0018 and
[proposed ADR 0019](../adrs/0019-authored-note-forms-and-neume-contours.md).

## Musical research and design constraints

Before drawing new SVG contours, reproduce small **actual Gregorio** reference
scores and compare selected cases with traditional square-notation samples.
Useful starting points:

- [Gregorio GABC fundamentals](https://gregorio-project.github.io/gabc/):
  capital pitch for a standalone inclined note, `v` for a Virga, `w`
  after a pitch for a Quilisma inside a neume.
- [Gregorio inclined-form guide](https://gregorio-project.github.io/tips/inclinatum.html):
  ascending, descending and unison inclined variants are different shapes,
  and some are inferred from neighboring pitches.
- [Gregorio advanced syntax](https://gregorio-project.github.io/gabc/details.html):
  glyph grouping, neumatic cuts and quilisma-pes construction.
- [Gregorio example walkthrough](https://gregorio-project.github.io/tutorial/tutorial-gabc-file-01.html):
  virgae and inclined notes within an actual chant.
- [LilyPond square-neume reference](https://lilypond.org/doc/v2.24/Documentation/notation/typesetting-gregorian-chant):
  shape versus connected-neume distinction.
- The already approved local `src/editor/layout/neumes/climacus.ts`:
  a derived initial Virga and two pitched inclined diamonds exist today;
  study/reuse proportions without changing the existing default Climacus.

Preserve primary-source and output distinctions: a syntax accepted by Gregorio
does **not** establish an editorially common usage, just as Stage 8A taught us.
Capture actual before/after specimens of one-note Virga and Inclinatum,
quilismatic Podatus and Scandicus, including close/wide adjacent intervals.
If the proposed connected shapes differ materially from musical references,
stop with alternatives before implementing guessed contours.

## Proposed Stage 8B semantic contract

Subject to ADR 0019 owner approval:

- Keep the existing seven melodic `Neume['kind']` variants and their
  ordered note tuples. Add a small **optional explicit note form** on
  `ChantNote`, not a separate full neume type or standalone glyph event.
  Omission means current contextual/default shape, not an authored override.
- Valid explicit configurations initially:
  - One-note Punctum semantic unit: **normal square / Virga /
    Punctum inclinatum**. A standalone inclined note uses one consistent
    upright/neutral form; forced ascending/descending slants deferred.
  - Two-note ascending Podatus: **Quilisma on the first/lower note**,
    rendered as a connected quilismatic pes. Validate reference shape.
  - Three-note ascending Scandicus: **Quilisma on the middle note**,
    rendered as a connected rising group; the Quilisma may connect to
    more than a single following punctum as the shape warrants.
- Everything else remains context-derived: e.g. the current Climacus
  uses a Virga + descending inclined heads without persisting an explicit
  note-form value. Do not create spurious default fields on v1/v2 import.
- Invalid combinations (e.g. standalone Quilisma, Quilisma on a descending
  Porrectus, arbitrary Virga replacing a connected Clivis head) are rejected
  with clear interaction feedback rather than silently normalized.
  This limited matrix is a product profile, not a universal ban on other
  historical shapes.
- Changing form never changes pitch, number/order of notes, stable IDs,
  syllables, divisions, clefs or note-level rhythmic modifiers. If a move,
  deletion or normalization would make a surviving authored form invalid,
  choose a predictable **non-destructive** behavior; by default reject the
  offending edit, explaining why, rather than silently delete/change a form.
  Verify all normalization branches and that ordinary unmarked note editing
  remains unchanged.
- Do not add forms to all notes mechanically, duplicate shape state in layout
  and semantics, or introduce a generalized plugin glyph engine. Shape
  validation is shared by commands and strict native decoding.

## Editor experience

- Offer **direct one-click insertion** for a standalone Virga and standalone
  Punctum inclinatum in the existing neume palette/placement flow. Users
  preselect the tool and click the staff; no per-click popup.
  Existing placement, ghosts, keyboard shortcuts, selection/focus, and
  song-pitch snapping rules remain valid. At 320px, don't force the toolbar
  to overflow horizontally.
- Offer **one-click insertion of a Quilisma figure** as well. A user
  preselects Quilismatic Podatus or Quilismatic Scandicus through a compact
  figure chooser associated with the Quilisma tool, then clicks the staff
  once to insert the complete ascending figure with the correct note-form
  field already attached. No per-placement popup, preliminary ordinary-neume
  insertion, or follow-up modifier step. Reuse existing snapped multi-note
  placement defaults and permit subsequent pitch editing. Keep this
  preselection available before any click and remember it during placement.
  Prefer one Quilisma tool plus a small figure selector to two additional
  permanent toolbar buttons; ensure mobile/narrow layouts remain usable.
- Offer a **selected-note Form** control for valid shape changes in existing
  one-note and ascending multi-note contexts. In a Scandicus, selecting its
  middle note exposes Quilisma versus default; in Podatus selecting the lower
  note exposes Quilisma versus default. Other notes should not suggest
  unsupported options. Clear labels describe what is being edited.
- Keep the Stage 8A Mora scope control distinct from the note's Form control
  and the independent Horizontal episema control. Pending lyric/clef/history
  workflows keep their established guards. Selection/deselection must not
  move the score vertically (the Stage 8A stable-control fix is a regression
  constraint). Accessible note names announce the authored form. Reuse
  contextual controls without adding modal dialogs or creating an enormous
  new permanent palette of every combination.
- One form change is one undoable command with canonical no-op identity,
  stable note IDs and synchronous autosave. A direct insertion creates the
  correctly shaped note in the same operation. Both methods survive
  refresh, v3 export/import and undo/redo without loss of modifiers.

## Engraving and layout

- Implement original, square-notation-proportioned Virga,
  Punctum inclinatum and connected Quilisma forms based on the
  reference cases. Existing default glyph paths (including the initial
  Climacus Virga and its two inclinata) are approved and should be preserved.
- A standalone Virga has an authentic head and stem, positioned relative to
  staff. Inclinatum is an actual inclined/diamond note, not an icon/italic
  square. Quilisma is a jagged/wavy note form **at one of the pitched note
  positions**, connected appropriately to the following ascending note
  where conventional, not a floating symbol or extra pitch.
- Reuse shared `NeumeGeometry`, ink bounds/advance, notehead hit targets,
  selection contours and lyric anchors. Form changes alter measured geometry
  and reflow; previews must match committed ink. Ensure dots and horizontal
  episemata don't overlap the new head/stem/wave, and check clefs, divisions,
  custodes, neume boundaries and multisystem wrapping.
- Geometry should never quietly omit an authored form or fall back to an
  ordinary square while pretending to preserve its data. No unmeasured
  SVG decorations, no opaque images/fonts or global CSS transform hacks.
- Do **not** implement all ascending/descending/unison inclinatum
  orientations, virga reversa, generic fusion, disconnected neumatic cuts,
  multi-note repeated inclined passages or other new neume groupings in
  this milestone. If correctness requires one, stop with evidence and a
  narrow scope recommendation.

## Native-format v3 compatibility

- **Write v3** for new exports and local autosaves with the optional
  explicit note-form field. Continue to accept exact v1 and finalized v2
  semantic files with their existing note identities, mora scopes,
  episemata and event orders.
- **Do not weaken or bypass v2's strictness.** In particular retain
  explicit protected recovery for withdrawn draft-v2 `mora: 2` or
  unsupported historical mora arrangements, and prevent silent cache
  overwrite or automatic conversion. v2's strict permitted fields must
  remain unchanged; v3 alone accepts valid form fields.
- Use the existing single namespaced browser-local cache key, byte conflict
  detection and confirmed replacement safeguards. A valid v1/v2 score
  hydrates without writing; the first *committed* change saves v3 under
  the same key, with all unaffected data preserved.
- Validate full v3 field shape and whitelist across each note/neume before
  replacing a document. Unknown form/version, malformed values or
  unsupported combinations must not mutate the active score or cache.
  Preserve/download original bytes where recovery is required.
- Document that older app versions cannot be assumed to import v3 files.
  Do not introduce GABC interchange as a shortcut around native-format
  versioning.

## Verification / acceptance

1. Insert isolated square Punctum, Virga and Punctum inclinatum by pointer
   and keyboard; distinguish all three graphically at line, space and
   boundary pitches. Switch forms through selected-note controls. No
   unexpected new note or syllable, no hit-target ambiguity. Test Quilisma tool preselection before a
   graphical click, ghost fidelity, and no per-click popup.
2. Insert a quilismatic Podatus and quilismatic Scandicus **directly in
   one click each**, choosing the figure beforehand; then place ordinary
   versions of both and convert the **first** Podatus note and **middle**
   Scandicus note to Quilisma using contextual controls.
   Verify correct connection, individual pitch identity, selected-note
   feedback and reference-like contour for close/wide intervals.
   Check at least one quilismatic ascending case where the followed note
   is also part of the same multi-note rising figure.
3. Keep the existing default Climacus Virga + inclined notes unchanged
   after v3 migration and ordinary editing. No attempt to author duplicate
   derived form fields there.
4. Form changes do not alter mora/episema values, semantic note IDs,
   associated syllables, neume kind or pitches. Verify form+mora,
   form+episema, and resulting collisions. Undo/redo, move, delete,
   normalization and history no-op/invalid intents behave consistently.
5. Check graphical ghosts, precise SVG hit/focus/selection geometry,
   measured ink, wrapping, lyrics, clef/division/custos boundaries,
   320px, desktop and actual zoom. No score jumps merely from selection.
6. Round-trip v3 native files, immediately refresh after a committed form
   edit, import an **actual baseline v1** and **actual Stage 8A v2** file
   without rewriting values/IDs, then commit and recover v3.
   Recheck incompatible draft-v2 cached bytes and failed imports remain
   protected, including original-source download and multi-tab conflict.
7. Validate strict version-specific schemas; reject invalid/unknown forms
   and future versions, duplicates, unsafe pitches, shape-pitch violations
   and size overflows with unchanged active content.
8. Produce side-by-side reference and editor screenshots for all three
   new shape families, plus a v1/v2/v3 migration record and an owner-friendly
   manual review checklist. Run `npm run format:check`,
   `npm run lint`, `npm test`, `npm run build`, `git diff --check`,
   and real Chromium/Firefox browser drivers against the production
   GitHub Pages subpath build. Record actual checks separately from
   manually deferred verification.

## Exclusions / stop conditions

No extra neume kinds, forced inclinatum orientation, virga reversa,
bivirga/trivirga, long incline runs, salicus, pressus, oriscus,
strophicus, liquescences, flats/naturals, manual note-group splits,
playback, GABC import/export, general glyph-font engine, or unrelated
refactors.

**ADR 0019 is Proposed.** Stop at the architectural gate until the owner
accepts or revises it. The key owner choices are *optional note-form on an
existing note rather than a new neume kind*, the above supported contexts,
and native v3 compatibility. If actual Gregorio/typeset evidence contradicts
the quilisma-pes or middle-Scandicus contour, or an allowed operation would
silently destroy authored shapes, stop with examples and options before
implementing an incompatible design.

## Delivery

After the ADR is Accepted, implement on this branch per
`docs/ai-workflow.md`, update owning docs/roadmap and ADR index,
commit and open a PR targeting `master`. Report architectural deviations,
tests, reference comparisons, and remaining foreground manual checks.
Do not merge. Retain the plan as review evidence and mark it Completed only
upon owner acceptance before merge.

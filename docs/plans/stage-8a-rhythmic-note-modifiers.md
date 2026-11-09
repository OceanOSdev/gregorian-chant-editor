# Plan: Stage 8A — Punctum mora and horizontal episema

Branch: `feat/stage-8a-note-modifiers`
Target: `master`

Status: Implemented for PR review; owner acceptance and plan closeout remain pending.
ADR 0017 is Accepted. Actual verification and remaining manual checks are in
[the Stage 8A record](../verification/note-modifiers/README.md).

## Problem and user-visible goal

Authors can insert seven ordinary neume kinds, divisions and clefs, but cannot
annotate a particular note with the common rhythmic signs found in modern
square-notation chant scores. Stage 8A adds **single/double punctum mora dots**
and **horizontal episema**, while preserving authentic-enough placement,
existing score editing/engraving conventions, the first persisted native
document format, and working same-browser recovery.

Consult `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`,
`docs/domain-model.md`, `docs/commands-and-history.md`,
`docs/layout-and-rendering.md`, `docs/engraving-metrics.md`,
`docs/editor-interactions.md`, `docs/persistence.md`, `docs/testing.md`,
Accepted ADRs 0002, 0003, 0004, 0007, 0010/0011, 0016 and
[Accepted ADR 0017](../adrs/0017-model-rhythmic-modifiers-on-notes.md).

Notation sources for qualitative reference:

- [Gregorio advanced GABC notation](https://gregorio-project.github.io/gabc/details.html)
  (punctum mora `.`, double dots `..`, horizontal episema `_`,
  derived top/bottom placement and optional bridging).
- [Gregorio tutorial](https://gregorio-project.github.io/tutorial/tutorial-gabc-01.html)
  (dots interacting with compound neume geometry).

Use these as notation references, not as requirements to implement GABC
syntax, every custom glyph, or sophisticated Gregorio engraving controls.

## Product decisions

- The author selects an **individual note** of any supported neume (not the
  entire neume), then uses contextual controls to choose **Mora: None /
  Single dot / Double dot** and **Horizontal episema: Off / On**. Prefer
  unobtrusive controls in the existing selected-note UX to introducing
  placement tools for standalone marks.
- All seven current neume kinds support both modifiers per constituent note.
  Both may coexist on one note; there is no hardcoded restriction to the final
  note of a neume. Optional properties live on the note's stable semantic ID.
- Default horizontal episema placement above or below is automatic.
  A single note's episema should look like a short horizontal stroke anchored
  to that note. Where contiguous marked notes _within the same neume_ can
  naturally share a continuous stroke, join them only when geometrically safe;
  a separate stroke is better than a collision or misleading mark.
  Explicit custom positioning, bridge/break editing, across-neume/system
  joining and multiple different episema strokes on the same note are future
  features. Never join across an authored clef/division, lyric boundary or
  system break.
- One or two mora dots appear next to the intended **note head**, positioned
  in a suitable available space without obscuring another note, stem,
  adjacent episema, staff line or clef. When a note sits on a staff line,
  prefer moving the dot into the adjacent space rather than painting through
  the line. The precise geometrical recipe should be derived from reference
  examples and reviewed with rendered screenshots. Avoid excessive rightward
  spacing for the ordinary single-dot case, while still measuring actual ink.
- Controls expose current modifier state for the selected note; changing one
  modifier should not reset the other. Provide note-level accessible labels,
  focus behavior and keyboard interaction, and reflect modifiers in
  accessible score descriptions where appropriate. Do not hijack existing
  note keyboard arrows or placement shortcuts.
- Sign changes are whole-document semantic edits with atomic history,
  no-op identity, stable IDs and immediate autosave. Moving notes/whole neumes
  keeps surviving note modifiers; deleting/normalizing keeps only modifiers
  on surviving note IDs. No lyrics/clefs/division semantics change.
- No timing claims or playback behavior.

## Domain, layout and interoperability constraints

- Add a small optional note-level semantic representation with a strictly
  validated `0|1|2`-equivalent mora count and horizontal episema presence.
  Absent fields mean **no modifier**. Do not create separate event IDs or
  duplicate full-neume variants. Exactly how to spell optional properties
  belongs to the ADR / implementation, not to the rendering layer.
- Existing shared geometry must remain the source of truth for painted
  marks, measured `bounds` / `advanceX`, wrapping, notation collisions,
  hit/selection zones and focus/reveal. Preserve the approved notehead
  silhouettes and lyric anchor position. Avoid drawing non-measured floating
  SVG strokes in `ScoreSvg` and avoid whitespace hacks in the UI.
- Pay particular attention to dotted _Podatus_, _Clivis_, _Torculus_,
  _Climacus_ and _Porrectus_, and to consecutive marked notes.
  Verify marks near system ends, close to divisions, nearby clefs/custodes,
  and adjacent hyphenated lyrics. Typical signs on in-staff notes must
  not cause unexpected huge gaps. Extraordinary outside-staff ink should
  not be silently clipped; document existing vertical layout limits.
- Update graphical preview logic where relevant so the derived committed
  glyph remains consistent with preview and layout metrics.
- **Native format v2 is required.** Continue reading exact v1 JSON payloads
  and existing cached v1 documents, add strictly validated v2 optional note
  modifiers, and write new exports/autosaves as v2. V1-to-v2 upgrade supplies
  _no_ marks and preserves all existing IDs, notes, lyric anchors, division
  and clef order. Reject invalid modifier values, malformed object shapes,
  unknown future versions, and oversized data with unchanged recovery
  guarantees. Use a deliberate migration strategy for the namespaced
  browser-local key; **do not lose an existing v1 autosave by switching keys
  without migration**. Preserve v1 decoder behavior and one-document
  recoverability under Accepted ADR 0016.
- Keep v2 semantic data independent from graphical sign coordinates.
  This work should not introduce an extensible polymorphic sign framework
  unless a concrete need is demonstrated; prefer simple maintainable code.
- Update the persistence guide, domain model, engraving metrics,
  interactions, roadmap and relevant verification evidence. Document v1
  compatibility, v2 changes, migration test, and clearly deferred signs.

## Acceptance criteria and verification

1. In a punctum, add/remove one mora dot and two mora dots. In an ordinary
   podatus, dot the first note then the second; ensure marks appear on
   the intended note, fit the glyph, and do not unnecessarily stretch the
   word.
2. In a Clivis, Torculus, Scandicus, Climacus and Porrectus, change the
   modifier of each constituent note independently. Show accessible
   selected-note state, and verify simultaneous dot + horizontal episema.
3. Add horizontal episemata to individual notes and contiguous notes
   in appropriate neume contexts. Confirm no overlaps, misleading bridges
   or unmeasured painted ink. Test collision with mora dots, line-vs-space
   pitches and near-staff boundary positions.
4. Undo/redo modifier edits atomically, including after moving a note,
   moving the whole neume, deleting a note and resulting kind
   normalization. Confirm surviving notes retain exactly their marks.
   Selecting one note must not alter another.
5. Layout and wrapping include the sign ink for close-set syllables,
   wide multisystem passages, divisions and clef-change/custos boundaries;
   no regressions to existing undotted chants, visual noteheads, hyphens,
   insertion targets or clipboard-like control focus.
6. Export a representative modified chant as native v2; import it and
   confirm exact semantic equality. Refresh immediately after a modifier
   change; same-browser recovered document retains marks. Import a
   **real baseline v1 file** (including the original sample and an
   authored-clef/division example) and recover a preexisting v1
   `localStorage` value; preserve all original semantics with no
   newly introduced signs. Make a change and verify v2 save without
   overwriting corrupt/foreign content.
7. Reject v2 files with negative/extra/fractional/incorrect modifier
   properties, unknown fields and unsupported versions; corrupt caches
   retain explicit recovery behavior and do not get silently erased.
   Existing filename/safe integer/size checks still pass.
8. Run `npm run format:check`, `npm run lint`, `npm test`,
   `npm run build` and relevant real Chromium/Firefox automation,
   using production repo-subpath builds. Record actual evidence with
   screenshots or fixture cases for single, compound and multi-system
   marks, and provide owner-friendly manual acceptance steps.

## Scope exclusions

No vertical episema/ictus, flat/natural, quilisma, virga, liquescent,
oriscus, pressus, new neume shape, GABC import/export, playback, manual
sign orientation, custom mark spacing, user-directed bridging, separate
event IDs, cloud storage, or unrelated UX/refactor work.

## Architectural gate, ambiguities and stop conditions

**ADR 0017 is Accepted (owner-approved 2026-11-09).** The architectural
approval gate is cleared. Implement the note-level semantic fields and
native format v2 within this contract. Significant new design conflicts or
scope changes still require the normal owner review.

If inspection of actual reference notation shows that 1/2 mora counts
cannot faithfully be modeled per note, that connected horizontal episemata
need explicit authored state, or that safe v1 local-cache migration requires
a different approach, stop with specific samples and alternatives rather
than quietly expanding scope or weakening persisted-format validation.

## Delivery

Following `docs/ai-workflow.md`, implement on this branch. Run applicable
tests and independent visual review,
commit and open a PR against `master`. Do not merge. Explain architectural
deviations, verification, documented limitations and remaining manual checks.
Close out the one-off plan appropriately during PR review.

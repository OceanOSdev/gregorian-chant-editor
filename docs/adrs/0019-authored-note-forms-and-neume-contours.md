# 19. Represent authored note shapes separately from semantic neume contours

Date: 2026-11-09

## Status

Proposed — requires explicit owner acceptance before Stage 8B implementation.

## Context

The editor has seven pitch-contour neume kinds, identified by stable note IDs
and ordered note tuples under Accepted ADR 0004. Their geometry is derived
from kind and pitch under Accepted ADR 0007. A Climacus already renders its
first constituent as a virga and its descending constituents as inclined
diamonds, but these forms are not independently authorable. Stage 8A
added note-level conventional rhythmic signs under Accepted ADR 0018.
Native versions 1 and 2 now have public compatibility obligations.

Gregorian square notation distinguishes the *shape of a note* from the
*melodic shape of a neume*:
- A single pitch can use a punctum quadratum, virga, or punctum inclinatum.
- A quilisma is a distinctive wavy note **within** an ascending figure. It is
  not a new three-pitch note and cannot be added as a floating decoration.
- Stems and inclined heads can also be **derived** from a compound neume's
  existing shape; they should not automatically become separate authored
  flags. Gregorio chooses many virgae and inclinatum orientations from context.

Primary reference:
- https://gregorio-project.github.io/gabc/ (one-note forms, virga, quilisma
  inside complex neumes)
- https://gregorio-project.github.io/tips/inclinatum.html (context-dependent
  ascending/descending/unison inclinatum silhouettes)
- https://gregorio-project.github.io/tutorial/tutorial-gabc-file-01.html
  (using virga and inclined heads in longer examples)
- https://gregorio-project.github.io/gabc/details.html (connected groups and
  exceptional engraving rules)
- https://lilypond.org/doc/v2.24/Documentation/notation/typesetting-gregorian-chant
  (separately identified quilisma and notehead forms).

## Proposed decision

1. Model **explicitly authored non-default note forms** as a small optional
   semantic choice on the existing stable-ID `ChantNote`, e.g.
   `form?: 'virga' | 'inclinatum' | 'quilisma'`. Omission means the
   **existing context-derived normal form**, *not* an explicitly square head
   overriding every compound neume. Exact spelling can be chosen during
   implementation but the semantic distinction must survive serialization.
   A note form changes engraving only, never pitch, melody, relative note
   order, neume cardinality, syllable anchors or note IDs.
2. The seven existing semantic neume kinds remain **melodic/contour kinds**.
   Do not add a full `QuilismaNeume` for every ascending configuration or
   proliferate separate `VirgaNeume` and `InclinatumNeume` kinds.
   Ordinary single-note forms remain one-note `punctum` semantic units;
   the UI should label them by their visual form rather than misleadingly
   showing all as a square Punctum.
3. The initial **authored-form validity matrix** is deliberately narrow:
   - A one-note `punctum` may have default square, explicit `virga`,
     or explicit `inclinatum`. Standalone inclinatum uses one stable
     unison/upright design; direction-specific alternates are deferred.
   - A strictly ascending three-note `scandicus` may have a `quilisma`
     on its **middle** note.
   - A strictly ascending two-note `podatus` may have a `quilisma`
     on its **first/lower** note (quilismatic pes), if the reference
     implementation confirms the required attached contour.
   - Other explicit overrides are **not authorable in Stage 8B**.
     Existing automatic virga and descending inclinata in Climacus remain
     derived with no newly persisted fields. This whitelist is a product
     boundary, not a claim that other historical figures cannot occur.
4. A form edit applies to the selected stable note as one atomic semantic
   command. Valid conversions do not alter existing mora/episema state.
   Invalid form/contour combinations reject without changing history or
   autosave. If deleting or changing the pitch contour would invalidate a
   surviving explicit form, do not silently drop it, move it to another
   note, or reinterpret it; choose an explicit documented policy
   (reject such edits or require a separately confirmed user action).
5. Continue using shared **measured derived geometry** for authored forms,
   selection/hit contours, ghost previews, note modifier placement,
   advance, wrapping, staff/lyric clearance, and all systems. Reuse
   verified existing primitives where possible. A note's optional authored
   form is **not** a stored SVG path or pixel coordinate. Keep approved
   default forms and existing contours exactly stable unless an owner-reviewed
   reference demonstrates a necessary correction.
6. Stage 8B adds **native version 3** for persisted explicit note forms.
   Preserve exact version-1 and finalized version-2 readers, including
   ADR 0018's incompatible experimental draft-v2 protection. New saves and
   exports write v3. The same browser-local cache key and byte conflict
   protections remain; recover v1/v2 without startup rewriting, upgrading
   only upon a successful explicit committed document save. Reject unknown
   future versions and invalid/unknown form values. Do not mutate saved
   note IDs, modifier scope or pitches in migration.
7. A visual note form is not a claim about measured duration or a playback
   instruction. Stage 8B introduces no audio, rhythm arithmetic, automatic
   inflection, or generalized symbolic glyph framework.

## Consequences

### Positive

- An author can create standalone virgae and inclined notes and attach
  quilismata to supported ascending passages without losing the distinction
  between a neume's melodic contour and its constituent note forms.
- The existing seven-kind edit model, stable IDs, note-level modifiers and
  shared rendering/selection pipeline remain authoritative.
- Native v1/v2 scores and browser autosaves continue to load; v3 captures
  explicitly authored forms.

### Negative

- Each explicit form requires a validity check against the *current*
  semantic neume kind and may constrain operations that normalize neumes.
- A connected quilisma-pes and quilismatic Scandicus need dedicated reference
  engraving and selection work; swapping a square notehead in place is
  unlikely to be sufficient.
- Initial support is narrower than all forms Gregorio can encode. Forced
  virga directions and inclined variants, multi-note inclined runs, group
  fusion and arbitrary form combinations will need separate decisions.
- Older deployed editor versions will not read v3 exports.

## Scope boundary and approval gate

This ADR does not add oriscus, stropha, salicus, pressus, liquescence,
accidentals, GABC interchange, arbitrary note groups, explicit neumatic
breaks, manual inclinatum orientation, or a full notation-font architecture.
If the investigation reveals that a proposed shape requires a different
semantic group (for example quilisma-pes vs attached Scandicus) or a model
incompatible with this contract, stop with reference examples and alternatives
before implementation. Owner choice to begin Stage 8B is **not** automatic
approval of this proposed representation.

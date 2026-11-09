# 17. Model rhythmic modifiers on individual chant notes

Date: 2026-11-08

## Status

Accepted (owner-approved 2026-11-09)

## Context

Stage 8A expands square-notation vocabulary without adding new neume kinds.
`ChantNote` currently contains only a stable ID and relative staff position.
The current glyph constructors derive shapes from neume kinds and pitches,
with measured ink bounds driving spacing, wrapping and hit/selection geometry.
Stage 7A introduced a strict version-1 native document envelope and a
single browser-local autosave; saved files and cached documents now form a
compatibility commitment under Accepted ADR 0016.

Gregorio's GABC documentation represents the punctum mora with a period after
an individual note (two periods for two dots), and horizontal episemata by
marking individual notes with an underscore. Horizontal episemata may be
positioned above or below and adjacent marks may be joined in engraving.
Their *meaning* therefore belongs to authored notes, while exact graphic
placement/bridging belongs to derived layout. The rendering of individual
signs in compound neumes can require collision avoidance.

Reference:
- https://gregorio-project.github.io/gabc/details.html (rhythmic signs)
- https://gregorio-project.github.io/tutorial/tutorial-gabc-01.html
- Existing `docs/engraving-metrics.md` and ADRs 0002, 0007, 0010, 0016.

## Decision

1. Represent Stage 8A rhythmic modifications on each stable-ID `ChantNote`,
   not on the whole neume, a detached glyph, a syllable, or a pixel coordinate.
   A note can independently have **no, one or two puncta morae** and a
   **horizontal episema on/off**. Ordinary notes omit optional modifier
   fields. Their values are semantic and do not change staff position or neume
   kind. Exact TypeScript property names are not the architectural decision;
   choose concise names and a strict runtime representation.
2. Modifier changes are ordinary immutable semantic commands, applying to
   one selected note and recorded atomically in document history. Preserve
   modifier data on the same surviving note IDs through pitch edits,
   neume normalization and whole-neume moves; deleting a note removes its
   signs along with it. Reject invalid/unchanged edit intents.
3. Engraving computes dot and episema **from the semantic note and existing
   notehead geometry**. Positioning and optional safe joining of neighboring
   episemata are derived, never saved. Integrate the marks into painted bounds,
   measured advance and reflow; preserve lyric anchors, selection/keyboard
   targeting and actual musical note pitches.
4. Stage 8A uses **automatic** above/below positioning of horizontal
   episemata and sensible dot displacement. It does not expose manual
   sign-orientation, short variants, bridge/break switches, or a promise that
   every Gregorio context-dependent case is reproduced. Adjacent marks may
   be bridged only when visually safe and unambiguous; avoid silently
   extending an episema across a division, clef, syllable boundary, or system
   break. The implementation plan specifies representative cases.
5. Extend the versioned native document reader to preserve the *exact*
   existing v1 contract and accept **v2** with the new optional note fields.
   New exports and autosaves use v2; a valid v1 score is upgraded in memory
   with unmodified notes and remains a valid import. Keep a safe recovery
   path for existing v1 browser-local caches; do not wipe or silently replace
   invalid saved bytes. Never reinterpret unknown schema versions as v2.
   Preserve stable IDs and semantic ordering. The storage key's literal
   version suffix does not, by itself, justify abandoning old saved scores.
6. A note modifier has no implied performance duration or playback
   conversion. Graphic notation is the current product.

## Consequences

### Positive

- Enables rhythmic signs on any of the seven existing neume kinds without
  multiplying neume types or entangling SVG with semantic state.
- Stable note identity carries attached signs through edits and undo/redo.
- Derived bounds keep wrapping and graphical previews accurate.
- Explicit v1-to-v2 decoding maintains the first native-format compatibility
  guarantee instead of silently breaking exported files and autosaves.

### Negative

- Compound glyphs require placement/collision rules beyond drawing a
  fixed dot or line beside an independent punctum.
- The first version of automatic episema positioning cannot reproduce every
  manuscript/edition's sign placement and combination.
- File format v2 adds a backward-compatibility obligation; older editor builds
  will not necessarily understand new v2 exports.
- A later editor may need to extend modifier options for explicitly authored
  bridging, orientations, vertical episemata and other signs.

## Scope boundary

This ADR covers *puncta morae* and horizontal episemata only. It does not
decide flats/naturals, vertical episemata/ictus, additional neume kinds,
liquescence, playback or GABC import/export. It does not amend the semantics
of Accepted ADR 0016; it applies its versioning requirement.

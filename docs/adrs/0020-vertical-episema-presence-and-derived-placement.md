# 20. Author vertical episema presence; derive its engraving position

Date: 2026-11-09

## Status

**Proposed — awaiting owner acceptance.** No accepted ADR is superseded.
Stage 8C extends [ADR 0018](0018-conventional-mora-patterns.md) and
[ADR 0016](0016-persist-versioned-semantic-chant-documents.md), without
changing their existing semantics or historical formats.

## Context

Solesmes editions of Gregorian chant print short vertical episemata, often
called ictus marks. These signs are authored notation: not every rhythmic
ictus is explicitly marked, and marking a note does not by itself mean
accenting or lengthening it. The project currently supports mora presence
and independent _horizontal_ episema `episema: true` on individual notes,
but not vertical episemata. The owner encountered this gap while
transcribing [Pater noster (A)](https://gregobase.selapa.net/chant.php?id=3326),
which is now bundled as a native v3 example.

[Gregorio's GABC reference](https://gregorio-project.github.io/gabc/details.html#rhythmic-signs)
assigns vertical episema to a note with a following apostrophe. Placement
is automatic by default; `'0` explicitly forces below and `'1` explicitly
forces above. The source notation and its auto-layout conventions are
research references, not a request to implement GABC interchange.

## Proposed decision

1. Model authored _presence_ as an optional `verticalEpisema?: true` on
   the existing stable-ID `ChantNote`, independently of optional
   `mora?: 1`, horizontal `episema?: true` and authored `form`.
   Omitting the field means no authored vertical sign. The seven existing
   semantic neume kinds, pitch contours and stable IDs remain unchanged.
2. Let authors toggle the sign on the **selected note** in the existing
   contextual modifier controls. It is not an automatically inferred
   rhythmic ictus map, neume category, extra note, pitch edit, playback
   duration, or independently selectable score event.
3. Determine above/below position **in derived engraving geometry**, based
   on note/head/connector/staff/rhythmic-sign context. Prefer the conventional
   under-note tick where safely legible, with above-note fallback when needed.
   Position is _not_ persisted, and it must be visible and represented in
   shared measured ink, note modifier bounds and responsive wrapping. Never
   silently drop an authored sign when placement is difficult.
4. Introduce **native v4** for writes. Exact v1, finalized v2 and v3 remain
   readable under their existing strict field whitelists, with no injected
   default presence field. Only v4 may accept explicit
   `verticalEpisema: true`; `false`, `null`, and unknown values reject.
   Keep withdrawn draft-v2 recovery, same browser autosave key,
   conflict detection and confirmation protections from ADR 0016.
5. This first iteration does **not** persist manual above/below overrides or
   freehand positioning. If needed for demonstrable traditional cases,
   collect comparison evidence and return to the owner for a separately
   approved extension rather than silently inventing syntax.

## Consequences

### Positive

- The source mark is authorable without guessing or imposing a particular
  interpretation of Gregorian rhythm.
- The existing note/modifier/history/layout boundaries remain authoritative.
- Old files, including the owner-transcribed bundled v3 Pater Noster, remain
  loadable and unchanged until the next committed save.

### Negative

- Default auto-placement cannot reproduce every deliberate above/below
  editorial choice from Gregorio/Solesmes; manual override is deferred.
- Native v4 exports are not guaranteed to load in older editor builds.
- The increased sign density may reveal layout and collision limits needing
  targeted shared-geometry tests.

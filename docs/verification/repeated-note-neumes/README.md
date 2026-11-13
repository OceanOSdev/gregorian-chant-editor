# Stage 9A reference gate: mora scope needs owner review

Status: investigation only; Stage 9A is not implemented. The committed
[plan](../../plans/stage-9a-repeated-note-neumes.md) remains active.

## Evidence inspected (2026-11-12)

- [Sister Demetria, Basic Gregorian Chant and Sight Reading (1960)](https://media.churchmusicassociation.org/books/basicgregorianchant_1960.pdf),
  lessons 29–30, printed pp. 69–71 (PDF zero-based pages 68–70).
  The searchable text explicitly distinguishes earlier special stropha shapes
  from the Vatican edition's replacement with puncta. It distinguishes
  bivirga/trivirga and identifies repeated-pitch groups. The surrounding
  examples are identified as Liber examples, Ex. 115–118. This supports the
  plan's square-head profile, without importing its performance instructions.
  It does not state an exhaustive allowed mora ownership matrix for either
  group. No visual measurement or matched engraving comparison was completed.
- [LilyPond 2.24, Gregorian square neume ligatures](https://lilypond.org/doc/v2.24/Documentation/notation/typesetting-gregorian-chant#gregorian-square-neume-ligatures):
  the table encodes Bistropha with two stropha heads and Tristropha with three.
  Stropha Aucta is separately listed. Its augmentum discussion describes the
  mechanism and a placement issue, rather than a conventional allowed-pattern
  matrix for square-head repeated groups. A stropha silhouette should therefore
  not be copied into this profile just because its group name matches.
- [Gregorio, advanced GABC notation](https://gregorio-project.github.io/gabc/details.html#rhythmic-signs):
  rhythmic-sign syntax permits a period per affected note and doubled periods
  after a neume. The repetitions section equates `hs/hs/hs` and `hsss`.
  This corroborates repeated-note semantics; parser expressibility does not
  establish conventional ownership or placement for every square-head unison
  combination. No Gregorio rendering experiment was performed.

## Unresolved decision

[Accepted ADR 0018](../../adrs/0018-conventional-mora-patterns.md) requires
sourced, unambiguous new mora patterns. The plan explicitly requires stopping
this part and proposing conservative scope for owner review if the references
do not settle pattern or placement. The inspected material does not establish
which of the four two-note subsets and eight three-note subsets should be
accepted, nor how same-height paired dots communicate individual ownership.
This is a limit of this investigation, not a claim that no such evidence exists.

The existing `domain/mora.ts` falls back to final/final-two for kinds other than
Punctum/Podatus/Clivis. Simply expanding the semantic union would silently give
new kinds an unsourced policy; Bistropha would even receive indexes intended
for a three-note tuple. That fallback must become explicit during implementation.

## Concrete options for owner review

1. **Recommended conservative initial scope:** approve none-only mora for both
   new kinds. Preserve independent horizontal and vertical episemata and the
   existing authored-form restrictions. Implement the rest of Stage 9A, with
   an explicit new-kind matrix that rejects every nonempty mora subset.
   This deliberately limits authoring; it is not a historical prohibition.
2. Keep the full milestone pending while locating a printed, identified example
   and a matched engraving comparison for each proposed nonempty pattern,
   including line/space cases and unambiguous affected note IDs. Approve that
   exact matrix before implementation. Do not infer it from GABC acceptance.

Neither option has been applied. No accepted ADR or native format was changed.
The Punctum split button and native v6 remain unimplemented; shipping tools
without their validated semantic/engraving path would leave a partial feature.

## Other contract checks

ADR 0021 already makes one sign per B register per neume effective for every
matching constituent, with the earliest matching note as canonical owner.
An above-note anchor must be in an earlier neume. Under that contract a written
unison group cannot introduce different effective alterations between its
constituents. No new accidental restriction or ADR amendment is proposed.
Deleting the owner must still remove its sign rather than transfer it.

Repeated-note normalization must retain surviving note objects, then validate
all surviving marks against the destination kind. Existing equal-outer-note
Torculus/Porrectus rejection must stay unchanged. These are implementation
requirements, not verified new behavior.

## Verification and acceptance still required

This change contains documentation only. Chromium/Firefox feature verification,
reference screenshots, pure regression additions and native v6 compatibility
checks have not been performed because there is no Stage 9A implementation.
After the owner resolves the mora gate, the implementation PR must record actual
runs separately from this investigation and complete the plan's acceptance:

- Primary Punctum always resets the tool; menu open/dismiss makes no score edit.
- Both variants support exact ghosts, repeated one-click placement and I/T recall.
- Native keyboard menu navigation, Escape, Tab and restored focus work in both browsers.
- Every constituent deletion, rejected pitch edit, group move and undo/redo preserves IDs.
- Shared bounds/wrapping, marks, B accidentals and lyrics work at desktop/320px.
- Exact v1–v5 readers reject new kinds; v6 round trips files/cache without startup rewrite.
- Owner checks foreground accessibility and matched line/space reference engraving.

Actual repository checks on 2026-11-12: `npm run lint`, `npm test` (82 files,
1,704 tests) and `npm run build` passed. Initial `npm run format:check` found a
pre-existing missing blank line in the committed plan; that formatting-only
change is included. The repeated full formatting check passed. These checks
validate the existing application, not Stage 9A behavior. Browser checks were
not run for this documentation-only gate report.

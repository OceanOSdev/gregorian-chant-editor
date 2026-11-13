# 22. Represent repeated-note neumes as explicit written-unison tuples

Date: 2026-11-12

## Status

Accepted design, including owner-approved conservative mora scope (2026-11-12).
Extends ADRs 0004, 0007, 0016, 0018, 0019 and 0020; none is superseded.
ADR 0021's accidental ownership and scope remain unchanged. The implementation
was owner-accepted on 2026-11-13 (PR #74). Acceptance rests on automated
Chromium/Firefox verification and a qualitative reference comparison.
Foreground owner interaction and screen-reader testing were not performed.

## Context

Stage 9A adds modern square-notation Bistropha (Distropha) and Tristropha.
[The reference investigation](../verification/repeated-note-neumes/README.md)
supports repeated square heads for this profile but did not establish an
unambiguous conventional mora-pattern matrix. The owner explicitly approved
none-only mora as an initial authoring restriction, without asserting that
historical repeated-note morae are prohibited.

## Decision

- Add `bistropha` and `tristropha` as explicit semantic kinds with ordered
  two/three-note tuples. Constituents have distinct stable IDs and equal
  staff positions. One group has one neume ID and one lyric-anchor boundary.
  No generic grouping flag, duration, automatic repeat merging or stropha form
  is introduced. Existing Torculus/Porrectus equal-outer-note deletion stays.
- Derive disconnected heads using original Punctum geometry with compact
  measured separation. Shared geometry owns heads, hit columns, signs, lyrics,
  advance, ghosts, wrapping and icons. Existing neume metrics stay unchanged.
  Historical special stropha silhouettes and bivirga/trivirga are out of scope.
- Reject individual pitch moves that break equality. Whole-neume moves transpose
  the complete tuple. Deleting one constituent normalizes Tristropha to
  Bistropha, or Bistropha to Punctum, retaining the neume ID, survivor order,
  surviving note objects/marks and structural anchors. Reject invalid surviving
  modifiers rather than discard, transfer or reinterpret them.
- Both new kinds accept **only the empty mora subset**. Mora validation is
  explicitly exhaustive across supported kinds; all existing patterns remain.
  Commands and native decoding reject every nonempty subset. The contextual
  editor states that mora authoring is unavailable. Independent horizontal and
  vertical episemata remain supported on every constituent. Authored
  Virga/Inclinatum/Quilisma overrides are not supported on these groups.
  Expanded mora support requires a future reference investigation establishing
  specific conventional patterns and unambiguous ownership/engraving, then
  owner review before changing this restriction.
- Preserve ADR 0021: all matching B constituents share one sign, canonically
  owned by the earliest B. No within-neume alteration split is introduced.
  Owner deletion removes its sign; surviving owners keep valid signs.
- Write strict native v6. Exact v1–v5 readers retain their field/kind whitelists
  and reject both new kinds. Retain the existing cache key, no hydration write,
  withdrawn draft-v2 recovery and original-source/cross-tab protections.
- Replace only the Punctum palette slot with a split action: primary always
  chooses ordinary Punctum; the separate menu selects the exact family variant
  without inserting music. One-click repeated placement, I recall, T family
  focus, one toolbar Tab entry and accessible menu dismissal remain required.

## Consequences

### Positive

- Named groups retain stable musical identity independently of glyph appearance.
- The existing command, measured geometry and versioned persistence boundaries
  remain authoritative.
- Conservative mora scope avoids inventing ambiguous ownership notation.

### Negative

- Some historical marked groups cannot yet be authored; none-only is a product
  scope restriction, not a historical prohibition.
- Older editor builds cannot read v6 files, including v6 files without new kinds.
- Final typography, spoken output and foreground input still need owner review.

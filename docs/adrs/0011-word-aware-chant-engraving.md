# 11. Word-aware compact spacing and derived continuation marks

Date: 2026-11-01

## Status

Proposed. Requires owner acceptance after the Stage 4C visual review.
[ADR 0010](0010-derive-wrapping-from-music-and-lyric-geometry.md)
remains Accepted during development.

This proposal **qualifies only ADR 0010's fixed musical minimum between
eligible consecutive same-word syllables**. All other ADR 0010 contracts,
including derived whole-neume wrapping, measured lyric clearance, exact fit,
oversized progression and scrollable exceptional overhang, remain in force.
If accepted, record this contextual qualification reciprocally in ADR
0010 and the owning guides; do not indiscriminately supersede the entire
combined-geometry decision.

## Context

Stage 4B ensured that separate lyric syllables did not overlap and that
musical layout/wrapping responded to their measured extents. Its 33-unit
ordinary inter-neume ink gap is conserved even when two short consecutive
syllables belong to one word. The results can look like `le lu ia`
when the user expects `leluia`. The semantic model already knows
`boundaryBefore: 'word' | 'continuation'`, and each syllable is anchored
to a neume ID; no other word entities are necessary.

In addition, music can force syllables of one word far apart, and the
editor currently has no conditional hyphens or outgoing continuation
marks when a word crosses a system break.

## Proposed decision

- **Conditional compaction:** For consecutive neumes starting consecutive
  syllables of the _same semantic word_ (no intervening unanchored
  melismatic neumes), allow a contextual minimum horizontal separation
  smaller than the ordinary 33-unit ink gap. Derive that minimum from
  valid musical ink bounds, vowel-anchored lyric text extents, and a
  safe nonambiguous hit-testing policy. Keep neume internal geometry
  and lyric-to-musical anchors unchanged. Never compress unrelated
  neumes, melismas, word boundaries or lyricless scores. Fallback
  deterministically to the music-only rule without measurements.
- **Honest joining:** Aim for adjoining word text without overlap,
  using the same font and grapheme measurements as the rendered SVG.
  When safe neume separation prevents joining, do not force music to
  intersect or displace text from its musical anchor. Preserve the
  resulting gap and indicate continuation with a hyphen when warranted.
- **Conditional marks:** Generate punctuation only for two consecutive
  semantic syllables in the same word. Within one system, use actual
  measured distance and a documented font-relative joining threshold:
  contiguous text has no hyphen; visibly separated text receives a
  measured, pointer-inert hyphen. A real new word always has a
  space and no continuation hyphen. Neume count alone never determines
  hyphenation.
- **Across systems:** When the next syllable of the same word belongs
  to another system, render an outgoing hyphen on the preceding
  system, with measured room reserved in the wrapping process. No
  redundant incoming mark. A melisma spanning systems **without a
  new syllable** is not automatically split into syllables.
- **One authoritative layout:** Derived spacing, word relationships,
  rendered punctuation and system membership come from the same
  layout used for drawing and interaction. Measure hyphen glyphs in
  the existing font; reserve room as needed without post-render
  shifts or cyclic layout. Render decorations as aria-hidden and
  pointer-inert; keep each lyric separately focusable and editable.
  No persisted punctuation or additional semantic ownership.
- **Accessibility and reflow:** Keep stable neume/note/syllable IDs,
  hit target ownership, tab and semantic selection independence,
  drafts/history, pointer/ghost interaction, font loading
  fallback, and the existing exceptional scrollable overflow
  behavior. Visual selection cues remain behind, not between,
  glyphs and must not block an adjacent syllable.

The owner has authorized _implementation and visual exploration of this
proposal on a separate Stage 4C branch_, **not its acceptance**. A change
to the universal gap, loss of hit-target distinction or material
different layout policy must be escalated before implementation.

## Consequences

### Positive

- Words can be read as words when the music permits.
- Hyphens indicate genuine musical separation and across-system
  continuation without altering the semantic chant document.
- Font/lyric measurements remain authoritative for both visible
  glyphs and layout.

### Negative

- Contextual musical advances and hyphen reservation add complexity
  and can alter system partitions compared with Stage 4B.
- Not every same-word sequence can be visually joined without
  compromising musical geometry and controls; the UI must show
  continuation rather than fake an impossible join.
- An interaction-safe minimum between neumes needs dedicated
  tests for every supported shape, at narrow viewport widths,
  and after font changes.
- Hyphen reservation interacts with wrapping. It requires a
  demonstrably bounded, stable placement algorithm.

## Alternatives considered

Keep the universal minimum and add hyphens everywhere: safe but
fails the owner's `leluia` continuity goal. Merge syllables into
one text element: obscures separate editor targets and may sever
vowel-to-neume alignment. Shift displayed text independently of
its musical anchor: contradicts the accepted lyric alignment
contract. Compress all neumes globally: alters music-only scores
and melismas and risks overlapping interactive contours. Store
hyphens or manual pixel offsets in the semantic document:
mistakes a layout choice for a chant fact.

## Acceptance gate

After Codex submits Stage 4C with real browser screenshots and
interaction regression evidence, the owner evaluates the `Al ...
leluia ah` and `auditione` appearances, conditional hyphens and
system continuations. Only upon explicit acceptance change this ADR
to Accepted and add reciprocal qualification notes to ADR 0010
and the owning architecture guides. Keep this proposal's status
Proposed and ADR 0010 Accepted until then.

## Stage 4C implementation under review

The isolated branch implements this proposal; this is not acceptance. Exact
spacing, pointer ownership, threshold, bounded reservation and overflow policies
are recorded in the [owning layout guide](../layout-and-rendering.md#stage-4c-branch-experiment-word-composition).
The [verification record](../verification/word-composition/README.md) records
actual checks and visual evidence. Owner review must decide whether the compact
music and remaining font-dependent gaps are acceptable before merging.

The [PR #45 corpus review](../verification/word-composition/corpus-review.md)
expands evidence to eight lyric entries and five musical arrangements. It refines
the font-relative join threshold to remain tighter than real word spacing and
uses matched geometric text rendering for responsive ink measurement. This is
still implementation under review; the proposal is not accepted.

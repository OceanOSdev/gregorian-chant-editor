# 8. Anchor lyric syllables to independent neumes

Date: 2026-10-29

## Status

Accepted. Partially supersedes the relationship direction in
[ADR 0003](0003-use-stable-semantic-identities.md); its stable-identity decision remains accepted.

## Context

Requiring every neume to reference a syllable constrained music insertion and
placement to lyric groups. Musical order should remain independent of lyrics
and engraving. The approved lyric redesign begins with the semantic boundary;
continuous entry and correction UI are separate stages.

## Decision

Neumes are independent musical entities ordered by the semantic neume array.
Each syllable references its beginning through `startsAtNeumeId`. Anchors are
unique, existing neume IDs and follow lyric order. Membership extends until the
next anchor or document end and is derived, never stored on neumes.

Syllables retain IDs and carry `boundaryBefore: 'word' | 'continuation'`.
The first starts a word. Text is nonblank and excludes entry delimiters.
Visible hyphens belong to engraving, not stored punctuation.

Music insertion never changes anchors. Removing an anchored neume also removes
its syllable atomically; normalization preserves anchors through stable neume
identity. Syllable deletion preserves crossed word boundaries. Reassignment may
not cross neighbors or occupy another anchor. These rules are detailed in the
[domain guide](../domain-model.md).

Anchors are required for this milestone. Future unanchored lyrics can extend
placement without changing syllable identity or lyric order. Persist no systems,
span endpoints, or inferred ownership.

## Consequences

### Positive

- Music can be created without lyrics and inserted at any whole-neume boundary.
- Lyrics survive musical edits through stable IDs.
- Group clamping and redundant association maintenance disappear.
- Existing semantic-only history remains sufficient.

### Negative

- Removing an anchor removes its lyric, recoverable through undo.
- The final syllable extends to document end; explicit lyricless tails require an extension.
- Unanchored legacy fixtures must be deliberately rewritten; there is no persisted format to migrate.

## Alternatives considered

Nullable neume-to-syllable references retain redundant span membership. A separate
anchor table adds coordination without value for one lyric line. Optional anchors
would introduce an unimplemented workflow prematurely. Word entities add identities
unnecessary for whitespace-delimited Latin, English and Greek entry.

# 13. Divisions interrupt contextual word compaction

Date: 2026-11-02

## Status

Accepted (2026-11-02), by explicit owner approval during Stage 5B review.
ADR 0011 remains Accepted and unchanged. This decision narrowly qualifies
its compaction eligibility; it does not supersede ADR 0010 or ADR 0011.

**Accepted Stage 9C qualification (2026-11-14):**
[ADR 0026](0026-derived-intra-syllable-spacing.md) adds close but independent
spacing between eligible neumes in the same non-null ADR 0008 syllable span.
The initial complete-ink minimum is 6 units, with division, explicit-clef and
written-accidental-location barriers. Existing distinct-syllable compaction,
hyphens, alignment and whole-neume wrapping remain unchanged. This ADR remains
Accepted and is not superseded. Design approval is separate from visual and
implementation acceptance; 9C-1 alone is authorized.

## Context

The Stage 5B plan proposed that a visible division block contextual same-word
neume compaction. ADR 0011 currently makes consecutive neumes starting
consecutive same-word syllables eligible, excluding intervening melismatic
neumes. Under ADR 0012, a division does not interrupt neume-array adjacency.
Before Stage 5B, layout checked successive lyric anchors without inspecting divisions.
Thus excluding these pairs adds a condition to the accepted eligibility rule.
ADR 0012 explicitly leaves lyric compaction and hyphenation effects for graphical
design review; its acceptance does not amend ADR 0011.

## Decision

Treat neumes as eligible for contextual compaction only when no
division intervenes in `deriveScoreOrder`. Across a division, use ordinary
musical separation plus the measured space required by the division and lyrics.
Keep division-free layout unchanged.

Preserve lyric text, `boundaryBefore`, syllable anchors and semantic identities.
A division does not create a word boundary. Keep ADR 0011's measured conditional
hyphen threshold and outgoing continuation rule. Reserve space within the one
authoritative placement/wrapping computation; a same-system mark must occupy
clear lyric space, and an outgoing mark must remain visible when the preceding
phrase includes a division. No automatic incoming mark or mandatory hyphen
solely because a division exists is introduced.

## Consequences

### Positive

- Visible punctuation cannot be bypassed by same-word compaction.
- Semantic lyrics and division-free word composition retain their contracts.
- Rendering, wrapping and insertion targets continue to share derived geometry.

### Negative

- Adds an eligibility exception to the accepted Stage 4C policy.
- Division width and continuation reservation can change system partitions.
- Requires measured same-system and cross-system collision regressions and
  graphical owner review; ADR acceptance is separate from graphical acceptance.

## Owner clarifications

Musical and linguistic boundaries remain independent. Divisions may occur
between neumes belonging to one syllable, including within melismas. Inserting,
deleting or changing a division never changes syllable text, word boundaries or
lyric anchors. No kind enforces completed words or phrases as a semantic
invariant. Stage 5B introduces no automatic word splitting, validation errors or
editorial warnings for unusual division placement.

Conditional hyphenation remains based on measured lyric spacing and semantic
syllable relationships. A division alone never forces a hyphen.

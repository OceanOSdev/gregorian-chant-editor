# 13. Divisions interrupt contextual word compaction

Date: 2026-11-02

## Status

Proposed. Requires owner review before the affected Stage 5B implementation.
ADR 0011 remains Accepted and unchanged. This proposal would narrowly qualify
its compaction eligibility; it does not supersede ADR 0010 or ADR 0011.

## Context

The Stage 5B plan proposes that a visible division block contextual same-word
neume compaction. ADR 0011 currently makes consecutive neumes starting
consecutive same-word syllables eligible, excluding intervening melismatic
neumes. Under ADR 0012, a division does not interrupt neume-array adjacency.
The current layout checks successive lyric anchors without inspecting divisions.
Thus excluding these pairs adds a condition to the accepted eligibility rule.
ADR 0012 explicitly leaves lyric compaction and hyphenation effects for graphical
design review; its acceptance does not amend ADR 0011.

## Decision

Propose treating neumes as eligible for contextual compaction only when no
division intervenes in `deriveScoreOrder`. Across a division, use ordinary
musical separation plus the measured space required by the division and lyrics.
Keep division-free layout unchanged.

Preserve lyric text, `boundaryBefore`, syllable anchors and semantic identities.
A division does not create a word boundary. Keep ADR 0011's measured conditional
hyphen threshold and outgoing continuation rule. Reserve space within the one
authoritative placement/wrapping computation; a same-system mark must occupy
clear lyric space, and an outgoing mark must remain visible when the preceding
phrase includes a division. No automatic incoming mark or mandatory hyphen
solely because a division exists is proposed.

## Consequences

### Positive

- Visible punctuation cannot be bypassed by same-word compaction.
- Semantic lyrics and division-free word composition retain their contracts.
- Rendering, wrapping and insertion targets continue to share derived geometry.

### Negative

- Adds an eligibility exception to the accepted Stage 4C policy.
- Division width and continuation reservation can change system partitions.
- Requires measured same-system and cross-system collision regressions and
  graphical owner review; this proposal is not implementation evidence.

## Alternatives for owner review

1. Accept this narrow qualification and update the Stage 5B handoff to authorize
   implementation before continuing.
2. Retain ADR 0011 eligibility across divisions, while requiring division ink,
   interaction targets and lyric clearance to constrain the resulting placement.
   Amend the handoff's proposed blocking policy accordingly before implementation.

The first option matches the Stage 5B plan's proposed display policy. Neither
option changes semantic word boundaries. No choice has been implemented.

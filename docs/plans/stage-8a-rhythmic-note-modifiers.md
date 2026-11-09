# Plan: Stage 8A — Conventional mora and horizontal episema

Branch: `feat/stage-8a-note-modifiers`
Target: `master`

Status: Updated for the owner-approved conventional model in PR #64.
Owner visual acceptance and final plan closeout remain pending.

## Approved design

[ADR 0018](../adrs/0018-conventional-mora-patterns.md) supersedes historical
[ADR 0017](../adrs/0017-model-rhythmic-modifiers-on-notes.md).
The [approved model proposal](stage-8a-conventional-rhythm-model.md) specifies
mora presence (`1`), supported patterns, contextual scope controls, atomic pair
edits and independent selected-note episema. Arbitrary note-level counts and
editorial ownership glyphs are excluded. Stable note IDs, approved contours,
pitch editing and lyric anchors remain unchanged. Shared measured geometry
owns all signs and spacing.

## Persistence and recovery

Finalize the unmerged native v2 with these restrictions; no v3. Preserve exact
v1 and compatible draft-v2 loading. Fully validate incompatible draft syntax,
report resolution required and offer original-source recovery without assigning
new intent. Imports leave active state intact; cached bytes remain under the
same key with autosave blocked until explicit recovery/replacement. Original
source downloads and current-score Export are separate actions. Preserve
conflict and pending-workflow guards.

## Implementation and verification

Follow repository guides and the approved proposal's acceptance criteria.
Update commands, pattern validation, codec, recovery controls, accessible
labels and scope UI. Verify every allowed pattern across all seven kinds,
line/space positions, narrow/wide intervals and independent episemata. Include
movement, deletion, exact undo/redo, no-op rejection and draft recovery tests.
Run format check, lint, full tests and production build; check Chromium and
Firefox at desktop/320px, stable selection layout, native keyboard behavior,
recovery downloads and local persistence. Retain representative rendered
single/pair comparisons against actual Gregorio output, especially Podatus,
Clivis, Torculus and Porrectus.

## Scope and delivery

No playback, extra signs/neumes, manual positioning, grouping tools, GABC
adapter or broader engraving rewrite. Stop for material architectural conflicts.
Commit/push to PR #64 targeting master; do not merge.
See [current verification](../verification/note-modifiers/conventional/README.md)
for actual checks and remaining owner acceptance.

# Plan: Repair crowded five-note Scandicus episema placement

Branch: `fix/five-note-scandicus-episema-placement`
Target: `master`
Base: `15ca4ca` (Stage 9B-3, PR #80, merged).

Status: implemented; verification and PR evidence recorded in the extended
Scandicus verification record. Retained for owner review before Stage 9C. Read AGENTS.md,
the [AI workflow](../ai-workflow.md), relevant layout and testing guides,
and ADRs 0020, 0024 and 0025.

## Problem and goal

The [Stage 9B-3 verification record](../verification/compound-directional-neumes/README.md#pre-existing-sign-exceptions-owner-review-item-2)
identifies 72 sampled pre-existing exceptions in five-note Scandicus
staircases. These are a lower bound, not an exhaustive census. Valid
authored documents can throw "No local vertical episema placement"
when the first Pes column is crowded.

Known pitch sequences include `[-2,-1,0,2,3]` and `[1,3,4,6,9]`.
All five notes have horizontal episemata; a vertical episema on zero-based
index 1, or on every note, triggers the defect, with or without a final
mora. The following Punctum (index 2) is one step above note 1.
Reproduce representative cases on the merged base before editing.

## Agreed direction and scope

Extend ADR 0025's existing left-of-ink vertical-episema fallback to
five-note Scandicus only. This is the proposed narrow repair, not a new
historical engraving profile. The stage 9B-2 staircase (Pes + Punctum +
Pes), semantic note ownership, ordinary candidate order, dimensions,
staff/head/shaft/sign clearance and same-column ownership safeguards
must remain unchanged. Only if the ordinary candidate search fails may
the existing bounded local fallback search relax the left-edge restriction.

Use the existing shared `buildNeumeGeometry` normalization from
`05e655d` so the requested group origin remains its leftmost ink.
Do not add per-consumer spacing corrections, persisted fields, manual
orientation, new rhythmic semantics, or a new native version.
Do not change the ordinary geometry of any other kind or count, the
placement of signs already successfully rendered, or the accepted
compound fallback. Existing successful output must remain identical.

Update the owning guide and record the precise extension to ADR 0025
(with cross-reference to ADRs 0020/0024 as appropriate); no supersession
or new architectural decision is needed for the agreed narrow repair.
If this fallback is insufficient, creates ambiguous ownership or needs
a materially different engraving/placement policy, stop the affected
work and report concrete examples and options for owner review rather
than broadening the rule silently.

## Focused tests and verification

- Reproduce the known throwing inputs with actual supported marks;
  add regression tests that fail on the base and pass after repair.
  Include both example contours, single/all vertical marks and
  none/final mora. Verify all authored signs are emitted once and assigned
  to their stable note, local collision/ownership safeguards hold, and
  the leftmost measured ink and advance are correct.
- Use a focused five-note Scandicus probe, not a new all-kind compatibility
  matrix. Recover the 18 known contours from the prior bounded selection
  or regenerate that selection for this kind only. Compare successful
  outputs before/after and report exact counts and errors separately.
  Exercise all horizontal/vertical masks and both mora scopes on the
  known failing contours (and a small representative set of other
  intervals/line-space placements); report the tested bounds. If further
  failures appear, document them and seek a decision if the narrow
  fallback cannot address them. No multimillion-case stress run required.
- Add score-level regression for a fallback-producing five-note
  Scandicus following another neume: normal and compact same-word ink
  gaps, lyric-driven reflow, first/boundary placement and prefix accidental
  clearance as applicable. Reuse the Stage 9B-3 left-overhang tests and
  invariants; test actual ink, not just head positions.
- Add one focused real-editor scenario to the existing
  `extended-scandicus-climacus` browser driver (both transports): a
  valid crowded staircase survives authoring the formerly failing sign
  through the actual modifier controls, retains its note IDs and marks,
  and renders without an error. Check visible tick, undo/redo and reload
  or import of the marked semantic document as appropriate. Preserve
  existing driver coverage; use native interactions and dismiss nearby
  properties where required. No new standalone driver/manifest entry.
- Run focused tests during implementation, then the standard repository
  gate once and the affected browser driver in both browsers via
  `npm run verify:browser -- --driver extended-scandicus-climacus --browser both -j 2`.
  Include another targeted driver only if the actual changes warrant it.
  No full matrix, full legacy geometry comparison or performance benchmark
  requested for this narrow fix; existing Stage 9B-3 evidence is retained.
  Record revision, dirty state, versions, test results, run directory and
  known limitations. Do not claim exhaustive safety outside tested ranges.

## Delivery

Update the roadmap, extended Scandicus verification record and applicable
owning guide/ADR; retain the historical 72-exception evidence and add
resolution evidence rather than overwriting old results. Preserve the
unresolved Firefox mid-score-clefs intermittency and other known limits.
Keep Stage 9C next. No unrelated fixes (including ledger lines or extreme
pitch viewBox policy), refactors, dependencies, CI or runner changes.
Commit, push and open a PR against master, retaining this plan through
review. Do not merge. Return a concise summary with the actual defect,
fix, tested scope, outcomes and any remaining exceptions.

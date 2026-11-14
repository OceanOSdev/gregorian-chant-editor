# Plan: Maintenance A — Lyric verification repair

Branch: `maintenance/lyric-verification-repair`
Target: `master`

Status: active handoff. Stage 9B-2 (PR #76) merged at `c7fb73a`.

## Goal

Restore a trustworthy current browser regression baseline for lyric entry,
anchor deletion and anchor correction before introducing a parallel runner
(Maintenance B) and changing intra-syllable grouping (Stage 9C).

Read AGENTS.md, docs/testing.md, the relevant lyric interaction/history
contracts, and the three lyric verification READMEs. This is a focused test
maintenance task, not a new editor feature or a fresh historical review.

## Work

### 1. Repair the current lyric-move driver

In `docs/verification/lyric-move/browser-check.mjs`, the Stage 9A record
reports a pre-existing failure at line 189 (expected rejection announcement).
The current `status()` helper queries the first `[role=status]` in the
document; document management now also has status regions. The editor's
actual announcements are in `.editor-announcement`.

Reproduce on the unmodified baseline in Chromium, confirm the failure and
its cause, and use a specific editor-announcement selector if confirmed.
Do not weaken assertions, replace native input with synthetic events to
make a check pass, or assume this is the only stale expectation. Run the
whole driver and repair other obsolete test selectors/fixtures narrowly
against the accepted current behavior. If a real application regression
emerges, document the evidence and stop the affected work for owner review
rather than silently changing application behavior.

Preserve existing coverage: occupied/crossing/current-anchor rejection,
pointer and keyboard correction, focus vs selection, dirty lyric recovery,
undo/redo, sibling anchors and unchanged music, multi-system and narrow
viewport behavior. Inspect actual failure logs, not just exit codes.

### 2. Port the historical Stage 1 anchor-deletion scenario

The original `docs/verification/lyric-anchors/browser-check.mjs` is an
explicitly historical driver. The old Add/#new-syllable UI was superseded
by continuous Lyrics mode. Do not revive that interface or treat this
historical script as a current failing check.

Add a focused scenario to
`docs/verification/continuous-lyrics/browser-check.mjs` using the real
current editor and existing fixture:

- Start with a fresh lyricless score; insert a Punctum through current
  contextual UI, enter an anchored syllable through current Lyrics mode,
  and insert another note without creating or moving lyrics. Existing
  equivalent coverage may be reused, but demonstrate current anchored
  creation and stable identity in the new deletion scenario.
- Select/focus the anchored musical note (not the lyric input or engraved
  lyric), delete it with actual editor input, and verify that both the
  neume and its attached syllable disappear together. Another neume and
  its existing ID/pitch remain unchanged. Use stable IDs and semantic
  state or precise DOM anchor assertions, not only aggregate counts.
- Undo once restores the same neume/note IDs, lyric text and anchor
  together; redo once removes both again. Verify history boundaries
  and the independent surviving music. Use the existing accepted
  commands and history contracts; do not introduce new deletion policy.
- Preserve all current Stage 2 scenarios, including occupied protection
  and independent focus/selection. Existing pure lyric-anchor tests
  remain in place. Keep the old Stage 1 driver as historical evidence
  and link to the replacement scenario.

### 3. Update the verification inventory

The top-level docs/verification/README.md includes an explicitly historical
post-PR-38 audit. Preserve dated evidence while adding a short current
inventory of standalone browser drivers. Inspect actual files and their
owning READMEs; do not infer current support from filenames alone.

For each driver identify path, current/historical/special-purpose status,
browser support (CDP-only vs BiDi where implemented), server type
(dev fixture vs production preview or special server), endpoint/port
configuration, and latest known verification or limitations. Distinguish
current candidates from ones actually re-run in this maintenance task.
Mark obsolete Stage 1, old syllables/placement scripts and other confirmed
historical checks appropriately; preserve reference assets and fixtures.
Do not fix unrelated drivers in this PR or claim every listed driver passes.
Keep the unresolved Firefox mid-score-clefs intermittent failure visible.
Update the lyric READMEs, relevant testing/roadmap entries and historical
cross-links as needed; retain older dated results as historical evidence.
The inventory is a human-readable input to Maintenance B, not yet a runner
manifest or a new test framework.

## Verification and efficiency

- Run the original lyric-move failure reproduction, then the repaired
  lyric-move and extended continuous-lyrics drivers in headless Chromium
  against the real development fixture. Use existing supported endpoints,
  fresh profiles or reset state and sequential runs. Confirm both complete
  successfully, including their narrow viewport scenarios.
- These drivers are currently Chromium CDP scripts. No Firefox port is
  required here; retain documented foreground Firefox/focus and actual
  screen-reader limitations. Do not claim either was verified.
- Run format:check, lint, npm test and build once after substantive changes
  are complete, and git diff --check; check changed documentation links.
  During iteration use targeted checks, not repeated whole-suite runs.
  No full unrelated browser regression sweep is requested for a test/docs
  only change. Record exact actual commands/results and any failure or
  not-run check, with reason. If only docs change during closeout, run
  formatting/link checks rather than repeating the entire suite.
- Avoid unnecessary agent orchestration: use scripts to capture logs,
  output concise summaries, inspect failure excerpts only, and clean up
  only processes created for this task. Keep diagnostic screenshots and
  logs outside tracked specimens.

## Exclusions and delivery

No application source, semantic/ADR changes, schema change, engraving,
ledger lines, new neumes, grouping behavior, parallel runner, global
driver refactor, dependency or CI changes. Maintenance B will handle
browser automation, worker isolation, endpoint configuration, timing
improvements and verification tiers separately.

Commit and push on this branch; open a PR against master. Report the
confirmed root cause, scenario coverage, inventory and checks actually
run, any residual gaps, and review items. Do not merge. Retain this plan
through review and closeout.

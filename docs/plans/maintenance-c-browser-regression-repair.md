# Plan: Maintenance C — Browser regression repair

Branch: `maintenance/browser-regression-repair`
Target: `master`

Status: implemented, awaiting review and owner comprehensive matrix. Retained
through review. See [completion evidence](../verification/runner/README.md#maintenance-c-targeted-completion-2026-11-14-utc).
Maintenance B (PR #78) merged at `1327c2c`.
This is the last planned maintenance milestone before Stage 9B-3.
Use the new runner and the verification tiers in
[ai-workflow.md](../ai-workflow.md) to keep this task economical.

## Goal and baseline

Restore the four failing routine browser jobs without weakening their
accepted interaction or engraving contracts. Maintenance B's
[runner record](../verification/runner/README.md) and
[full-matrix evidence](https://github.com/OceanOSdev/gregorian-chant-editor/pull/78#issuecomment-6872022284)
report 30 passing, four failing, six unsupported browser pairs.
All four failures also reproduce with the unchanged standalone drivers.
This proves they predate the runner, not that the app is correct or that
the drivers are stale.

Read AGENTS.md, the [testing guide](../testing.md),
[layout guide](../layout-and-rendering.md), applicable accepted ADRs,
and the owning verification records before changing behavior.

## 1. Reproduce and classify

Run the four affected jobs together on the unmodified baseline:

```bash
npm run verify:browser -- --driver word-composition,lyric-spacing,lyric-spacing-selection-cue --browser both -j 2
```

There are four runnable pairs and two unsupported pairs. Keep the actual
summary and failing log excerpts. Inspect current rendered DOM, layout and
real pointer behavior at the failing step. Determine independently for
each failure whether the expectation/fixture is obsolete, an actual
application regression exists, or the cause remains uncertain. Use the
accepted current contracts and relevant history, not merely the fact
that a change makes a check pass. Do not assume all failures share a
cause. Avoid repeating the baseline comparison already done in PR #78
unless new evidence makes it necessary.

### Word composition (both browsers)

Driver: `docs/verification/word-composition/browser-check.mjs`.
Recorded failure at line 327: `podatus note0-1 at 1440`.

The native pointer scenario computes a constituent hit point from the
composition layout, transforms it into client coordinates, clicks it and
checks the selected note ID. Inspect whether the computed point matches
the displayed hit geometry, clipping, coordinate transforms and actual
pointer ownership. Compare the current editor and fixture against the
accepted compact-join/selection rules and the
[Stage 4C record](../verification/word-composition/README.md).

If the driver is stale, correct its derivation/fixture narrowly, still
asserting that actual native clicks select the intended constituent.
If hit geometry or event handling violates the accepted behavior, fix
the underlying application bug and add a focused regression test where
appropriate. Preserve compact-pair selection across the existing seven
kind cases, desktop and 320px, Shift-selection of whole neumes, and
all existing word-composition/continuation/clearance checks. Do not
replace native pointer input with synthetic selection or choose an
unrepresentative point merely to avoid an actual hit-region defect.
No expansion to new neume coverage is required for this task.

### Lyric selection decoration (Chromium and Firefox)

Drivers: `docs/verification/lyric-spacing/browser-check.mjs`
(recorded line 220, getComputedStyle TypeError) and
`docs/verification/lyric-spacing/selection-cue-firefox.mjs`
(recorded line 127).

Inspect the actual selected lyric, its current DOM hierarchy, cue
presence, geometry and computed styles after native pointer selection.
Identify the concrete failing expression/assertion in each browser and
whether the failures have a common cause. The
[Stage 4B selected-syllable cue record](../verification/lyric-spacing/README.md#selected-syllable-cue-regression)
and accepted current layout/interaction rules own the intent:
a selected lyric's background is behind the text, pointer-inert and
does not introduce an outward outline/stroke or overlap neighboring
glyphs; selection does not move music or lyrics; selection and focus
remain distinct, and the cue clears when selection moves to music.
Preserve the desktop, narrow and 150% CSS zoom cases, actual native
pointer input, SVG clearance and position-stability assertions.
If markup changed intentionally, adapt the tests to current markup
without weakening the visual/interaction contract. If the current
editor violates it, repair the actual defect. Preserve the remaining
full lyric-spacing checks (text/history, wrapping, font changes,
local overflow, later-system insertion and focus/reveal).

## 2. Scope and decisions

- Make the smallest justified fixes. Test-only corrections are appropriate
  for demonstrably stale drivers; application fixes are permitted only to
  restore accepted behavior. Add focused pure/component regressions for
  application defects when they can express the invariant, in addition to
  the repaired native browser check.
- If the evidence reveals a genuine unresolved contract/design conflict
  (e.g. a new spacing or selection policy), stop that affected portion
  and report the concrete evidence and options for owner decision.
  Do not silently amend accepted ADRs or redesign notation.
- No new neumes, grouping, ledger lines, unrelated refactors, runner
  redesign, dependencies, CI changes, historical-driver resurrection,
  or broad timing overhaul. Keep all four jobs in the full manifest;
  do not quarantine, skip, relax assertions, switch to synthetic input,
  or retry a failure into a pass.
- Keep the Firefox mid-score-clefs 150% zoom intermittent issue recorded
  separately. Do not expand this task to investigate it unless it
  demonstrably shares the repaired cause; report any recurrence without
  waiving it.

## 3. Verification and delivery

During implementation run the relevant focused tests and affected driver
selection, inspecting failure logs only as needed. Once substantive
work is complete, run the four affected browser pairs in full through
the runner, with no diagnostic/baseline modes, and the standard
repository gate (format:check, lint, npm test, npm run build,
git diff --check) once. Include any additional affected browser
drivers if application changes warrant them; if only driver/docs
changes are needed, do not run unrelated checks during iteration.
Run runner tests only if runner code changes are separately approved.

Record actual outcomes, browser versions, run directory, revision/dirty
state, and concrete cause and repair for each failure. Update the owning
verification READMEs, current inventory and roadmap with dated evidence,
preserving historical results, unresolved limitations and the difference
between headless and foreground/assistive-technology verification.
Do not regenerate historical tracked screenshots. Check changed doc
links. Keep reports concise.

Open a PR against master and retain this plan through review. Do not merge.
The owner can run one comprehensive matrix on the final substantive
revision, rather than spending agent usage on orchestration:

```bash
npm run verify:browser -- --preset full --browser both -j 4
```

Record all outcomes, including unsupported pairs and any failures.
Full-matrix evidence is desired before concluding Maintenance C and
resuming Stage 9B-3; do not claim a clean baseline until observed.
If the owner runs it, mark it pending in the PR until results are supplied.
Do not automatically rerun a full matrix for a documentation-only
closeout. No new performance benchmark is requested.

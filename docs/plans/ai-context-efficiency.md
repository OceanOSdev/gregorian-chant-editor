# Plan: AI context efficiency and documentation organization

Branch: `chore/ai-context-efficiency`
Target: `master`
Status: approved direction; implementation pending.

## Problem and goal

The Stage 9C Codex session accumulated approximately 328K tokens of context
(475K window), spanning research, implementation, and integrated verification.
The exported session shows repeated full-document reads, large combined
`cat` outputs, and frequent polling during browser verification. These are
avoidable sources of context growth and agent overhead; the export does not
establish their exact allowance cost.

Keep ChantPad's architectural rigor, historical notation evidence, and testing
standards while making agent handoffs and repository investigation more focused.
This is a documentation-only maintenance change, not part of Stage 9C.

## Agreed decisions

### 1. Selective investigation

Add a concise context-efficiency policy to [AGENTS.md](../../AGENTS.md) and
align the relevant sections of the [AI workflow](../ai-workflow.md).

- Read AGENTS.md and the current committed plan; use the documentation map to
  identify affected contracts. Read the relevant sections of owning guides and
  accepted ADRs, expanding to full documents when needed to understand a
  contract, dependency, or conflict.
- Prefer heading discovery, targeted searches, bounded excerpts, and targeted
  diffs to dumping multiple long documents or source files into context.
  Avoid rereading unchanged material already examined in the same session.
- Inspect relevant implementation and tests rather than assuming documentation
  establishes actual behavior. Expand investigation when evidence warrants it.
- Keep tool outputs concise. Capture long logs outside the conversation, report
  useful summaries, and read relevant failure excerpts. For running commands,
  use reasonable blocking waits or completion notifications where available;
  avoid frequent polling unless progress is stalled or diagnosis requires it.
- Efficiency never overrides repository instructions, accepted decisions,
  required verification, or correctness. Do not impose arbitrary token limits
  or prohibit reading complete files when justified.

Keep AGENTS.md a short entry point. Put detailed handoff and verification
process guidance in its existing owning documents rather than duplicating it.

### 2. Make the testing guide navigable

[Testing](../testing.md) is currently over 1,000 lines and mixes general policy,
commands, checklists, runner instructions, and accumulated milestone-specific
regression and acceptance records.

Retain in the main guide the authoritative current test strategy, fixtures,
automated/manual responsibilities, setup and commands, formatting and CI
policy, extension checklists, artifact policy, browser runner entry point,
and a compact index to feature-specific verification.

Move long feature-specific regression inventories and historical verification
details to their relevant existing `docs/verification/` directories or, where
no clear destination exists, a narrowly scoped linked verification reference.
Keep current per-feature verification requirements discoverable. Do not
silently relabel current obligations as historical.

Preserve the substance of every moved record, including exact commands and
environment overrides, test names and counts, revision-specific results,
limitations, and owner/foreground responsibilities. Distinguish current
instructions from historical results; do not change historical facts or claim
new verification. Avoid duplicating records already documented elsewhere:
consolidate only where equivalent coverage and provenance can be established,
otherwise retain the detail in a suitable destination.

Audit repository links to moved sections, including heading anchors and links
from plans, ADRs, and verification records. Update affected relative links
(including links within relocated content), or preserve an anchored index
entry at the old location when appropriate. Do not change unrelated historical
records beyond necessary navigation repairs.

Do not reorganize all subsystem guides or ADRs in this maintenance pass.
Improve their selective navigation via the workflow instead.

### 3. Use Git-backed checkpoints as session boundaries

Update the AI workflow to recommend fresh agent sessions for major approved
checkpoints, e.g. research/design, implementation, and integrated acceptance.
A new session should start from the current branch, committed plan, relevant
accepted ADRs, checkpoint commit, and PR evidence rather than replaying the
entire prior conversation.

At each completed checkpoint, record the revision, completed scope, actual
verification, caveats, and remaining work in the existing plan/PR or concise
committed evidence as appropriate. Do not introduce a separate permanent
session-log system. Preserve unrelated working-tree changes.

For an unexpected defect requiring substantial additional investigation,
identify the scope and consider a focused handoff. Do not force unnecessary
session resets for short related tasks; do not defer a blocking correctness
issue merely to reduce usage.

Future handoff prompts should name the relevant sections and decisions instead
of enumerating broad ADR ranges by default. Keep approved scope and exclusions,
including verification expectations, self-contained in the committed plan.

### 4. Preserve proportionate verification

Retain existing focused/substantive/comprehensive/docs-only tiers and all
applicable required gates. Avoid repeating checks whose evidence still applies,
and state the covered revision. The owner may run deterministic full browser
checks when appropriate, as already permitted by the AI workflow; explicitly
record unrun checks and do not mark them passed. Model/speed choices and
starting fresh are owner-side usage strategies, not mandatory repository
configuration.

## Scope and exclusions

- Markdown documentation only: AGENTS.md, docs/ai-workflow.md,
  docs/testing.md, selected verification documentation, and necessary link
  updates. Keep this plan available for review.
- No application code, tests, test scripts, runner behavior, CI configuration,
  dependency, native schema, notation-policy, or ADR status changes.
- No removal of historical evidence, image assets, regression requirements,
  or owner acceptance responsibilities. No blanket documentation rewrite.
- Do not modify PR #82 or its branch. Do not merge.

## Acceptance criteria and verification

1. AGENTS.md remains concise and clearly distinguishes mandatory context from
   relevant on-demand reading. The AI workflow describes checkpoint handoff
   and efficient output handling without weakening verification or escalation.
2. The main testing guide is materially shorter and contains a clear feature
   index, all current general policies and commands, and routes to detailed
   feature-specific checks. Report before/after line counts and approximate
   byte sizes for the main guide and AGENTS.md; these are documentation metrics,
   not a measured token or allowance saving.
3. Verify every moved testing-guide section against the base revision. Provide
   a concise old-section-to-destination map in the PR description, including
   any equivalent existing record used instead of moving text verbatim.
4. Verify new and relocated relative file links and heading anchors, and
   audit existing incoming links to changed headings. Use existing tooling if
   available or a small temporary check; do not add a dependency or permanent
   validation infrastructure. Identify any pre-existing unrelated broken links
   separately.
5. Run applicable Markdown formatting checks and `git diff --check`; inspect
   the full change for accidental deletion or scope expansion. This is a
   docs-only change: no application suite, production build, browser matrix,
   or performance benchmark needed unless a non-documentation change is
   separately approved. Report commands actually run and their results.
6. Explain what changed, what remains intentionally unchanged, and any
   unresolved navigation or duplication issues.

## Delivery

Work on this branch, commit the documentation changes, and open a PR targeting
master. Return the PR URL, before/after metrics, a brief migration map, and
verification results. Stop for owner review; do not merge.

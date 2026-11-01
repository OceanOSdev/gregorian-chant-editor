# Git-backed ChatGPT and Codex workflow

Use a Git branch and a committed task plan to carry agreed requirements from
ChatGPT to local Codex. The owner starts Codex explicitly; creating a branch
does not start implementation. Neither agent automatically receives the other's
chat context.

## Responsibilities and shared records

- The project owner decides scope, resolves design choices, starts local Codex,
  and accepts and merges the result.
- ChatGPT helps discuss requirements, UX, and architectural tradeoffs, commits
  the agreed plan through GitHub, and later reviews the actual PR diff.
- Codex investigates the local repository, implements the agreed intent, runs
  checks, commits on the handoff branch, opens the PR, and addresses review.

The [architecture overview](architecture.md), subsystem guides, and
[ADRs](adrs/README.md) own durable contracts. This workflow describes the
reusable process. A task plan records that task's intent and acceptance criteria;
the PR records actual changes, verification, deviations, and review. A plan is
not evidence that implementation or testing happened.

No persistent session log, generated status file, duplicate guide, or extra
GitHub issue is required. A small fix can use a short plan and proceed directly
without a second planning review.

## Prepare the handoff in ChatGPT

Agree on the problem, scope, and decisions before handing off implementation.
ChatGPT creates a task branch from the intended base (normally `master`) and
commits a self-contained Markdown plan, usually under `docs/plans/`. If GitHub
access is unavailable, the owner must create the branch and commit the plan
before handing it to Codex; a chat-only plan is not the shared artifact.

Adapt this outline to the task; omit inapplicable sections:

```markdown
# Plan: <task>

Branch: <task-branch>
Target: <base-branch>

## Problem and user-visible goal

## Agreed decisions

Link relevant guides and ADRs; include enough context to avoid needing the chat.

## Scope and exclusions

## Acceptance criteria and verification

## Open questions and stop conditions

## Delivery

Implement on this branch, commit, and open a PR against the target.
Report changes, verification, caveats, deviations, and remaining review items.
```

The plan specifies design intent rather than prescribing every function to
change. Codex determines implementation details from the actual repository.
Give the owner the branch name and committed plan path. Avoid concurrent edits:
ChatGPT hands implementation ownership to Codex after committing the plan, then
reviews through the PR rather than editing that branch simultaneously.

## Start local Codex

The owner can use this prompt, substituting the branch and plan path:

```text
Fetch <task-branch> from origin and switch to it, preserving unrelated local
changes. Read <committed-plan-path> and implement it following AGENTS.md and
relevant repository documentation. Run applicable verification, commit on the
same branch, and open a PR targeting <base-branch>. Stop and explain options for
architectural conflicts or significant ambiguity. Do not merge.
```

Codex first inspects the working tree and preserves unrelated changes before
switching. If switching would overwrite local work, it must preserve that work
safely or ask the owner how to proceed. Confirm the branch and intended base,
read `AGENTS.md` and the committed plan, and inspect relevant subsystem guides,
ADRs, and actual code before making changes.

For well-scoped work, implement directly. If substantial architectural ambiguity,
conflicting requirements, or a materially different approach emerges, stop the
affected work and report the evidence and options to the owner. The owner can
return to ChatGPT for a design discussion, then update the committed handoff
plan with the agreed material design or scope changes before Codex implements
divergent behavior. Link the PR discussion when useful. Ordinary coding
choices do not require approval. Keep to the requested milestone and its
explicit exclusions.

A task plan does not silently override an accepted ADR. For intentional contract
changes, update the owning guide and follow the amendment or replacement process
in the [ADR log](adrs/README.md). Escalate unexpected conflicts before proceeding.

## Verify and open the PR

Codex reviews the diff for scope and follows the authoritative
[testing guide](testing.md) for local automated checks and relevant manual
browser validation. Record actual results, failures, and checks not run with
reasons. Distinguish implementation, automated verification, manual testing,
and deferred work. Do not infer passing checks from a plan or code inspection.
Markdown-only changes skip hosted CI; skipped CI is not passed CI.

Commit implementation on the same handoff branch and open a PR against the
agreed base. Keep the committed plan available during review until the owner
chooses its closeout below. The PR description and return summary should explain:

- what changed and why;
- checks actually run and their results, including manual validation;
- caveats, deviations from the plan, and remaining review items.

Return the PR URL so the owner and ChatGPT can review the same artifact.

## Review and acceptance

ChatGPT reads the actual GitHub PR diff and available verification evidence,
then can post review comments. Codex addresses feedback on the same branch,
repeats affected checks, and reports the results. Routine review fixes can be
tracked in PR comments. Material changes to agreed design or scope must also
update the committed handoff plan before implementation, so a later Codex
session can recover current intent from the branch.

Before merge, the owner chooses how to close out the task plan: remove a
one-off plan (the PR and Git history preserve it), or retain a plan needed for
ongoing multi-stage work with an accurate status and clear remaining stages.
Mark completed retained plans as completed or archive them with an explicit
historical status; do not leave them looking active. Durable accepted decisions
belong in ADRs and owning guides regardless of this choice.

The owner resolves outstanding choices and decides when to accept and merge.
Codex does not merge as part of the handoff.

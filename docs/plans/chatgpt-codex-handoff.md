# Plan: Git-backed ChatGPT ↔ Codex workflow

Status: Implemented; PR review and owner closeout decision pending
PR: https://github.com/OceanOSdev/gregorian-chant-editor/pull/41
Branch: `docs/chatgpt-codex-handoff`
Target: `master`

## Purpose

Establish a low-friction collaboration workflow for the Gregorian Chant Editor:

1. The project owner and ChatGPT discuss requirements, UX, and architectural tradeoffs.
2. When ready for implementation, ChatGPT creates a task branch from the intended base and **commits a self-contained plan file** to that branch using GitHub.
3. The owner asks local Codex to check out the branch and implement the committed plan.
4. Codex examines the actual repository, implements the task, runs local checks, records what it verified, and opens a PR from **that same branch**.
5. ChatGPT reviews the actual PR diff and can post review comments. Codex responds on the same branch; the owner decides when to merge.

This is a Git-backed handoff **between ChatGPT and Codex**, not a handoff between PRs or a per-session activity log. The owner still initiates Codex; do not claim that creating a branch automatically starts Codex.

## Decisions / behavior to document

- Use **a branch plus a committed task plan** as the shared handoff artifact. The branch, plan path, and eventual PR URL should make a long chat transcript unnecessary.
- Treat the plan as the task's agreed **design intent and acceptance criteria**, not as an exhaustive instruction to change specific functions. Codex should investigate implementation details itself.
- Each task plan should be reasonably self-contained and identify:
  - the problem and user-visible goal;
  - decisions already agreed, with links to relevant ADRs/guides;
  - scope and explicit exclusions;
  - acceptance criteria and necessary verification;
  - unresolved questions and when to stop or escalate;
  - branch/PR expectations and what to report back.
    Omit inapplicable sections rather than adding boilerplate.
- The normal Codex invocation should be short: check out the specified branch, read its plan, and implement it. Codex must inspect its working tree and avoid overwriting unrelated local changes before switching branches.
- For well-scoped tasks Codex may implement directly. For substantial architectural ambiguity, conflicting requirements, or a materially different approach, Codex should report options and seek a decision before proceeding. Ordinary coding choices do not require approval.
- An accepted ADR is not silently overridden by a task plan. If a new feature intentionally changes an accepted contract, update the owning documentation and follow the ADR replacement/amendment process; escalate unexpected conflicts.
- A plan is not evidence of implementation or passing tests. Codex should distinguish implemented, verified, manually tested, and deferred work in its PR or return summary.
- No extra persistent session logs, automatically generated status files, duplicate documentation, or unnecessary GitHub issues are required.
- Don't have ChatGPT and Codex make concurrent edits on the same branch. The usual ownership handoff is: ChatGPT commits the plan; Codex owns implementation commits; ChatGPT reviews through the PR.
- If material design or scope requirements change after handoff, update the committed plan before implementing the divergent behavior; optionally link the PR discussion. Routine review fixes may be tracked in PR comments. Keep discussions and change decisions traceable.
- Before merge, the owner chooses whether to remove this one-off plan or retain/archive it with an accurate completion status. Durable accepted decisions belong in ADRs and owning guides.

## Implementation scope

This PR is documentation-only. Make these changes:

### 1. Update `AGENTS.md`

Preserve the existing valuable project, architecture, scope, and coding guidance, but make it correct and succinct.

- Fix **"No semicolons"**: the current `.prettierrc.json` explicitly sets `"semi": true`.
- Remove obsolete language suggesting PRs are not yet available.
- Update ADR pointers to include the **accepted** engraving-geometry ADR 0007 and lyric-anchor ADR 0008; keep the playback ADR 0006 clearly **Proposed**.
- Add a short link to `docs/ai-workflow.md` and instructions to read the _task's committed handoff plan_ when working on one.
- State clearly that agents should uphold agreed design intent, preserve established boundaries, ask about material conflicts, keep to the requested milestone, and accurately report verification.
- Avoid duplicating the entire new workflow or the authoritative verification procedures from `docs/testing.md`.

### 2. Add `docs/ai-workflow.md`

Document the concrete **ChatGPT → Git branch/plan → local Codex → PR → ChatGPT review** cycle.

Cover:

- responsibilities and limits of ChatGPT, Codex, and the project owner;
- creation of a task branch and committed plan by ChatGPT;
- a concise template/required information for a task handoff (adapted to task size);
- how the owner asks Codex to check out the branch and read the plan, including a short example prompt; leave exact branch/path as placeholders rather than hard-coded to this task;
- Codex's start-of-task checks (working tree, base/branch, relevant guides and ADRs);
- plan-first versus implement-now selection, escalation rules, and scope limits;
- local automated verification and manual browser validation, referencing `docs/testing.md`;
- Codex opening a PR with an account of changes, verification, caveats, and any deviations;
- ChatGPT reviewing the PR from GitHub, Codex addressing comments, and the owner accepting/merging;
- practical differences between a reusable workflow document, a task-specific plan, and a PR; avoid claiming the AI agents automatically share chat context.

Keep the workflow efficient: not every task needs a long plan, a second planning review, or extra documentation.

### 3. Update `README.md`

Add a short link from contributing/development guidance to the new workflow. Keep the existing setup and build instructions intact.

## Constraints and verified repository facts

- The actual default branch is `master`, and the project uses React 19, TypeScript, Vite, Vitest, and SVG.
- `docs/architecture.md`, subsystem guides, accepted ADRs, and `docs/testing.md` already contain detailed authoritative contracts. Link to them rather than rewriting them.
- `docs/adrs/0007-share-derived-neume-engraving-geometry.md` and `docs/adrs/0008-anchor-lyrics-to-neumes.md` are Accepted; `docs/adrs/0006-separate-notation-from-playback.md` is Proposed.
- GitHub CI runs Format, Lint, Test, and Build, but `.github/workflows/ci.yml` ignores Markdown-only changes; a skipped workflow **is not** a passed workflow.
- `docs/plans/lyric-system-redesign.md` currently has an outdated stage-status line. It is not part of this focused workflow PR; do not alter it as unrelated cleanup.
- No application code, CI configuration, dependencies, or ADR statuses should change in this task.

## Acceptance criteria

- A contributor can read the workflow and perform an end-to-end Git-backed handoff with only a branch name and committed plan path.
- There is a clear place for durable architecture (ADRs/guides), task-specific intent (branch plan), actual work and review (PR), and final human acceptance.
- The workflow explicitly supports returning to ChatGPT when Codex discovers a design conflict.
- `AGENTS.md` matches the repository's current formatter and ADR status.
- The new instructions are concise, noncontradictory, and don't require unnecessary rituals for simple fixes.
- All new relative Markdown links resolve.
- Documentation formatting passes `npm run format:check`; report any checks that weren't run. Since CI skips Markdown-only PRs, do not imply that skipped hosted CI proved anything.

## Codex execution and return

1. Confirm you are working on branch `docs/chatgpt-codex-handoff` and read this file plus `AGENTS.md` and the relevant guides. Preserve any unrelated local work.
2. Implement the three documentation changes above on **this branch**, not `master`.
3. Review the resulting diff and run applicable checks.
4. Commit the implementation and open a PR targeting `master`. Leave this handoff plan in the branch/PR during review unless the owner directs its removal.
5. In the PR description and response, note the changes, verification results, any decisions or deviations, and remaining review items. Do not start unrelated follow-on work or merge the PR yourself.

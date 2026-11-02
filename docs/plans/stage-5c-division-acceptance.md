# Plan: Stage 5C — division acceptance and documentation closeout

Branch: `feat/stage-5c-division-acceptance`
Target: `master`
Status: **Implementation handoff; owner acceptance pending.**

## Goal

Close out Stage 5's division feature with trustworthy foreground usability
evidence, targeted regression checks, and accurate documentation. Stage 5A
(PR #47) and 5B (PR #48) are merged. ADRs 0012 and 0013 are **Accepted**.
This is **not** a redesign or a request to add more notation kinds.

Our editor can already render and edit divisiones minima, minor, maior and
finalis, select/change/delete them, and insert neumes on either side.
Stage 5C should establish that these flows feel usable in a real browser,
especially alongside existing lyric editing, multi-system wrapping and
native keyboard focus.

## Read first

- `AGENTS.md` and `docs/ai-workflow.md`.
- `docs/testing.md`, `docs/editor-interactions.md`,
  `docs/layout-and-rendering.md`, `docs/roadmap.md`.
- Accepted ADRs 0008, 0010, 0011, 0012 and 0013.
- `docs/verification/divisions/README.md` and its existing driver
  `docs/verification/divisions/browser-check.mjs`.
- The retained Stage 5B plan in
  `docs/plans/stage-5b-division-engraving-ui.md`.

Do not repeat Stage 5B's implementation effort or treat its evidence as
owner signoff. It reported passing 881 Vitest cases, formatting/lint/build,
Chromium and Firefox headless division drivers, and lyric regressions.
The reported browser tests were headless, not manual foreground or spoken
screen-reader tests. Verify the actual current branch and commands.

## Stage 5C deliverables

### 1. A runnable owner acceptance checklist

Create a concise, plain-language Markdown checklist under
`docs/verification/divisions/` which the project owner can use when running
the application in **foreground Firefox on Linux** (and optionally Chromium).
Keep it focused on actual click/keyboard/visual interactions, not test code.
Include spaces for browser/version, OS, zoom/viewport, observed results,
bugs/notes and a clear final status: **Pending**, **Accepted** or **Blocked**.
All checks begin Pending/Not run; Codex must not check them off on behalf of
the owner.

Test the following ordinary user workflows, ideally with a small fragment
such as `Kyrie eleison` or another familiar chant:

1. Place each of the four bars between existing neumes and at the end;
   confirm recognizable glyphs, stable click placement, persistent tool and
   Escape/Select behavior. Inspect the minima and minor proportions.
2. Select a bar, change its type without moving it, delete it, Undo/Redo;
   neighboring notes, word boundaries and syllable anchors must survive.
3. Place a neume directly **before** an existing division and then directly
   **after** it. Confirm the pointer caret's side agrees with the committed
   order, and try the explicit before/after buttons without using a mouse.
   Include two adjacent bars and a trailing finalis.
4. Enter lyrics before and after adding bars. Try a bar between words, within
   a one-syllable melisma, and (as an unusual-but-legal case) between
   successive syllables of one word. Confirm no automatic word splitting,
   changed anchors or forced hyphens. Readability is the acceptance criterion.
5. Enter enough neumes to cause system wrapping; put divisions near line ends.
   Check for orphan divisions, collisions, missing continuation marks, or
   misleading insertion caret placement. Try a fairly long syllable, including
   one that requires horizontal scrolling, without requiring pathological
   strings in the normal UX.
6. Use native Tab and Shift+Tab from score, lyrics, toolbar and division
   controls. Verify focused versus selected state, Enter/Space, Delete/
   Backspace, I/T/L shortcuts, pitch editing, undo and draft recovery. Test
   focus after wrapping. Do not add a keyboard trap.
7. Inspect normal desktop width, a narrow ~320 CSS-px viewport and
   actual browser zoom (e.g. 80%, 100%, 125%, 150%). Record whether
   notation and controls remain usable; the known tiny responsive score
   is **not** a mandate for a new zoom policy in 5C.
8. Compare the four bar types and phrasing positions with a representative
   Gregorian square-notation reference. Log subjective engraving concerns
   separately from behavioral failures; no publication-quality overhaul.

Do not claim screen-reader speech coverage unless someone actually performs
and records it. The owner previously declined screen-reader-specific testing;
a report may explicitly retain **Not run** without pretending otherwise.
Foreground IME testing similarly remains Not run unless actually tested.

### 2. Codex automated verification and focused regression review

Run the existing required checks:
`npm run format:check`, `npm run lint`, `npm test`,
`npm run build`, `git diff --check`, and the relevant existing division,
lyric and word-composition browser drivers on locally available browsers.

Inspect the coverage matrix against the owner checklist. Add only **targeted**
tests for demonstrable uncovered high-risk division interactions; prefer
reusing the existing headless CDP/BiDi setup and fixtures. When only a manual
check can establish behavior (OS popup, browser/OS zoom, foreground keyboard,
actual screen reader), record this distinction rather than writing a
misleading synthetic success.

Capture a small, stable set of useful screenshots or measured assertions if
they reveal new coverage; avoid bulky generated assets and redundant test
fixtures. Keep all automated statements dated/scoped to actual runs.

### 3. Resolve discovered issues without enlarging the milestone

Fix small, reproducible Stage 5 regressions identified during verification
and add appropriate tests, following existing accepted ADRs. Keep changes
surgical. The owner should report usability problems through the PR; if a
material design change, new layout policy or ADR conflict is necessary,
**stop the affected work and explain options** rather than quietly redesigning
the editor. In particular do not silently change ADRs 0011/0012/0013.

Do **not** add features merely to make the checklist more impressive.
No new neume kinds, virgula, GABC import/export, persistence, playback,
clef redesign, general UI overhaul, zoom system or universal accessibility
framework belongs in Stage 5C.

### 4. Accurate documentation closeout

- In `docs/verification/divisions/`, distinguish **Codex automated**,
  **Codex browser-driver**, **owner foreground** and **Not run** results.
  Historical Stage 5B results remain historical and should not be silently
  relabeled as Stage 5C results.
- Update `docs/roadmap.md` and any relevant current-state guides only
  after implementation/verification warrants the statement. Correct stale
  PR #46 / #48 "pending merge" statements if encountered.
- The retained Stage 5B plan is historical now that PR #48 merged. Either
  update its header to accurately reflect the merged milestone and remove
  stale active instructions, or remove the one-off plan under the established
  workflow; leave the substantive accepted decisions in the ADRs.
- If owner checks remain pending when Codex opens the PR, say **Stage 5C
  owner acceptance is pending**. Do not declare complete, merge-ready based
  on foreground signoff, or revise a manual box to Passed prematurely.

## Acceptance and handoff sequence

1. Codex works on this branch, prepares the owner checklist, performs
   available automated checks, makes any small justified fixes, and opens
   a PR against `master` with the evidence and checklist location.
2. ChatGPT reviews the PR. The owner tries the checklist against the branch
   locally and reports actual observations; any follow-up fixes go into
   the **same PR** where practical.
3. Once the owner explicitly accepts the visible/editor experience,
   record that approval **accurately** in the verification summary and
   close out documentation. This does not imply screen-reader testing.
4. Merge only by owner decision. If anything remains knowingly deferred,
   describe it as an explicit limitation/backlog item.

Do not merge automatically. Report PR URL, changed files, exact commands and
outcomes, manual tasks awaiting the owner, and material unresolved questions.

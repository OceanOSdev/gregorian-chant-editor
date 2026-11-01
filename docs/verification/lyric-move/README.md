# Lyric anchor correction (Stage 3)

Run Vite with `npm run dev` and Chromium with remote debugging on port 9230,
then run `node docs/verification/lyric-move/browser-check.mjs`. Set
`CHANT_EDITOR_URL` when using a port other than 5173. The driver mounts the real
StrictMode editor through the existing development fixture. Screenshots are
written to a fresh system temporary directory, never into repository specimens.

The Chromium run passed on 2026-11-01:

- Actual DevTools mouse clicks commit immediately on a free earlier destination;
  occupied, crossing and current-anchor clicks explain rejection and retain mode.
- Left/Right and Previous/Next preview independently of semantic selection;
  Enter commits, Escape cancels, Tab traverses normally. Commit and cancel restore
  engraved-lyric focus. Cancel adds no undo step.
- One move is one undo/redo step; sibling positions and musical ink/IDs survive.
- First/last anchors reach lyricless prefix/suffix, including a later system.
- Existing dirty valid text saves before activation as a separate undo step;
  unchanged/cleared edits add no text history, and invalid text blocks activation.
  Missing IDs, empty/new drafts and stale/recovery cases are additionally covered
  at the pure reducer seam.
- At 320 px width the candidate is revealed, the selection stays on the moving
  lyric, and the page has no horizontal overflow. The saved diagnostic screenshot
  was inspected for instructions, preview outline and responsive controls.

The existing continuous-lyrics driver also ran as a regression check. These are
Chromium browser checks, not a foreground Firefox or spoken screen-reader pass.
Firefox foreground focus remains a manual review item, following the environment
limitation recorded in the [Stage 2 record](../continuous-lyrics/README.md).
Review in a foreground Firefox window: select a middle lyric, choose Move syllable,
browse with arrows, Tab/Shift+Tab to controls, cancel, then move by clicking a legal
neume. Repeat across systems; check the source, legal and preview indicators and
that moved-lyric focus is visible after commit. Screen-reader review should check
activation/rejection announcements and destination labels.

Stage 4 hyphen generation and its broader engraving verification are deferred.

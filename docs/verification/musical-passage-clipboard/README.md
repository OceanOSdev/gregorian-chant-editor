# Musical passage clipboard verification

The [interaction guide](../../editor-interactions.md#musical-passage-clipboard)
owns the contract and [commands and history](../../commands-and-history.md#musical-passage-copy-and-paste)
owns the command boundary. Implementation follows the owner-approved
[plan](../../plans/musical-passage-clipboard.md) (design commit `db096a2`). No
ADR, dependency, schema version, persistence field or engraving geometry changed.

## Automated evidence (2026-11-15 UTC)

Linux, Node 24.12.0 (`.nvmrc` requests 24.18.0), Chromium 157.0.8103.38,
Firefox 146.0. Standard gate passed on the final implementation: format:check,
lint, 96 Vitest files / 2,070 tests, build (existing large-chunk warning only)
and git diff --check. All 28 verification-runner tests passed.

- `src/editor/commands/musical-passage-clipboard.test.ts` (18 tests): pure copy
  and paste, as indexed in the [testing guide](../../testing.md#musical-passage-clipboard).
  It includes every bundled example copied in full (lyrics removed) and pasted
  into an empty score with identical effective degrees and alterations.
- `src/editor/state/passage-clipboard.test.ts` (9 tests; 10 after review): reducer atomicity,
  rejection identity (history, redo, selection, focus request, clipboard),
  one-entry success, repeat paste, Undo/Redo identity, survival across a new
  session, guards in all six exclusive modes, and the shortcut predicate.

The `musical-passage-clipboard` runner driver uses native pointer and key input
(Ctrl chords via CDP and WebDriver BiDi). It checks:

- a deterministic 28-neume, lyric-bearing multi-system fixture at 1440 and 390px:
  partial-neume copy rejection, keyboard range copy, Ctrl+V after a selected
  note's neume, repeated paste after the new range, fresh IDs, identical
  contours and marks, unchanged syllables, visible focus on the final pasted
  neume below the sticky toolbar, a synthetic key-repeat keydown that does not
  paste again, Undo by Ctrl+Z and button, exact Redo bytes, and Paste button
  append at the score end;
- that the title input keeps native Ctrl+A/C/V (`defaultPrevented` false, no
  announcement, clipboard unchanged). The native text round trip into the input
  was observed in both browsers. A real document text selection with a focused
  note keeps native Ctrl+C;
- a deterministic accidental conflict: after a compatible append, pasting a
  flat-bearing B after `p0` is rejected with “Cannot paste: the copied music
  would change existing note 1 after the insertion point from B-natural to
  B-flat.”. Saved bytes, Undo/Redo availability and note selection are unchanged;
- bundled Kyrie XI loaded through the example control: the first “e‑le‑i‑son”
  (neumes 3–8, whose flat is anchored above the copied Scandicus) is copied
  with Shift+Enter/Shift+Right and pasted after the Christe “son.”, before the
  finalis. Kinds, positions and marks match, the pasted sign is fresh and
  anchored above the pasted Scandicus, and syllables and divisions are
  unchanged. A repeated paste follows, two Ctrl+Z restore the exact Kyrie
  document, and the clipboard survives New and pastes into the blank chant (the
  flat included). Reloading Kyrie XI keeps the clipboard, and a 390px paste
  keeps focus visible.

Evidence is in ignored `.verification-runs/` directories:

| Run suffix             | Coverage                                                                                | Result                         |
| ---------------------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| `07-51-40-310Z-n10Qfr` | Clipboard driver, Chromium (first pass)                                                 | 1 passed                       |
| `07-53-03-475Z-9ZERiZ` | Clipboard driver, Firefox (first pass)                                                  | 1 passed                       |
| `07-57-27-762Z-Ad1Af6` | Final code: clipboard, contiguous-selection, continuous-lyrics, local-persistence; both | 7 passed, 1 unsupported; 108 s |

The continuous-lyrics driver is Chromium-only (CDP). Every run cleaned up its
processes. The full historical matrix was not rerun. The eight known baseline
failures recorded in the [contiguous selection record](../contiguous-selection/README.md)
remain separate and were not reproduced or changed here.

## Review follow-up (2026-11-15 UTC)

Addresses the two PR #88 review findings at `830b409`; same environment.

- Visible feedback: failed copy/paste explanations were only in the visually
  hidden live region. `EditorSession.clipboardFeedback` now holds the last
  failure text, rendered as one non-live line above the action buttons and
  referenced by Paste's `aria-describedby`. The live announcement still speaks
  it once. Success, a later document or selection change, and document
  replacement clear it (the clipboard survives). Rejections still change no
  document, history, redo, selection, focus or clipboard. The line occupies
  sticky-toolbar height only while shown.
- The driver now asserts that the accidental-conflict explanation (and the
  partial-copy explanation at 1440/390px) is rendered: inside the viewport,
  unclipped, opaque, topmost at its centre, not inside a live region, and
  describing Paste. It also asserts the focused note stays visible and the
  line clears after selection change and Undo, alongside the existing
  unchanged-bytes/history/selection checks (`conflict-feedback.png`).
- The variant fixture now covers every supported kind and cardinality (19
  kind/length pairs, guarded by an explicit set assertion), all three authored
  forms, mora, horizontal and vertical episemata.

Gate: format:check, lint, 96 files / 2,071 tests, build, git diff --check, and
28 runner tests passed. Run `08-07-20-184Z-visAY0`: clipboard and
contiguous-selection drivers in Chromium and Firefox, 4 passed, cleanup clean.

## Limitations

- Clipboard content is per running tab. It is not shared with the operating
  system or other tabs, and it does not survive a page refresh (by design).
- Paste rejects instead of compensating. For example, a copied passage that
  inherited a flat from outside the copy can paste only where the same flat is
  active; the reason is announced.
- Pasted music has no lyrics. It joins the preceding syllable, or remains
  untexted before the first anchor.
- The key-repeat check uses a synthetic `repeat: true` keydown; real
  auto-repeat timing was not exercised.
- Pre-existing clipped placement-context and lyric-move highlights are
  unrelated and unchanged.

## Owner foreground acceptance (pending)

Run `npm run dev`, then in a normal browser window at real zoom:

1. Load Kyrie XI. Click the first note of the first “e” Scandicus after
   “Kyrie”, press Shift+Enter, then Shift+Right five times (6 neumes). Press
   Ctrl/Cmd+C, or click **Copy**. Check that the announcement and the **Paste**
   count say 6.
2. Click a note of the Christe “son.” and press Ctrl/Cmd+V. Confirm that the
   eleison is duplicated before the double bar with its flat, that the pasted
   passage is highlighted, and that focus is visible on its last neume. Press
   Ctrl/Cmd+V again and check that a second copy follows the first.
3. Undo twice, then Redo twice. Confirm exact restoration and no stale
   highlight.
4. Choose **New** (or Import a file or load another example), then Paste. The
   music appears under that document's clef, preserving melody.
5. Conflict (every B in Kyrie XI is already flat): in Kyrie XI, Shift-select
   the opening “Ky” Podatus (its B carries a flat) and copy it. Choose **New**
   and enter two Puncta: any pitch, then B (the space just below the C line).
   Select the first Punctum and paste. Paste must be refused with “…would
   change existing note 1 after the insertion point from B-natural to B-flat.”
   Confirm that nothing changed, including Undo availability. With nothing
   selected, Paste at the end succeeds.
6. Edit the title and a lyric. Ctrl/Cmd+C/V must copy and paste text natively
   there, and the musical clipboard must not change.
7. Repeat steps 1–2 at a narrow window width and at 150–200% zoom. Check
   that the sticky toolbar never hides focus and that the passage highlight
   reads clearly across systems.

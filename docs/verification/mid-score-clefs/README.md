# Stage 6B verification

Stage 6B implements Accepted ADR 0015's independent clef collection, derived
mixed score order, scoped pitch preservation and measured custodes. The committed
handoff plan remains available for review; owner acceptance and plan closeout
remain separate from implementation.

## Automated checks

The implementation passes `npm run format:check`, `npm run lint`, `npm test`
(57 files, 1,182 tests), `npm run build`, and `git diff --check`.

New suites cover mixed-slot insertion and convergence in reversed collection
order, deletion/normalization, stale and ambiguous boundaries, leading/trailing/
redundant/empty events, 64 C/F offset pairs, initial-clef scope, safe arithmetic,
exact history and lyric-draft preservation, pending-action guards, measured guide
pitch, leading authored clefs, separated preceding bars, bounded long mixed runs,
slots, lyric/hyphen clearance, and guide replacement on reflow.

No new dependency, persistence format, event stream or ADR was introduced.
ADR 0015 and the handoff receive mechanical Markdown formatting only; formatter
ignore comments preserve the ADR's conceptual object examples verbatim.

## Real browsers

Use the repository's Vite fixture and temporary debugging browser profiles:

```sh
npm run dev -- --host 127.0.0.1
node docs/verification/mid-score-clefs/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session node docs/verification/mid-score-clefs/browser-check.mjs
```

Both Stage 6B browser runs passed. The driver mounts the actual StrictMode editor. It checks native pointer
insertion, multi-adjustment Apply/Cancel and final no-op, one-shot default melody
and notehead choices, native SVG keyboard selection/edit/removal, undo/redo,
focus restoration, dirty lyric drafts, tail insertion without a prompt, native
Tab, consecutive authored system-leading clefs, inert guides, and 1440/320px
containment. Select changes dispatch DOM change events; they do not exercise
operating-system dropdown popups. Firefox uses native BiDi pointer actions for
HTML activation because the established headless HTML Enter limitation remains;
Chromium also verifies native HTML Enter activation.

Regression checks actually run successfully:

- Chromium: Stage 6A clefs, divisions, continuous lyrics, lyric moves, vowel
  alignment, measured lyric spacing, word composition, and the measured 47-case
  word-composition corpus (no invariant errors).
- Firefox: divisions and the measured 47-case word-composition corpus (no
  invariant errors).
- Production Chromium: project-subpath assets, experimental notice, desktop and
  320px containment, clef insertion, refresh reset, and no observed runtime or
  asset-loading errors in a separate tab.

The spacing driver's wheel target now scrolls the score into view before input;
the new controls made its previous page-top coordinate fall outside the viewport.
Near-edge word fixtures reserve both the continuation mark and the new guide.
These are fixture corrections; assertions still require complete clearance.

## Selected engraving evidence

These are retained review specimens, not golden-image tests. All show the actual
editor, with the approved C/F contours unchanged.

- [Chromium mid-staff change](chromium-mid-staff.png): guide before an authored
  F clef, plus a guide at the outgoing system end.
- [Chromium system break](chromium-system-break.png): preceding minima stays on
  system one; C4 begins system two in the leading position, followed by F2.
- [Chromium 320px system break](chromium-320-system-break.png).
- [Firefox system break](firefox-system-break.png).

The introductory [Liber Usualis p. xviii](https://gregobase.selapa.net/sources/3/17.png)
was downloaded and visually inspected for the small rising guide and right-hand
shaft, and its anticipation of pitch under the old clef. This is not a claim
that the editor's wrapping policy or exact proportions reproduce every printed
example. The GABC and edition caveat in ADR 0015 remains unchanged.

## Owner checks still needed

- Judge guide appearance and spacing beside all eight C/F forms, including
  redundant/consecutive clefs and noteheads outside the staff.
- Foreground Firefox HTML Enter/Space activation, keyboard focus at actual
  browser/OS zoom, and native select popups.
- Spoken screen-reader output, foreground IME, and practical narrow-screen use.
- Real chant entry with lyrics across repeated clef changes and wraps.

Small responsive notation, fixed system height and absent ledger lines remain
existing limitations. Horizontal clef relocation requires delete/reinsert;
graphical clef insertion ghosts, accidentals, playback, save/load and ledger-line
redesign are outside Stage 6B. Headless assertions do not establish comprehensive
accessibility or publication-quality engraving acceptance.

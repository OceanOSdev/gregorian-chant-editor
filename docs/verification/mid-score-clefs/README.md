# Stage 6B verification

Stage 6B implements Accepted ADR 0015's independent clef collection, derived
mixed score order, scoped pitch preservation and measured custodes. The committed
handoff plan remains available for review; owner acceptance and plan closeout
remain separate from implementation.

## Initial implementation checks (`4a4d159`)

The initial implementation passed `npm run format:check`, `npm run lint`, `npm test`
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

## PR #60 review follow-up

All seven required correctness findings are fixed:

- Graphical neume insertion always uses the measured mixed-event slot, so both
  sides of mid-staff, trailing and system-leading authored clefs remain distinct.
- Oversized staff and canvas extents include clef/custos bounds; pointer slots
  beyond the normal staff edge remain reachable, including with a negative
  viewBox origin.
- A capture-phase Escape handler cancels the pending clef transaction before
  native lyric/input handlers, even if focus leaves the dialog.
- Insertion carets reserve their cap footprint outside guide bounds.
- No-selection I inserts at actual score end after trailing clefs/divisions;
  contextual insertion after a selected neume retains its explicit boundary.
- Apply validates unchanged candidate positions, then confirmation validates
  only the chosen pitch policy. Melody overflow leaves the prompt open with
  an explanation; valid Preserve noteheads still commits atomically.
- Lyric creation rejects authored-clef IDs, as well as IDs in other semantic
  collections, before changing the document.

The smaller interaction/documentation findings are also fixed: focused/selected
clef I announces explicit side choices; dropdown choices store semantic boundaries
and reject stale targets rather than retargeting an index; clef controls are
blocked during placement; Choose clef clears the target; descriptions distinguish
initial/effective/authored clefs; deletion wording matches immediate versus
pitch-confirmed removal; glossary and owning guides describe implemented behavior.

Both investigated engraving findings were reproduced against `4a4d159`:

- A 30-division run puts an outgoing guide on system one and an extra mid-staff
  guide before a clef on system two, anticipating the same note. The boundary
  walk now remembers the outgoing anticipation and suppresses the duplicate.
- Ten puncta followed by a clef and a wrapping clivis removed the mid-staff guide
  but left its 20-unit advance: clef left x=597 instead of x=577. The walker now
  rebuilds the following boundary geometry without that advance before finalizing
  the system. No renderer-side shift or new event framework is used.

The new regressions fail against the old walker and pass after the fixes.
The unit suite passes 59 files / 1,202 tests, including cross-boundary/slot
rejection, cross-collection ID collisions, and a continuation staff with F2
when the initial clef is C3. Formatting, lint, build and diff checks pass.

The extended mid-score-clef browser driver passes in Chromium and Firefox at
1440/320px, including native graphical insertion on both clef sides, Escape from
an outside lyric input, stable/stale dropdown targets, target clearing, focused
I feedback, actual-end insertion, disabled placement controls, selected-policy
overflow, actual caret/guide separation, oversized scrolled targets and duplicate
suppression. Firefox's existing headless HTML activation limitation remains;
HTML button activation uses native pointer input there, while Chromium also
exercises Enter. Native select popup and spoken-output acceptance remain manual.

Additional regressions rerun successfully for this follow-up: Chromium divisions,
continuous lyrics, lyric moves, vowel alignment, measured lyric spacing, word
composition and the 47-case corpus; Firefox divisions, word composition and its
47-case corpus. Both corpora report no invariant errors. The production Chromium
smoke check also passes for subpath assets, notice, desktop/320px containment,
clef insertion and refresh reset, with no observed runtime/asset-loading errors.

Selected fresh evidence: [Chromium division-leading transition](review-division-leading-chromium.png)
and [Firefox division-leading transition](review-division-leading-firefox.png).
Both retain the incoming decorative clef before leading divisions and the later
authored clef, with only the preceding staff's outgoing guide for that transition.

No correctness finding from the requested list is deferred or disputed.
Generalized event/placement frameworks, broad walker extraction, reducer rewrites
and fixture overhauls remain optional maintainability work and are deliberately
deferred as requested. Foreground keyboard/zoom, screen reader, IME and final
engraving acceptance remain owner checks, not claims of automated coverage.

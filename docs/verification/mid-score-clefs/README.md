# Stage 6B verification

Stage 6B implements Accepted ADR 0015's independent clef collection, derived
mixed score order, scoped pitch preservation and measured custodes. The committed
handoff plan remains available for review; owner acceptance and plan closeout
remain separate from implementation.

## Owner-approved shared pitch mode (current)

The existing `clefInsertionPolicy` is now the single **Pitch handling** option
for insertion and authored-clef editing. It is visible while a clef is selected,
while its draft is open, and during C/F placement. It defaults to Keep pitches
and remains transient; there is no duplicate setting. Mode changes never edit
music/history. Apply uses the current mode immediately with one undoable edit
and no preservation popup. Staged Apply/Cancel, scoped transformations, selected
IDs, lyric drafts and focus semantics remain intact. Unsafe Keep pitches keeps
the draft open with an accessible nonmodal error, permitting an explicit mode
change or draft revision/retry. No-op and Cancel preserve history/redo. The mode
persists even after Cancel. Deletion's conditional choice and required initial
clef's melody preservation are unchanged under amended Accepted ADR 0015.

Current checks passed: formatting, lint, **60 files / 1,231 tests**, production
build and diff checks. Focused unit coverage includes both type/line policies,
unchanged later-clef passages, exact atomic undo/redo, final no-op, cancellation
with redo/dirty drafts, shared mode across insertion → edit → insertion, overflow
rejection without fallback, draft revision and policy-switch recovery, and
blocking policy changes during deletion confirmation. The newly fetched plan
needed only mechanical Prettier emphasis formatting; its intent is unchanged.

The updated browser driver passed Chromium and Firefox at 1440px/320px:
visible/enabled shared mode while selecting/editing, keyboard-arrow draft entry,
contextual C/F and line changes, no-popup Apply under both modes, exact affected
note displacement and unchanged later passages, single-entry undo/redo, final
no-op, Cancel/Escape and dirty native lyrics, retained policy on returning to
placement, and deletion's separate conditional prompt/cancellation. Both also
passed edit overflow with a nearby status, unchanged committed glyph, mode switch
and successful retry. Full graphical insertion regressions still passed,
including mixed slots, wrapping, keyboard placement, 150% CSS zoom, remembered
neume I and containment. Chromium passed full keyboard-only HTML activation;
Firefox's two background HTML activation steps used pointer input, while native
radio arrows, toolbar navigation, Tab and score keyboard input passed.

Fresh actual UI evidence (reviewed, not golden images):

- [Shared Keep pitches and transient draft](shared-pitches-draft.png)
- [Keep pitches after Apply](shared-pitches-applied.png)
- [Keep note positions after Apply](shared-positions-applied.png)
- [Nonmodal overflow error with draft retained](shared-edit-overflow.png)
- [Deletion still asks conditionally](shared-deletion-choice.png)
- [Firefox 320px draft](shared-firefox-320-draft.png)

Chromium initial-clef and division regression drivers passed; Firefox division
regressions passed after restarting the isolated browser to clear an interrupted
driver's orphaned BiDi session. Production
Chromium smoke passed project-subpath assets, experimental notice, graphical
insertion, 1440px/320px containment and refresh reset, with no observed runtime
or asset-loading errors.

Earlier results below describe historical UI and do not establish current edit
behavior. Broader lyric/corpus checks listed there were not rerun for this
transaction/presentation-only correction.

Smallest owner test: select an authored clef → choose Keep pitches or Keep note
positions → Edit/change C/F and line → Apply once (no popup) → undo/redo. Repeat
with arrows, Cancel, and a later clef bounding the affected passage; switch back
to C/F placement and check the same mode remains selected. Delete should still
ask conditionally. Foreground Firefox HTML button activation, actual browser/OS
zoom, native popups, spoken screen-reader output, IME and owner engraving/320px
usability acceptance remain manual checks.

## One-click insertion mode at 900e56c (historical; edit confirmation superseded)

Insertion now uses a visible **Insertion behavior** radio group near the C/F
palette. **Keep pitches (move existing notes)** is the session default;
**Keep note positions (change pitches)** retains noteheads and reinterprets
pitches. The mode persists across C/F tools and consecutive placements, outside
the document/history. Pointer and keyboard placement apply it immediately as one
undoable edit, with no insertion preservation dialog. Unsafe selected-policy
arithmetic leaves music/history unchanged and displays an accessible nonmodal
explanation; it never falls back. Existing-clef draft/Apply/Cancel and conditional
edit/removal confirmation remain separate, under amended Accepted ADR 0015.

The existing geometry, snapped ghost/caret, latest measured slot resolution,
focus/reveal, dirty lyric draft, ID and history mechanisms are retained. Native
double-click continuation and keyboard repeat cannot duplicate an insertion.
No new semantic model, dependency, wrapping policy or speculative note preview
was introduced. Previewing shifted existing notes is the plan's optional polish;
the approved clef ghost remains visible.

The full pure suite passes **60 files / 1,227 tests**. Added/updated placement
coverage checks both policies with affected and unaffected notes, exact snapshots,
keyboard pitch conservation, C/F option persistence, safe-arithmetic rejection,
explicit retry, dirty drafts and blocking during an existing-clef transaction.

The replacement browser driver passed Chromium and Firefox at 1440px/320px:
C/F × all four lines × both modes, actual glyph/caret and exact inserted slot,
one-click affected-note commits with no dialog, measured displacement under each
policy, exact undo/redo, consecutive C/F mode persistence, mixed clef/division
boundaries, score edges, wrapping, existing-clef transient edits/conditional
confirmation and cancellation, focus return, dirty native lyric input, keyboard
placement, remembered-neume I and containment. Both also passed overflow rejection
with a nearby accessible status, no silent fallback, explicit mode switch/retry,
and 150% CSS-zoom placement at desktop/narrow widths. Chromium passed full
keyboard-only HTML activation. Firefox used pointer activation for two native
HTML buttons, while native toolbar navigation, Tab and score keyboard insertion
passed; the foreground default-activation gap remains a manual check.

Additional focused checks passed in both browsers: native radio ArrowRight
selects Keep note positions before an affected score-keyboard insertion, which
commits immediately with unchanged noteheads; a DOM double-click continuation
is inert. Chromium initial-clef, division, continuous-lyric, lyric-move,
vowel-alignment, measured-spacing and word-composition regression drivers passed.
Firefox division and word-composition regression drivers passed. Production
Chromium smoke passed project-subpath assets, experimental notice, 1440px/320px
containment, graphical insertion and refresh reset, with no observed runtime or
asset-loading errors. Formatting, lint, all 1,227 tests, build and diff checks
passed. Prior measured-corpus results below are historical; the corpus driver
was not rerun for this session-only insertion-policy change.

Fresh actual UI evidence (reviewed, not golden images):

- [Keep pitches: control and ghost](mode-keep-pitches-ghost.png)
- [Keep pitches: one-click inserted result](mode-keep-pitches-inserted.png)
- [Keep note positions: control and ghost](mode-keep-positions-ghost.png)
- [Keep note positions: one-click inserted result](mode-keep-positions-inserted.png)
- [Existing-clef edit still asks conditionally](mode-existing-edit-choice.png)
- [Firefox 320px ghost](mode-firefox-320-ghost.png)

The earlier graphical and form-first results are historical; their insertion
prompt descriptions do not describe current behavior.

Smallest owner test: choose C or F → choose Keep pitches or Keep note positions
→ hover → click once → switch C/F and repeat → Escape to Select → edit the
selected clef (Apply/Cancel, conditional choice) → undo/redo. Foreground Firefox
native HTML Enter/Space activation, actual browser/OS zoom, native select popups,
spoken screen-reader output, IME, narrow-screen usability and final owner
engraving acceptance remain manual checks.

## Graphical UX correction at b607089 (historical; insertion prompt superseded)

The C/F placement tools now live beside neumes in the main palette. A translucent
approved glyph snaps to a measured semantic slot and one of four staff lines;
click commits immediately unless existing notes need a pitch-policy choice.
There is no insertion form, event dropdown, global authored-clef picker or
preliminary Apply dialog. Tools remain armed after a click. Existing-clef edits
use a compact selected-clef panel and safe in-score draft overlay, retaining
ADR 0015's explicit Apply/Cancel and one final pitch choice.

No semantic model, approved glyph path, dependency or wrapping policy changed.
The implementation reuses the measured slots, clef geometry, session transaction,
focus and history mechanisms. Pointer clicks resolve again against the latest
committed document and font snapshot. Keyboard placement stores only a stable
boundary and staff line in transient state; I still inserts the remembered neume.
Clef arming and placement cancellation preserve dirty lyric drafts and redo.

Current automated checks pass: `npm run format:check`, `npm run lint`, `npm test`
(**60 files / 1,221 tests**), `npm run build`, and `git diff --check`.
The prior 1,202 semantic/layout regressions remain; the toolbar End expectation
now correctly names F clef. New pure coverage includes all C/F line snaps, hit-band
rejection/ties, exact mixed-slot preview/commit, latest measured state, empty and
division-only scores, invalid/stale tools/IDs/cursors, direct redundant/trailing
commits, both pitch policies, exact history, transaction serialization, preserved
lyrics, keyboard placement and safe existing-clef overlays.

The replacement `browser-check.mjs` passed in Chromium and Firefox at 1440/320px:
real pointer ghosts and all four lines; click at the previewed slot/line; direct
and conditional commits; exact note displacement under both pitch policies;
undo/redo; before/after adjacent clefs and divisions, score edges and wrapping;
contextual draft/Cancel/Apply, keyboard arrows and focus return; invalid hover/
click, switching, Escape, dirty native input, persistent tools, remembered-neume
I and page containment. Both browsers also passed pointer placement at 150% CSS
zoom at both widths. The full keyboard-only route passed in Chromium.
Firefox passed native toolbar navigation, Tab, and score slot/line/Enter handling;
its two HTML activation steps use native pointer input in the background test.

Legacy Chromium regressions also passed: initial clefs, divisions, continuous
lyrics, lyric moves, vowel alignment, measured lyric spacing and word composition.
Firefox division and word-composition regressions passed. Both 47-case measured
corpora completed with no invariant errors. The production Chromium smoke passed
project-subpath assets, experimental notice, desktop/320px containment, graphical
clef insertion and refresh reset, with no observed runtime or asset-loading errors.

**Firefox automation limit:** trusted Enter/Space events reach native HTML buttons
in this headless/background session without their default click action. The
same test separately tried Enter, Space and Return with no prevented events.
This is the already documented background HTML activation limit, not a new app
keyboard workaround. Foreground Firefox full keyboard-only activation, actual
browser/OS zoom, native select popups, spoken screen-reader output and IME remain
manual checks. Do not treat headless DOM assertions as spoken accessibility tests.

Actual UI evidence (reviewed, not golden images):

- [C tool and snapped ghost](ux-c-ghost.png)
- [F tool and snapped ghost](ux-f-ghost.png)
- [Inserted clef](ux-inserted.png)
- [Conditional pitch choice](ux-pitch-choice.png)
- [Compact contextual staged edit](ux-selected-clef-draft.png)
- [320px F ghost](ux-320-f-ghost.png)
- [Firefox F ghost](ux-firefox-f-ghost.png)

Smallest manual owner script:

1. Choose C clef or F clef; hover between notes and move across all four lines.
2. Click. Choose a pitch policy only if asked; trailing/redundant clefs insert directly.
3. Escape to Select, select the authored clef, and choose Edit clef change.
4. Adjust type/line; verify the draft, then Apply (or Cancel) and any pitch choice.
5. Undo/Redo each accepted operation; repeat at a staff break and a narrow viewport.

The following sections retain earlier verification evidence and describe the
**historical form-first UI**, superseded by this correction. Their old insertion
controls are not present in the current application or replacement browser driver.

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
at that historical checkpoint graphical clef insertion ghosts were deferred.
The current owner-approved correction above implements them. Accidentals, playback,
save/load and ledger-line redesign remain outside Stage 6B. Headless assertions do not establish comprehensive
accessibility or publication-quality engraving acceptance.

## Earlier PR #60 review follow-up (`83832f2`; historical interface)

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

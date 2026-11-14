# Stage 4B implementation verification

Stage 4B is implemented for owner review under Proposed ADR 0010. ADR 0005
remains Accepted. This record reports checks of this implementation, not final
Stage 4D cross-browser or editorial acceptance.

Run Vite and Chromium with debugging port 9230, then:

```bash
node docs/verification/lyric-spacing/browser-check.mjs
node docs/verification/vowel-alignment/browser-check.mjs
```

The standalone driver mounts the actual StrictMode editor using the existing
development fixture. It uses native DevTools mouse, key and wheel input; SVG
measurements and pure resolver expectations supplement those actual interactions.
`CHANT_BASELINE=1` captures the initial comparison and exits; run it against the
pre-4B checkout to reproduce the before image. Screenshots are generated in a
printed system temporary directory and are deliberately not committed.

## Observed results

Chromium headless at 1440px and 320px passed:

- Measured same-system clearance and multi-system wrapping for Kyrie eleison,
  adjacent words and long syllables; all seven supported neume silhouettes.
- Native text replacement, reflow, undo/redo; native word-boundary changes and
  undo/redo; selection independent of Tab browsing.
- Actual pointer ghost and insertion at the displayed global boundary on a
  later system, atomic undo/redo, surface focus and selected-note focus/reveal.
- Provisional font-measurement invalidation and recovery retain the focused
  syllable when it moves between system groups. Loading events are dispatched
  explicitly for this test; the separate font test loads a real local DejaVu Sans
  face and applies it to both visible and measurement SVG text.
- Left, right and two-sided oversized overhangs use a derived canvas, preserve
  font size, isolate the oversized item and retain normal wrapping afterward.
  Native arrow-key scrolling and horizontal wheel scrolling reach the content;
  the 320px page has no horizontal overflow. Scrolled pointer placement and
  focus/reveal remain usable on the next system, including negative origins.
- Existing Stage 4A browser regressions: language, native manual grapheme ranges,
  reset, undo/redo, dirty-draft preservation, text-change reset, combining marks,
  focus versus selection and responsive multi-system layout.

The before capture shows collisions around `son`, `longissimum`, `verbum` and
`misericordiam`. After spacing, the first long word has clearance, subsequent
words wrap to system two, and later music wraps normally. No conditional or
system-break hyphens are generated, so separated same-word syllables remain a
Stage 4C limitation. The 5-unit word minimum is deterministic across fonts;
platform typography still changes the measured advances.

Firefox, spoken screen-reader output and final auditione editorial appearance
were not verified. Local automated/browser runs used Node 24.12.0; `.nvmrc`
requests 24.18.0, which is not installed in this environment. Hosted CI is a
separate verification and must not be inferred from these local results.

## Same-word overhang regression

Manual review reported `Al / lealsdkfjaasdfhasdf / lu / ia / bla`. Chromium
reproduced a roughly 0.57-unit painted overlap between the final `f` and `lu`,
even though their typographic advances did not overlap. The placement and wrap
walk used advance-only extents: a font-metric omission, not a missing
same-word branch in the wrap algorithm. The adapter now measures glyph bounds;
layout uses their union with advances for clearance, fit and canvas overflow,
while retaining the advance-based vowel anchor. A half-unit measurement guard
covers responsive SVG hinting differences without introducing a word gap.

The native browser regression observes about 0.77 units of painted clearance
at that boundary after the fix. The original pattern fits on one system;
repeating the long syllable three times requires normal wrapping, and eight
times triggers isolated scrollable overflow. Native replacement and undo/redo
preserve IDs and derived geometry. Checks also inspect painted bounds at 320px
and throughout the existing alternate-font and pointer suite. Three new pure
regression tests were run against the old implementation and all failed, then
passed with the fix. Invalid ink measurements retain the deterministic fallback.

Before/after screenshots and the wrapped/narrow variants are generated in
system temporary storage, with paths recorded in PR #44 review evidence.
No hyphens or new same-word joining policy are introduced.

## Selected-syllable cue regression

The latest PR review identified an outward dashed selection outline crossing
`lu`, despite clear underlying glyphs. This was reproduced in Firefox using
native BiDi pointer selection with the pointer then moved away from the SVG.
The replacement is a pale purple background painted behind the selected text,
without a stroke or CSS outline and inset inside its measured horizontal extent.
Selection never changes musical/lyric positions, reserves extra spacing or
introduces hyphens. The original neume outline and separate blue lyric focus
marker remain.

`selection-cue-firefox.mjs` and the expanded Chromium driver check selected and
unselected versions of the reported long-syllable pattern at 1440px, 320px and
150% CSS zoom (480px viewport). They assert SVG glyph/background bounds, no
outward outline/stroke, background paint order and pointer inertness, exact
position stability, and cue removal when selecting a note. Screenshots include
both states with the pointer away from the score. Firefox's screen rectangles
include device-pixel rounding/padding; collision assertions use SVG glyph bounds.
The observed SVG ink gap remained nonnegative, so no separate text-spacing or
same-word legibility policy was introduced.

Firefox headless reported `document.hasFocus() === false`, although native pointer
actions correctly updated selection. This run verifies the captured rendering
and pointer selection, not foreground Firefox keyboard focus or final Stage 4D
acceptance. The earlier blanket Firefox-unverified statement describes the
initial spacing implementation; this targeted later Firefox rendering check is
now verified. Spoken screen-reader behavior remains unverified.

## Maintenance C repair (2026-11-14 UTC)

On clean `a6cdac3`, Chromium reproduced the `getComputedStyle(r)` TypeError:
`r` was null because the 150% CSS zoom lyric click had not selected the
syllable. Firefox independently passed the desktop and 320px cue assertions,
then reported `selected: 'false'` with no highlight at 150% CSS zoom.
The DOM still has the background as the first child of the lyric group,
behind text, with no stroke/outline and pointer-events none; selected SVG
clearance and positions were valid in the preceding cases.

Both drivers left note properties open after the note-selection/cue-removal
check. The panel followed later scroll/viewport changes into the next target;
Firefox native hit diagnostics identified its Mora scope label over the
zoomed lyric. This is the later nearby-properties UI (`e03aa12`), not a
change to the lyric cue hierarchy or spacing contract. The drivers now
natively close properties immediately after verifying cue removal and
position stability, while the note/panel are onscreen and before resetting
scroll or changing zoom. They assert dismissal. Scrolling the fixed panel
itself is inappropriate: offscreen-note panels are intentionally hidden.

Once Chromium reached the rest of its suite, the same panel also intercepted
Undo after Escape returned from placement to the inserted note in the
oversized fixture. Native dismissal there restores the existing exact
insertion/undo/redo assertions. All original text/history, wrapping, font,
overflow, later-system placement, focus/reveal and visual cue assertions remain.
No application behavior, layout policy or accepted ADR changed.

Final completion: Chromium spacing passed (18.6 s), Firefox cue passed (7.0 s).
Desktop, 320px and 150% CSS zoom assertions remain. See the
[shared run and gate evidence](../runner/README.md#maintenance-c-targeted-completion-2026-11-14-utc)
for versions, revision/dirty provenance, baseline logs and pending owner matrix.
Headless pointer/rendering results do not verify foreground focus or spoken
assistive technology.

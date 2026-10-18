# Scandicus and Torculus implementation verification

The approved ordinary constructions are implemented in the existing pure,
ID-free `buildNeumeGeometry`. The semantic model, commands/history, renderer,
preview pipeline, wrapping algorithm and dependencies are unchanged. ADR 0007
remains **Proposed** pending implementation review; its wording now explicitly
permits conventional disconnected ink. No new ADR is needed: the existing ink
array and independent note geometry already express this case.

## Final construction and differences from the draft

- Scandicus (1,1) is exactly the existing approved Punctum followed by the existing
  adjacent Pes. Their conventional visual separation is retained. An adjacent
  first interval with wider second interval also keeps an unmodified first
  Punctum and a separate, joined upper pair, matching the source construction.
  No first-to-middle specimen patch or artificial connection was added.
- Wider first intervals use the inclined, hooked middle member, fitted upper
  terminal and thin rising connection. The joined portion has one traced outer
  contour, preserving the upper opening. The middle member for adjacent first /
  wider second interval has a fitted flat top rather than an exposed Punctum
  crown, following its role as the upper pair's lower member.
- Torculus retains the approved three-column construction. Both adjacent corners
  use fitted tapers inside the head silhouettes, replacing the rectangular
  specimen patches. Each selected head also has one fitted closed contour; the
  normal glyph has one outer contour, without separately painted joins.
- Wide-interval hit padding remains horizontal and untrimmed. Sampling showed
  that imposing the draft's connector-midpoint column boundaries would exclude
  visible edges of vertically separated heads. Only adjacent horizontal padding
  is partitioned; the Scandicus upper pair also partitions vertically at the
  nominal pitch midpoint. No new hit geometry type is needed.

The [drawing metrics](../../engraving-metrics.md) own exact anchors, bounds,
advance, contact and hook recipes, reference basis, and extrapolation policy.
The [research draft](README.md) and SVG sheets remain the historical design
record, not a specification overriding the final metrics. No Greciliae outline
or font is included in application rendering.

## Actual editor screenshots

The review score was constructed using ordinary toolbar insertions and keyboard
pitch edits. It has eight Scandicus followed by eight Torculus, in the same
interval order for each kind:

`(1,1), (1,2), (2,1), (2,2), (1,3), (3,1), (2,4), (4,2)`.

Scandicus alternates first pitches 0/1; Torculus alternates 2/3. This puts notes
on both lines and spaces and includes equal, higher and lower Torculus outer
pitches. The first system contains the eight Scandicus, the second six Torculus,
and the third the last two Torculus. All share one lyric syllable to verify
first-system lyric ownership. No DOM fixture was substituted for editor state.

- [Desktop, 1100px viewport](implemented-desktop.png)
- [Normal, 760px viewport](implemented-normal.png)
- [Responsive, 430px viewport](implemented-responsive.png)
- [Torculus middle-head selection, normal](implemented-torculus-selection.png)
- [Torculus first-head selection, responsive](implemented-torculus-selection-responsive.png)
- [Scandicus translucent preview, normal](implemented-scandicus-preview.png)
- [Scandicus translucent preview, responsive](implemented-scandicus-preview-responsive.png)
- [Torculus translucent preview, normal](implemented-torculus-preview.png)
- [Torculus translucent preview, responsive](implemented-torculus-preview-responsive.png)

The normal and responsive score scale factors are approximately 1.01 and 0.55.
Scandicus middle-head selection is red in the main score screenshots. The
Torculus selection screenshots demonstrate both fitted adjacent corners. Preview
screenshots show the actual placement tool and ghost on the final system;
normal preview opacity is supplied by the existing renderer/CSS.

## Automated verification

The new `scandicus-torculus-geometry.test.ts` covers:

- Actual separated Scandicus (1,1) ink and fitted head overlays equal to the
  approved Punctum/Pes geometry; adjacent-first/wider-second retains Punctum.
- Exact hooked middle/terminal paths, integrated Torculus contacts, individual
  head bounds and absence of patch subpaths.
- Bounds, advances, nominal anchors, first-note lyric anchors and independent
  controls over interval combinations 1,2,3,4,5,6,12 on lines and spaces.
- Full ID-free preview/commit geometry equality at beginning, middle and end
  insertion boundaries over multi-system scores and reference/extrapolated cases.
- Exact fits and epsilon overflow, interval-induced width/reflow, stable ordered
  IDs, note/neume selection, focus targets, whole transposition/deletion,
  normalization, rejected equal-outer middle deletion and atomic undo/redo.

Existing layout/preview assertions were updated from placeholder metrics to
engraved metrics. The existing Clivis exact-fit history fixture now uses an
unchanged Climacus placeholder instead of Scandicus, preserving that test's
original measured widths. Approved Punctum/Podatus/Clivis path assertions and
Climacus/Porrectus placeholder regressions remain in place.

## Chromium verification

[Recorded browser results](browser-results.json) contain the checks and screenshot
fixture identities. Tests use the actual Vite application and Chromium DevTools
input events, plus pure geometry imports for independent SVG measurement:

- 798 actual `getBBox()` comparisons for ink and individual head paths across
  196 geometries, including line/space origins and intervals above 5. Every
  declared rectangle matched within 0.001 layout units.
- 58,664 sampled visible head points retained ownership by the corresponding
  note's hit rectangle, including SVG's later-note paint-order rule.
- 96 real constituent-head clicks at desktop and responsive sizes, Space
  selection, Tab order, accessible button roles and exact selected-head paths.
- Intended connected components remained connected in 84 raster samples at
  1×, 0.75×, 0.55× and 0.5× with fractional translation and 45% opacity.
  The two separated Scandicus ink components were tested independently;
  semantic unity was never treated as a requirement for one painted region.
- Real note editing/rejection, equal-outer Torculus middle-deletion rejection,
  whole-neume selection/transposition/deletion, normalization with surviving IDs,
  undo/redo and focus were exercised for both kinds.
- Both graphical tools disabled existing controls during placement, restored
  them on Escape, and produced exactly the same ink before/after commit,
  including at responsive size and when the ghost creates a new final system
  and expands the viewBox. Commit focused the first stable note ID.
- Each kind was also placed at the exact system right edge x=656. Changing the
  first interval from 2 to 1 widened it by 1.5 units and wrapped it to the next
  system. Actual browser focus and all three IDs survived keyed reparenting,
  undo and redo.

Screenshots were visually inspected for fitted contours, preserved openings,
selection feedback, responsive rendering and translucent joins. No internal
antialiasing seam or rectangular contact protrusion was observed. Raster
sampling supplements inspection; it does not prove every subpixel raster phase.

## Remaining limitations

Intervals above 5 use the documented project extrapolation, with no cutoff or
new semantic restriction. Extreme pitches retain the existing fixed-system
vertical collision/clipping limitations. No new neumes, notation variants,
fonts, persistence fields, or wrapping policies were added. There are no known
blocking issues; the implementation and screenshots await visual review.

## Repository checks

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm test`: 501 tests passed across 31 files.
- `npm run build`: passed, including strict TypeScript project checks.
- `git diff --check`: passed.

Verification used `npm run dev` and headless Chromium. Browser output contains no
observed runtime exceptions. No PR was opened.

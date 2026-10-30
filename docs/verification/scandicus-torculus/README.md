# Scandicus and Torculus: engraving proposal

The proposal and implementation checklist below are historical, including requests
to keep ADR 0007 Proposed during review. Current status and contracts belong to
[ADR 0007](../../adrs/0007-share-derived-neume-engraving-geometry.md)
and [engraving metrics](../../engraving-metrics.md).

Historical review draft, 2026-10-18. Implementation was subsequently authorized
with the clarification that conventional disconnected ink must be preserved.
The implementation supersedes this draft’s blanket connectivity assumption and
Torculus contact patches; see [implementation verification](implementation.md)
and the authoritative [drawing metrics](../../engraving-metrics.md). ADR 0007 is now Accepted (Proposed at this review). The approved Punctum, Podatus and Clivis remain unchanged.

## Research findings

Ordinary Scandicus ascends through three strictly increasing pitches. Ordinary
Torculus rises and then falls; the outer notes may be equal, or either may be
higher. Neither requires an oriscus, inclinatum, leading Clivis stem, or
liquescent terminal note. A narrow or fitted component inside an ordinary glyph
must not be mistaken for a semantic liquescence.

The principal evidence is Gregorio's font construction and Greciliae outlines,
rather than an assumption based on combining existing editor glyphs:

- [GABC notation, complex neumes](https://gregorio-project.github.io/gabc/#complex-neumes)
  explains automatic connection of ordered pitches; its illustrated examples
  establish the modern square-notation context.
- [GABC details](https://gregorio-project.github.io/gabc/details.html) distinguishes
  alternative constructions and modifications; these are not all ordinary forms.
- [Gregorio font README](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/fonts/README.md)
  describes Greciliae and assembly from component outlines.
- [Pinned squarize.py](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/fonts/squarize.py),
  functions `scandicus`, `write_scandicus`, `torculus`, `write_torculus`, is the
  decisive procedural reference. The pin makes the findings reproducible.
- [Pinned Greciliae component source](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/fonts/greciliae-base.sfd):
  inspect `Punctum`, `PunctumSmall`, `p2base`, `msdeminutus`, and
  `UpperPesOneNothing`. Component names describe font assembly, not necessarily
  the musical classification of the complete glyph.
- [GregorioRef 6.1.0](https://ctan.math.illinois.edu/support/gregoriotex/doc/GregorioRef.pdf),
  final score-glyph tables, separates `ScandicusTwoTwoNothing` and
  `TorculusTwoTwoNothing` from Deminutus, Ascendens, Descendens, Quilisma and
  InitioDebilis forms. The PDF's version is 6.1.0, 28 February 2025.

### Scandicus

The ordinary font construction has a first note at the left and the second and
third at the right, broadly in one upper column. It is **not three equally spaced
ascending Puncta joined by generic lines**.

For (1,1), the source explicitly places a Punctum followed by `PesOneNothing`.
Thus Punctum + Pes accurately describes that case, including its fitted Pes
opening. It is not a universal construction rule:

- First interval 1, second wider: `p2base` forms a broad lower member of the
  upper pair, with a fitted top/right attachment. The upper member is
  `PunctumSmall`, not an untouched standalone Punctum.
- First interval wider: the first head has a top-right attachment and a thin
  rising connection. The middle component `msdeminutus` has an inclined crown
  and a scooped, hooked lower-left termination. This remains an **ordinary**
  Scandicus when the complete glyph suffix is `Nothing`.
- Second interval 1: `UpperPesOneNothing`, when available, provides the compact
  upper pair. Its middle member and its opening differ from a generic full
  square head. This case depends on both intervals.
- Second interval wider: a thin right-side rise ends in `PunctumSmall`. Its
  fitted underside and terminal attachment are not the full Punctum outline.

The proposed sheets preserve these structural distinctions. The project crown,
softening, head proportions and hook depth are independent design choices;
Greciliae does not prescribe our 12-unit cells or 1.5-unit strokes.

### Torculus

The ordinary construction is a horizontally advancing low–high–low sequence,
not a stacked Pes followed by a stemmed Clivis. The source uses `PunctumLineTR`
first, a middle head chosen for its left/right attachments, and `PunctumLineTL`
last. There is **no free leading descending stem**.

For each interval 1, the relevant ordinary Punctum components make a fitted
contact instead of a long connector. For wider ascent, the first head's right
edge connects to the middle head's left underside; for wider descent, the
middle head's right edge connects to the last head's upper-left side. Each wide
join reduces that horizontal step by the join thickness. The middle head needs
both attachments when both intervals are wide. Equal outer pitches do not add
a fourth note or a horizontal baseline joining the outer heads.

Source code also contains a tiny first-adjacent spacing adjustment (+0.1 font
units). We do not propose reproducing it: finite fitted contacts, reviewed at
fractional scales, serve our independent contour design. No additional ordinary
branch based on the relative heights of the outer notes was found in this
builder. Specialized Torculus resupinus, liquescens, quilisma, initio debilis and
augmented/diminished forms are excluded.

## Specimens and their limits

- [Scandicus SVG](scandicus.svg)
- [Torculus SVG](torculus.svg)
- [Exact specimen paths, nominal anchors and complete bounds](specimen-recipes.json)

Each sheet contains (1,1), (1,2), (2,1), (2,2), (1,3), (3,1), (2,4), (4,2),
(5,5), and extrapolated (6,2). Torculus includes equal, higher and lower final
notes. Alternating rows shift by one staff step relative to four staff lines.
Columns show the actual placeholder recipe at 1×, project proposal at 1×,
Greciliae reference at 2×, proposal at 3× with a middle-head selection overlay,
and proposal at 0.55×. A bottom strip repeats the approved project contours.
One layout unit equals one CSS pixel at the sheet's intrinsic size; viewing a
whole tall sheet fitted to a window is not a 1× inspection.

Green dots mark nominal anchors; the green tick marks the first-note lyric
anchor. They are editorial annotations, not proposed ink. There are no added
ledger lines. Wide intervals intentionally extend beyond the four staff lines;
this proposal does not change vertical layout policy.

The reference column contains actual Greciliae 6.1.0 glyph outlines extracted
with FreeType from the local reference font used in the preceding engraving
review. Mapping is 157.5 font units per 12-unit staff step, with font y=0 at
local y=6. This is a nominal-cell comparison, not full GregorioTeX optical
placement or hinting. Source construction was independently checked against the
pinned source above. The reference interval range is 1–5; (6,2) has no reference
column. Greciliae is an adaptation of Caeciliae; reference outlines are attributed
to the Gregorio project and its font authors, under the project's
[SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/).
Reference outlines are review evidence only, not proposed application paths or
a font dependency.

The independent project drawings intentionally have gentler crowns and scoops
than Greciliae. In particular the Scandicus hooked middle and small terminal
head need visual approval; they are not a tracing or a claim of exact font
fidelity. Raster inspection of the sheets is not editor interaction testing.

## Architectural assessment

Reviewed `neume-geometry.ts`, `layout-chant.ts`, `NeumeInk.tsx`, `ScoreSvg.tsx`,
[metrics](../../engraving-metrics.md), [layout contract](../../layout-and-rendering.md),
[testing](../../testing.md), domain validation/normalization, and
[ADR 0007](../../adrs/0007-share-derived-neume-engraving-geometry.md).

**No geometry interface change is needed.** `NeumeGeometry.ink` can hold the
complete silhouette independently of three `notes[].head` shapes. A head path
need not be a rectangle, share its bounds' center, or independently reconstruct
the complete neume when combined with the other heads. `InkShape` already supports
arbitrary filled paths with explicit bounds. The renderer already paints supplied
ink once and separately strokes a selected head. Whole-neume outlines use
complete bounds, not the three head boxes.

The specimens use one SVG path paint operation with overlapping, consistently
wound subpaths where needed. This produces filled union ink without separately
composited edges. For production, prefer a single traced outer contour for each
connected neume, preserving the established construction contract; the specimen
subpaths are geometric construction evidence, not a proposed relaxation of that
contract. Do not render independently opaque or translucent heads and connectors.
In particular, a Scandicus (1,1) selection overlay must use the actual fitted Pes
head contours rather than reusing an approximate standalone outline.

The smallest organizational change would move the existing local crown and
underside string recipes into small private coordinate-aware helpers, only if
both new builders actually need them. Preserve the old path strings and bounds
with regression assertions. Add explicit Scandicus and Torculus branches and
update `firstHeadHalfWidth` to 6 for these kinds. No glyph registry, path algebra,
font adapter, new semantic fields, or general-purpose connection framework is
warranted. Existing `getInkBounds` unions declared bounds; it does not validate
Bezier extrema. Independent browser `getBBox()` checks remain necessary.

Rectangular `hitBounds` remain sufficient. Partition padding to stop a later
control stealing another visible head: Scandicus first versus upper column at
the shared x edge, then upper-column heads at their nominal inter-pitch y
midpoint; Torculus partition neighboring controls in x at the shared contact
edge for adjacent steps and the shared connector-column midpoint for wider
steps. Use disjoint rectangular column ownership, allowing empty join areas to
belong to one neighboring note. Verify every visible head interior remains in
its owner's target. Retain later-note ownership at exact ties through paint
order. These are per-builder policies, not a reason for polygonal hit targets.

A selected head traces its own fitted contour, including attachment-side closure,
not the entire connector or neighboring head. A closure at a join can legitimately
lie inside complete ink. It is feedback about the selected note, not an extra
normal-ink seam. Focus still outlines the independent hit rectangle. No change
to keyboard events, accessible labels, tab order, disabled placement mode or
focus IDs is proposed.

## Concrete project geometry

Let s=12, head width=12, join thickness t=1.5, first nominal pitch y=0,
a=first interval and b=second interval, both positive staff-step differences.
Coordinates below are local; the builder translates them to score-absolute
coordinates. JSON records the exact draft paths per case; formulas below define
the procedural family without an interval table.

### Scandicus rules

Nominal anchors are `(6,0)`, `(h+6,-12a)`, `(h+6,-12(a+b))`, where h=12 for
a=1 and h=10.5 otherwise. Lyric anchor is always x=6. The first head uses the
approved crown/scoop vocabulary, with its top-right join corner fitted where
needed. It is not given a free stem.

For (1,1), use the approved adjacent Pes outer contour translated to
`(12,-12)` after the first head; preserve its raised top, opening and musical
anchors. The constituent upper-pair overlays must be taken from that same Pes
construction. The specimen JSON includes those two fitted head overlays, independently of
the complete Pes ink path.

For a=1,b>1, the middle member has a broad, fitted upper edge and ordinary
scooped underside. For a>1 its top runs from `(h,u-3)` toward `(h+10.5,u-6)`;
its underside returns through `(h+8,u+4)` and `(h+3,u+6)` to a small left hook
ending at `(h+1.5,u+9)`, with u=-12a. This gives the inclined, hooked middle
member visible in the reference, rather than a generic Punctum.

The top member's nominal y is v=-12(a+b); its crown top is v-8 when b=1,
otherwise v-6. Its underside is fitted from `(h+10.5,v+6)` through quadratic
control `(h+8,v+4)` to `(h,v+4)`. A right-side strip at x=h+10.5…h+12 rises
from the middle member to this head. For b=1, the narrow opening and optically
raised crown are retained; for b>1, only join length grows. An a>1 rising strip
at x=h…h+1.5 meets the middle member's left attachment. The exact filled union
must be traced without filling the upper-pair opening.

Complete bounds: x=0…h+12, y=v-8…6 for b=1 and v-6…6 otherwise. Width is 24
for a=1, 22.5 otherwise. Advance is width+33 (57 or 55.5). Head bounds include
the middle hook and the raised upper head; hit partition uses nominal pitches,
not bounding-box centers.

### Torculus rules

Let h1=12 if a=1 else 10.5; h2=12 if b=1 else 10.5; u=-12a;
v=12(b-a). Anchors are `(6,0)`, `(h1+6,u)`, `(h1+h2+6,v)`.
Lyric anchor remains x=6, independently of outer-note equality or painted width.

All three members retain ordinary square-head proportions, with the approved
2-unit crown and 1.2-unit underside vocabulary on exposed edges. First and
middle right attachment edges are fitted; the last head's upper-left join
collar must stay intact. Do not force complete standalone Punctum curves through
these collars. Middle head carries both attachment sides; no duplicated Pes
head, no Clivis free stem, and no Porrectus-like diagonal ribbon.

Adjacent rises/falls have a finite 1.5-unit contact at the shared x edge; the
draft uses an overlapping 1.5×3 contact patch to make that construction visible.
The production outer contour must absorb that patch into fitted head corners.
Wider joins are 1.5-unit vertical strips in the overlapping horizontal columns,
terminating inside head ink. The actual draft control points and join extents
are recorded in JSON. No head is vertically stretched as an interval grows.

Complete bounds: x=0…h1+h2+12, y=u-6…max(6,v+6). Width is 36, 34.5 or 33;
advance is respectively 69, 67.5 or 66. The lower of the outer heads determines
the bottom bound. Individual head cells are 12×12 before fitted contact
extensions; selection outlines must include those extensions in the final
production contour rather than drawing a disconnected generic square.

### Extrapolation

The evidence inspected covers a,b=1…5, including the special adjacent branches.
Beyond 5, continue the corresponding wider vertical strip, without changing
head shape, horizontal offsets or semantic acceptance. This is an explicit
**project extrapolation**, not a documented Vatican rule. Five is the inspected
reference boundary, not a rendering cutoff or new validation rule. Both interval
magnitudes remain unbounded by this proposal. Existing extreme-pitch vertical
clipping/collision limitations remain outside scope.

## Implementation sequence and acceptance criteria

1. Review the two sheets and settle the contour choices below. Refine fitted
   head overlays and contact corners in review artwork, then freeze exact
   approved paths/bounds. Keep ADR 0007 Proposed pending implementation review.
2. Add the two pure geometry branches and change their first-head half-width
   from 7.5 to 6. Preserve note order and attach existing IDs only in committed
   layout. Keep all domain types, commands, persistence, renderer and tools.
   Introduce private path helpers only where actual duplication warrants them.
3. Add geometry tests for the full adjacent/wider matrix, both outer-pitch
   directions and equality, reference-range extremes and at least (6,2)/(2,6).
   Assert complete bounds, individual bounds, anchors, finite positive hit
   rectangles, advance and first-note lyric anchor. Independently check SVG
   actual bounds, including curves and contact extensions, against declarations.
4. Extend existing preview/layout tests: full ID-free geometry equals committed
   geometry at the same insertion point, including a new final system; exact fit
   stays, epsilon overflow wraps, following-neume gap stays 33; changing an
   interval between 1 and 2 can reflow while transposition preserves width.
   Retain oversized-neume progress checks and multi-system lyric ownership.
5. Regression-test each constituent's semantic ID/order, note selection,
   whole-neume selection/transposition/deletion, valid/rejected pitch edits,
   normalization after note deletion (including equal-outer Torculus rejection
   when removing the middle), one atomic history entry, undo/redo and reflow
   focus target identity. Reuse existing command tests rather than reimplementing
   command logic in rendering tests.
6. In the actual browser, click every head and near each shared boundary; Tab,
   Enter/Space, arrow editing, whole-neume shortcuts, deletion, undo/redo and
   focus restoration across systems. Check accessible ordinal labels and pressed
   states; placement mode disables note controls and cancel restores them.
7. Inspect at 1×, 3×, 0.75×, 0.55× and 0.5×, with fractional translations,
   opaque ink and translucent preview. No hairline gaps, dark overlap bands,
   closed Scandicus openings, stolen hit interiors or clipped selection strokes.
   Compare frozen Punctum/Podatus/Clivis contours byte-for-byte where practical,
   and preserve their metrics. Climacus and Porrectus retain exact placeholders.
8. Update the owning metrics/layout guides with approved rules and reference
   limits; update verification records and review ADR wording without accepting
   it prematurely. Run format check, lint, all tests and production build, then
   record browser evidence. No PR is part of this planning task.

Acceptance requires approved ordinary silhouettes, correct measured bounds and
wrap thresholds, preview parity, all three independently operable note controls,
stable musical/lyric anchors and identities, unchanged existing engraved forms,
and no expansion to other neumes or notation traditions.

## Decisions for review

- Approve or refine the independent Scandicus hooked middle and smaller fitted
  terminal contour. The authentic reference is stronger in these contours than
  our existing Punctum style; the sheet proposes a restrained adaptation.
- Approve the Torculus three-column proportions and finite adjacent contacts.
  The sample Torculus contact patches still need integration into the
  traced outer contour before application implementation, as identified above. No architecture approval or semantic change is needed to do that.

No decision is needed about outer-note equality, musical order, lyric centering,
new neume types, or interval limits: existing contracts already settle these.

## Verification of this planning artifact

The sheets were rasterized with ImageMagick and visually inspected. This checks
review artwork only. No application files or existing guides were modified;
no editor browser behavior or application implementation is claimed verified.
Repository baseline checks passed: format check, lint, all 487 tests across 30
files, and the production build.

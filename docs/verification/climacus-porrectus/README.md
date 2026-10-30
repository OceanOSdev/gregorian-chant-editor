# Climacus and Porrectus engraving proposal

The proposal and implementation checklist below are historical, including requests
to keep ADR 0007 Proposed during review. Current status and contracts belong to
[ADR 0007](../../adrs/0007-share-derived-neume-engraving-geometry.md)
and [engraving metrics](../../engraving-metrics.md).

Historical design proposal, 2026-10-18. The user approved the silhouettes,
selection mapping, optional hit shapes and final interaction refinements.
Implementation was subsequently completed; see the
[implementation screenshots and verification](implementation.md) and
[authoritative drawing metrics](../../engraving-metrics.md).
This proposal is retained as the independent design/reference record.
ADR 0007 was Proposed at this review; it is now Accepted.

## Review artifacts

- [Climacus SVG comparison](climacus.svg)
- [Porrectus SVG comparison](porrectus.svg)
- [Climacus browser crop](climacus-review.png)
- [Porrectus browser crop](porrectus-review.png)
- [Exact paths, anchors, bounds, advances and hit regions](specimen-recipes.json)
- [Measured browser results](specimen-browser-results.json)
- [Reproducible specimen generator](make-specimens.py)
- [Actual reference outlines and extraction metrics](reference-outlines.json)

Open the SVGs at their intrinsic width of 1050 CSS pixels to compare native
editor units. Each sheet contains all nine requested interval pairs and (6,2),
labeled **project extrapolation**. Columns show the actual placeholder recipe,
independent proposal at 1×, actual Greciliae outlines at 1.5×, proposed contours
at 2.5×, and proposal at 0.55×. Alternating rows put the initial pitch on a line
and a space. The final panels show each selected note separately for (1,1) and
(2,2); dashed blue regions are pointer ownership, blue outlines selection.
The SVGs are static review artwork, not interactive editor controls.

Green dots mark nominal pitches, not inferred centers of black shapes. Green
vertical marks show the first-note lyric axis. Staff lines are repeated in each
panel; large intervals intentionally extend outside the staff. No ledger-line or
vertical-system policy is proposed here.

## Research and evidential limits

Use modern Vatican-style ordinary forms, with Greciliae as a concrete engraving
reference rather than a universal prescription for every edition.

1. [Gregorio GABC fundamentals](https://gregorio-project.github.io/gabc/)
   distinguish square puncta from directional puncta inclinata and describe
   automatic neume grouping and virgae. This supports separating semantic
   grouping from graphical connectivity.
2. [Gregorio detailed notation](https://gregorio-project.github.io/gabc/details.html#spaces)
   discusses spacing of descending inclinata at larger intervals. Its prose is
   less precise than the procedural/default-spacing evidence below; do not
   translate that prose into an unqualified numerical rule.
3. [Gregorio font documentation](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/fonts/README.md)
   describes Greciliae and the component-based font construction.
4. [Pinned font builder](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/fonts/squarize.py),
   `porrectus`, `write_all_porrectus`, `write_porrectus`, and
   [pinned component outlines](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/fonts/greciliae-base.sfd),
   `porrectus1`…`5`, `porrectusam11`…`15`,
   `DescendensPunctumInclinatum`, establish the ribbon and diamond constructions.
5. [Pinned GregorioTeX writer](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/src/gregoriotex/gregoriotex-write.c),
   `get_punctum_inclinatum_space_case`, explicitly selects different descending
   spacing cases for differences 1, 2, and 3–4. Difference 5 falls through the
   default case; this is software fallback, not evidence for a conventional tight
   fifth-step construction.
6. [GregorioRef 6.1.0](https://ctan.math.illinois.edu/support/gregoriotex/doc/GregorioRef.pdf),
   spacing entries `beforepunctainclinatashift`, `punctuminclinatumshift`,
   `punctuminclinatumbigshift`, `punctuminclinatummaxshift`, and final glyph
   tables. Default descending adjustments are respectively −0.03918 cm,
   +0.07565 cm and +0.17865 cm for the latter three. These are TeX spacing
   adjustments, not center distances or project units.
7. [Gregorio's inclinatum styling discussion](https://gregorio-project.github.io/tips/inclinatum.html)
   shows that upright substitutions and associated spacing changes are distinct
   stylistic alternatives. They are not the ordinary descending form proposed here.

The pin is the same one used by the preceding engraving review:
`b63f074253bd2f6b837f9f9778bba299ac139ec0`. Font source files were inspected
from the existing local research cache; the writer was freshly retrieved at
that pin. The actual reference font is the previously downloaded CTAN Greciliae
6.1.0, not a claim that this later source pin generated that exact binary.
Font SHA-256:
`6208e48b9bde07a46db85a53d1a20d743da6bdd2c9b1f84382c2df9bb878d731`.
The component source and builder hashes are respectively
`31bd25cab11791a9a01dd4224dac8acf49ca3cd28c8b69bbaed8fcd084581ff3` and
`880a09d979f1e5f39dcd90ed07c25c07ed888514f8c3d7fccb7416aecb61882d`.
Writer SHA-256:
`392a6b00e54721b995e7e72b47a4873b7d59634a48fcc7770b7efae931cd657f`.

Reference SVG paths are unhinted FreeType outline decompositions, normalized by
12/157.5 with font y reversed and baseline shifted +6. Attribution: Greciliae,
The Gregorio Project; adaptation of Caeciliae. Reference-only outline data is
kept separate from independently drawn project recipes and never imported by
application code. This is nominal-cell comparison, not complete GregorioTeX
optical placement, hinting, or staff positioning.

**Climacus reference limitation:** there is no single assembled Climacus glyph
in this comparison. Its column uses authentic `Virga` and
`DescendensPunctumInclinatum` outlines, assembled with the proposal's center
spacing. The sheet labels this explicitly. It proves component appearance,
not Gregorio's complete spacing. Porrectus uses actual complete ordinary
`Porrectus…Nothing` glyphs for all nine pairs; the extrapolation has no reference
sample. No project contour was traced from these reference paths.

### Ordinary Climacus

Use an initial upright Virga: square-like head and a descending **right-hand**
stem. Follow it with two visibly separate descending puncta inclinata. These
are asymmetric oblique diamonds, taller than the ordinary project square head,
not rotated copies of our curved Punctum. The reviewed descending Greciliae
outline is quadrilateral; its ascending and stationary variants are different.
There are no connecting bars between the Virga and diamonds or between the two
diamonds. Widening an interval changes pitch displacement and spacing, not
vertical stretching of the diamonds. Close bounding boxes can overlap even
when painted contours remain separate.

Exclude liquescent deminutus/auctus terminals, upright/stationary substitutions,
ascending inclinata, extra preceding/following notes, and other specialized
families. The two complete diamonds are ordinary full notes, not reduced
liquescent terminals.

### Ordinary Porrectus

The first two pitches occupy the high left beginning and the low right ending
of a broad, descending, curved ribbon. The reader does not identify an
additional note at every intermediate staff crossing. The ribbon has substantial
vertical thickness and an oblique, calligraphic upper profile, a differently
curved lower edge, and a shaped lower-right toe. It is not a thin diagonal line
joining two stamped square heads. The ordinary stemmed source also adds a
left-hand descending queue. NOBAR and long-queue alternatives are not selected.

`write_porrectus` chooses an interval-specific ribbon; an adjacent final ascent
selects a dedicated `porrectusam1…` source where available. The final ordinary
member is `PunctumSmall`, fitted at the right, with a narrow rising connection.
It does not justify inserting an independent full Punctum at the ribbon toe.
The terminal is stacked above the toe; its fitted underside and the ribbon's
upper return define the opening. Increasing the final ascent lengthens the
narrow return. Increasing the initial descent changes the broad ribbon itself.

For evidence of nontrivial width dependence, base ribbon widths for descents
1…5 are 447, 547, 628, 704, 849 font units. Adjacent-ascent alternatives are
503, 628, 678, 721, 933. These source metrics motivate our widening rule; they
are not copied into the project. Exact curvature/thickness differs by source
interval. Our continuous formula below is an explicitly simplified project
style, subject to visual approval.

## Architectural assessment

Reviewed `neume-geometry.ts`, `layout-chant.ts`, `NeumeInk.tsx`, `ScoreSvg.tsx`,
[metrics](../../engraving-metrics.md),
[layout contract](../../layout-and-rendering.md), and
[ADR 0007](../../adrs/0007-share-derived-neume-engraving-geometry.md).

`NeumeGeometry.ink` already supports arbitrary paths and disconnected components.
`InkShape` suffices for both black silhouettes, ribbon selection portions,
whole bounds and previews. `NoteGeometry.anchorX/Y` already separate musical
pitch from optical contour centers. `layoutChant` attaches IDs after building
shared geometry; none of the new drawing pieces needs an ID. Measurement and
sequence placement already consume the complete ink bounds and advance.
`NeumeInk` is shared by preview and committed rendering and ignores note
selection contours. It needs no engraving logic or new framework.

`NoteGeometry.head` is only painted as a selection overlay, not as the normal
black glyph. Its type already permits a ribbon-region path. Keep the field for
compatibility, clarify its meaning as the note's selection contour, and update
the owning guide's literal claim that it encloses a painted _head_. There is no
reason to add artificial Porrectus noteheads, duplicate notes, a new glyph
framework, clipping support, or semantic document fields.

**Actual limitation: rectangular-only pointer ownership.** Tight Climacus
diamonds have diagonally overlapping bounding boxes. For (1,1), their centers
are (24,12) and (34.5,24); their boxes overlap at x=27.5…31, y=14…22.
A later transparent rectangle can steal clicks on the preceding diamond.
Splitting at a horizontal pitch midpoint or a vertical center midpoint clips
real diamond tips. Keeping that behavior would violate independently clickable
painted notes. The specimen uses clipped polygonal hit regions instead.

**Approved limited extension, not yet implemented:** add optional
`hitShape?: InkShape` to `NoteGeometry`. Keep `hitBounds` as the target's bounding
box for derived measurements. Keyboard focus deliberately follows the actual
target: polygonal for a path target, rectangular for the fallback. `ScoreSvg` paints the
provided path as its transparent target through `InkShapeView`, falling back
to today's rectangle when absent. Give a path target the same fill/pointer
focus styling as the existing target. Explicit `pointer-events="fill"` on the
new targets prevents the focus stroke from enlarging pointer ownership.
The target is an `aria-hidden="true"`, nonfocusable child of the named button;
selection overlays remain pointer-free. No additional focus rectangle is added.
All existing builders omit the field and retain their exact behavior. This
reuses an existing representation rather than adding a graphical abstraction.
Porrectus does not itself require the extension; its three rectangles partition
at the ribbon/terminal column and nominal pitch midpoint without cutting ink.
No proposed interface or renderer change has been made.

## Exact project constructions

All coordinates are local: first nominal pitch y=0; y increases downward;
semantic staff step s=12. `a,b` are positive staff-position differences.
Translate by the eventual score origin after construction. First musical anchor
and lyric anchor are always x=6; first system bearing becomes 6 for both kinds
so the first nominal anchor remains x=230. This change is local to these two
currently placeholder kinds.

Complete executable recipes, every `d` string and all concrete values for the
20 samples are in `specimen-recipes.json`; `make-specimens.py` supplies the
formula for other intervals. Those files are the exact review specification,
not application code. No approval is implied by their existence.

### Climacus geometry

Let `h=18` for a=1, `24` for a=2, otherwise `30`.
Let `k=10.5` for b=1, `19.5` for b=2, otherwise `27`.

| Note | Nominal anchor  | Black component / selection contour                              |
| ---- | --------------- | ---------------------------------------------------------------- |
| 1    | (6,0)           | New Virga; selection follows its square head, excludes free stem |
| 2    | (6+h,12a)       | Descending inclinatum, centered nominally at this anchor         |
| 3    | (6+h+k,12(a+b)) | Same descending inclinatum at final pitch                        |

Each inclinatum at `(cx,cy)` is exactly:

```text
M(cx−7),cy L(cx−1),(cy−10) L(cx+7),(cy−1) L(cx+1),(cy+10) Z
```

Its nominal anchor is not the quadrilateral's centroid. Bounds are 14×20.
These straight edges intentionally distinguish it from Punctum's curved crown
and scoop. The obliquity, dimensions and center offsets are independent project
choices inspired by the directional reference.

The initial Virga uses the approved exposed crown vocabulary, right outer edge
x=12 down to y=27, stem width 1.5 (return at x=10.5), and a fitted return to the
head's underside. It is traced once, not head and stem composited separately.
The initial selection contour is the ordinary 12×12 head. The initial head and
all five existing neume builders remain separate recipes; no existing path is
altered. Constant Virga length 27 is a proposed simplified short profile, not a
context-dependent TeX queue algorithm.

Complete bounds: x=0…`13+h+k`, y=−6…`12(a+b)+10`.
Width `13+h+k`; height `12(a+b)+16`; advance `46+h+k`.
Lyric anchor x=6 regardless of diamond spacing or total width.

Spacing classes and all values h/k are project optical choices. Tight diamonds
can have overlapping horizontal projections while their paint remains separate.
For a or b beyond 4, the chosen spacing plateau is **project extrapolation**;
(5,5) is labeled accordingly, and (6,2) supplies the explicit beyond-reference
example. Do not copy the writer's tight default fallback for difference 5.
Neither spacing plateau limits valid semantic intervals.

### Porrectus geometry

Set `u=12a`, `v=12(a−b)`,
`W=34+8(a−1)+(b==1 ? 4 : 0)`, and `z=W−12`.
Set terminal crown top `T=v−8` for b=1, otherwise `T=v−6`.
Set queue tip `q=27` for a≤2, `39` for a=3, otherwise `45`.

| Note | Nominal anchor | Selection region                                                    |
| ---- | -------------- | ------------------------------------------------------------------- |
| 1    | (6,0)          | Left ribbon body, from left pitch edge to x=z; no fictitious square |
| 2    | (W−6,u)        | Ribbon toe at lower right, x=z…W, around the second pitch           |
| 3    | (W−6,v)        | Fitted upper terminal, including its optical crown and underside    |

Note 2's pitch is indicated by the low right terminal area of the ribbon,
independently of its toe's deepest point at u+9. Note 1's pitch is at the left
ribbon section with top −8 and underside about +6. These anchors do not move
when curvature or the adjacent terminal crown is optically adjusted.

Trace the entire filled silhouette once, clockwise, with these commands:

```text
M0,−8
C(.27W),8 (.60W),(u−12) z,(u−5)
C(W−7),(u−3) (W−3),(u−3) (W−1.5),(u−6)
V(v+6)
Q(W−7),(v+3) z,(v+4)
V(T+2)
Cz,(T+.6) (z+3),T (z+6),T
C(z+9),T W,(T+.6) W,(T+2)
V(u+6)
QW,(u+9) (W−3),(u+9)
Lz,(u+7)
C(.60W),(u+4) (.25W),16 1.5,6
Vq H0 Z
```

The terminal selection path closes that same crown/right edge with the fitted
underside `V(v+6) H(W−1.5) Q(W−7),(v+3) z,(v+4) Z`.
It is not the standalone Punctum path: it has a fitted lower return, protected
right connection and a two-unit optical lift for adjacent ascent. Its nominal
cell width remains 12, despite the reference's somewhat smaller terminal.
This equal-width choice is stylistic, not an assertion about `PunctumSmall`.

For note 1, take the first upper cubic, close at `(z,u+7)`, follow the same
lower cubic to `(1.5,6)`, then `(0,6)` and close. For note 2, begin at
`(z,u−5)`, follow the upper hook, go to `(W,u−6)`, descend to `(W,u+6)`, follow
the toe quadratic, return through `(z,u+7)` and close. These closed interaction
regions introduce only colored selection boundaries; normal black paint always
comes from the single full silhouette. The initial queue is owned by note 1
but excluded from its selection contour. The narrow rising join belongs to the
terminal's control; no fourth control is created.

Complete bounds: x=0…W, y=`min(−8,T)`…`max(q,u+9)`.
Advance W+33. Lyric anchor x=6. Individual selection bounds are actual extrema
of their own paths, recorded by browser measurement in `specimen-browser-results.json`.
They are not substitute square cells at nominal pitches.

For b=1 the ribbon is four units wider and the upper crown is two units higher,
protecting the small opening. For b>1 the right return lengthens while head
width stays fixed. For a>1 the ribbon grows horizontally and vertically; its
cubic controls change with u and W. The queue plateau matches our simplified
Clivis-inspired profile, not the complete source stem schema. For a>5 or b>5,
continuing these formulas is **project extrapolation**, including curvature,
queue plateau and width growth. No font glyph cutoff or new semantic interval
restriction is proposed.

## Pointer ownership and feedback

Porrectus uses `m=(u+v)/2`:

| Control | Rectangular target (x,y,width,height) |
| ------- | ------------------------------------- |
| 1       | (−6, −14, z+6, max(q+6,u+15)+14)      |
| 2       | (z, m, 18, u+15−m)                    |
| 3       | (z, T−6, 18, m−(T−6))                 |

Thus the sweep left of the terminal column and initial queue select note 1;
the lower toe selects note 2; the upper terminal and exposed ascending return
select note 3. Every painted point belongs to a target. Exact shared edges
belong to the later note by SVG paint order. Rectangle corners also contain
some whitespace, as current padded controls do; that is intentional. Note 1's
broad region is deliberate and shown in the specimens. Approval of this mapping
is requested before implementation.

Climacus keeps the first target at x=−6…c, y=−12…33, where
`c=(12+(6+h−7))/2`. Each descending target begins as a padded quadrilateral
at offsets `(−11,0),(−1,−16),(11,−1),(1,16)` around its nominal anchor.
Clip both to x≥c. Then partition at the oblique line
`(11/6)x+y=K`, where K is the average of `(11/6)cx+cy` for notes 2 and 3.
The earlier diamond owns the ≤ side; the later the ≥ side. This line lies
between the complete black contours even at (1,1). Store the resulting closed
polygons as `hitShape`, with their exact bounding boxes as `hitBounds`.
Painted diamond tips stay clickable and target interiors do not overlap.
Exact shared boundary belongs to the later note. All concrete polygon vertices
are recorded in the recipes.

Selected-note feedback is stroke-only, following the actual head/diamond/ribbon
region; no white or colored head replaces normal ink. Whole-neume selection
continues to use complete painted bounds plus today's five-unit padding.
Keyboard focus follows the target contour (including polygonal targets), while
accessible labels, tab ordering,
pressed states, commands and pending-focus IDs remain owned by current code.
Controls remain three semantic notes in musical order, including Porrectus's
two ribbon pitches. Placement mode continues to disable committed targets and
remove them from tab order.

## Scoped implementation and verification plan

After the remaining interaction refinements are approved:

1. Add pure Climacus/Porrectus branches to the existing builder. Implement the
   optional hit target field and rendering fallback. Update first-head bearing
   for these two kinds. Leave all five prior engraving branches and metrics
   byte-for-byte unchanged. Keep semantic models, commands and history intact.
2. Update the owning metrics and layout guide with approved recipes, selection
   semantics and target fallback. Review ADR 0007's wording for the two completed
   kinds while retaining **Proposed** throughout implementation and review.
3. Parameterize geometry tests over the entire 1…5 × 1…5 matrix, requested
   samples, equal/asymmetric outer Porrectus pitches, transpositions and (6,2),
   (2,6), (8,8) extrapolations. Assert three anchors, nominal y, first lyric
   axis, direction-specific diamonds, separate Climacus parts, Porrectus ribbon
   and adjacent terminal branch, full painted bounds, advances and ID freedom.
   Preserve fixtures for every previously engraved kind.
4. Compare browser `getBBox()` on actual emitted SVG paths against declared
   bounds, including per-note selection and optional hit paths. Test curves'
   extrema rather than assuming control hulls are actual bounds. Sample contour
   interiors and edges for correct target ownership; click the actual ribbon
   left end, toe and upper terminal separately. Test tight diamond tips and
   exact target boundaries. No generalized path engine is needed in the app.
5. Reflow tests: new widths, exact-fit and one-unit-over boundaries, mixed
   kinds, oversized progress, interval-edit reflow, whole-neume transposition
   width invariance, multiple systems, stable IDs and unchanged lyric ownership.
   Compare hypothetical and committed geometries exactly, including hit paths.
6. Real editor browser checks: native 720-unit score, responsive view, DPR 1/2,
   and at least Chromium plus Firefox when available. Inspect antialiasing,
   separated diamonds, Porrectus openings, staff crossings, selected endpoints,
   and opacity-group previews for seams/dark joins. Exercise all nine pairs,
   then extrapolation. Capture transparent previews and their committed result.
7. Exercise individual/Shift whole-neume pointer selection, keyboard Tab,
   Enter/Space, arrows, Delete/Backspace, normalization after invalidated contour,
   undo/redo, insertion before/after, placement cancellation, disabled targets,
   and focus restoration across reflow/reparenting. Confirm accessible labels
   still count three notes and refer to stable semantic IDs. Pure tests cover
   command/history state; real browser checks cover event propagation and focus.
8. Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, and
   relevant manual `npm run dev` checks. Review screenshots and all changed
   files for scope. No notation font, dependency, new neume, clef, typography,
   ledger-line, playback or wrapping-policy work. Acceptance of ADR 0007 is a
   later decision after both implementations have been reviewed.

### Verification performed on this proposal

The generator successfully parsed both produced SVGs as XML. Chromium measured
all 20 proposed black silhouettes with **zero difference** from declared bounds.
A 0.6-unit grid sampled their painted interiors with zero uncovered points;
Climacus samples also had zero wrong-note ownership. The browser record includes
actual selection bounds. These are finite sampling checks of static proposal
artwork, not a proof of all intervals or application interaction behavior.
Both complete sheets were raster-inspected, and Chromium crops were inspected
at native units. Application behavior has not been changed or manually retested
as part of this design-only task. The implementation plan above remains work
for an explicitly authorized next step.

Repository checks also passed for this documentation/artifact-only change:
`npm run format:check`, `npm run lint`, `npm test` (501 tests in 31 files), and
`npm run build`. No editor interaction regression result is inferred from
the static-artwork browser checks.

## Approval state and interaction refinement

The user approved the black silhouettes, spacing conventions, independently
drawn diamonds, Porrectus selection mapping/contours, and the optional
`hitShape?: InkShape` extension. Those decisions are retained. Wider Climacus
spacing plateaus remain **project-specific optical decisions**, not verified
GregorioTeX layout rules.

The remaining review is limited to fixed Porrectus first-target top y=−14 and
explicitly polygonal Climacus keyboard focus. See the
[interaction refinement and verification](interaction-refinement.md),
[focused SVG](interaction-details.svg), and
[standalone keyboard/pointer specimen](interaction-demo.html).
The previous assertion that rectangular focus outlines remain unchanged with a
path target was incorrect: existing CSS styles the target itself. This proposal
now deliberately follows that behavior for path targets. No separate rectangular
focus indicator is proposed.

No application code or ADR status has changed. Implementation is still pending
this focused review; another broad engraving design review is unnecessary.

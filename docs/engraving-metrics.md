# Initial square-notation drawing metrics

This guide records the project's approved drawing choices for Punctum, ordinary
Podatus (Pes), ordinary Clivis (Flexa), Scandicus, Torculus, Climacus, and Porrectus. The geometry contract is owned by
[layout and rendering](layout-and-rendering.md). These metrics are project
conventions, not a claim that every Vatican or Solesmes edition uses identical
outlines or dimensions.

## Notational basis and reference coverage

The ordinary Pes stacks its lower-first and upper-second heads with the upper
head to the left of a right-side join. The ordinary stemmed Clivis descends from
an upper-left head to a lower-right head. Adjacent Clivis uses a fitted contact,
not the connecting line used for wider intervals. Specialized quadratus,
liquescent, quilisma, and initio debilis forms are excluded.

References are the [Gregorio GABC guide](https://gregorio-project.github.io/gabc/),
its [Podatus discussion](https://gregorio-project.github.io/gabc/details.html#podatus),
and actual published Greciliae 6.1.0 outlines for `PesOneNothing` and
`FlexusOneNothing` through `FlexusFiveNothing`. Stem comparisons used
[Gregorio's source schemes](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/fonts/stemsschemas.py)
and the corresponding Greciliae metrics. That default scheme derives partly
from the 1934 Antiphonale Monasticum; a separate Solesmes scheme also exists.
The project adopts a simplified default-short-inspired profile, not all of
Gregorio's context-dependent short/long/open choices.

Reference outlines were used for visual review only. Application paths are
independently constructed; no notation font or external outline is shipped.

## Project units

One staff step `s` is 12 layout units; consecutive staff lines are 24 units apart.
The following recipes use local `(x, y)`, with x = 0 at the first head's left
edge and y = 0 at its nominal pitch. Positive y points downward. Layout converts
these to score-absolute paths. Δ is the positive difference in semantic staff
positions, not a semitone count.

| Property                            | Project value                                   |
| ----------------------------------- | ----------------------------------------------- |
| Ordinary head cell                  | 12 × 12 units, centered on its nominal pitch    |
| Engraved stem/join thickness        | 1.5 units (`s/8`)                               |
| Gap between complete painted neumes | 33 units                                        |
| Selection outline padding           | 5 units; excluded from painted bounds           |
| Default note hit padding            | 6 units; partitioned for adjacent/stacked heads |

## Punctum

Standalone Punctum uses the approved Variant C calligraphic contour, independently
constructed with the user's Chant the Hours screenshot as its aesthetic reference.
The upper crown rises 2 units from its shoulders to the center; the lower scoop
rises 1.2 units from its tips. Upright sides and softened transitions preserve the
square-note silhouette. These are project drawing choices, not prescribed Vatican
dimensions or a copied font outline.

```text
M0,-4
C0,-5.4 3,-6 6,-6
C9,-6 12,-5.4 12,-4
V5.6
C12,5.9 11.85,6 11.6,6
C9.8,6 8,4.8 6,4.8
C4,4.8 2.2,6 .4,6
C.15,6 0,5.9 0,5.6 Z
```

All controls lie inside the original 12 × 12 cell, and the path reaches each
extreme: x = 0 and 12, y = −6 and 6. Painted bounds, hit targets, advance, and
wrapping therefore remain unchanged. Its nominal pitch and musical lyric anchor
remain (6, 0), with no optical translation. Committed ink, selection contours,
and placement previews consume this same derived path.

## Ordinary Podatus

Both nominal head anchors have x = 6; their y values are 0 and −12Δ.
The upper exposed top has a 2-unit crown, and the lower exposed underside a
1.2-unit scoop with softened outside corners. The lower head's top stays flat:
it forms the opening's floor. These fitted contours echo standalone Punctum
without replacing either compound head with its complete outline.

For **Δ1**, the upper contour is:

```text
M0,-18 C0,-19.4 3,-20 6,-20 C9,-20 12,-19.4 12,-18
V-6 H10.5 L9,-9 6,-10 0,-9 Z
```

Its top is raised two units optically from the nominal cell top. The opening
above the lower head is three units at the left and four near the middle.
The rightmost 1.5 units remain joined. The painted upper-head bounds are
12 × 14; its musical pitch remains y = −12, independently of that rectangle's
center. The complete glyph bounds are x = 0…12, y = −20…6.

For **Δ ≥ 2**, let u = −12Δ. The upper contour has crown y = u − 6 and
shoulders y = u − 4, right edge
x = 12, and a fitted underside from (10.5, u + 6), through quadratic control
(9, u + 4), to (0, u + 4). Its right join connects to the lower head at y = −6.
Only the join's length changes with Δ; the heads are never stretched vertically.

Each complete Pes renders as one continuous filled contour, with the opening as
an indentation from the left. It does not render separate abutting head/join
pieces. This avoids antialiasing seams, including in translucent previews.

The lyric anchor is always the first/lower nominal head center x = 6.
The notch, 1.5-unit join, complete bounds, and individual-head bounds retain
their previous dimensions. The lower scoop uses the same cubic underside
recipe as Punctum, with its top remaining flat at y = −6.

## Ordinary Clivis

The first nominal head center is (6, 0), the second y = 12Δ.
The first head has a 2-unit crown, with shoulders at y = −4 and peak y = −6.
Its exposed underside runs from (10.5, 6) through cubic controls (9, 6),
(8, 4.8) to (6, 4.8), then through (4, 4.8), (3, 6) to (1.5, 6).
Those fitted endpoints preserve the right attachment and left stem collar.

For **Δ1**, the second head starts at x = 12. The upper head's fitted underside
ends at (10.5, 6), then tapers to (12, 7.5). It meets the lower head along
a 1.5-unit vertical edge. There is no separate bridge or connector part. The
nominal body width is 24 units and the lyric anchor is x = 12.

For **Δ ≥ 2**, the second head starts at x = 10.5. A right-side 1.5-unit join
connects the heads. The body width is 22.5 units and the lyric anchor is x = 11.25.

The leading left stem occupies x = 0…1.5 and ends below the first pitch as follows:

| Δ       | Stem-tip y |    Length below first pitch |
| ------- | ---------: | --------------------------: |
| 1–2     |         27 |                       2.25s |
| 3       |         39 |                       3.25s |
| 4–5     |         45 |                       3.75s |
| Above 5 |         45 | 3.75s, extrapolated plateau |

The reviewed default-short source tips are −270, −270, −427.5, −495, and −495
font units. For comparison, mapping font y = 0 to the nominal head bottom and
b = 157.5 font units to one staff step gives descent `(0.5 − tip/b)s`:
approximately 2.214s, 2.214s, 3.214s, 3.643s, and 3.643s. Project values round
these to quarter steps. This nominal-cell comparison is not a reproduction of
GregorioTeX's complete optical placement or font hinting.

The whole Clivis, including both heads, contact/join, and leading stem, is one
continuous filled contour. Its bounds include the complete stem. Lyric alignment
uses the nominal two-head body midpoint, independently of painted extents.

The second head's top stays flat from its join-side attachment to its nominal
center. Its exposed right half curves through controls 9 units from its left
at the top and 12 units from its left at top + 0.6, ending at the right shoulder
at top + 2. This deliberately asymmetric crown protects the contact and join.
Its exposed underside uses the 1.2-unit Punctum scoop. Neither decoration
changes the head's 12 × 12 bounds. Individual-note overlays use these same
refined head edges; padded hit regions remain independent and unchanged.

## Ordinary Scandicus

The first interval a and second interval b are positive staff-step differences.
Let u=−12a and v=−12(a+b), with local first pitch y=0 and x=0 at the first head's
left edge. Set h=12 when a=1, otherwise 10.5. Nominal note anchors, in musical
order, are `(6,0)`, `(h+6,u)`, `(h+6,v)`. The lyric anchor remains x=6.

For **(1,1)**, the first component is the unchanged approved Punctum. The upper
component is the unchanged approved adjacent Pes translated to `(12,−12)`.
There is no additional stroke between them. This conventional separation is
intentional: semantic unity does not imply one connected painted region.
The individual upper-pair head contours and optically raised crown are exactly
the approved Pes contours, while all three semantic IDs remain distinct.

For **a=1,b>1**, keep the first component an unchanged Punctum. The middle
member of the upper pair has a flat fitted top at u−6 and the approved scooped
underside at u+6. It connects to the fitted upper terminal through the rightmost
1.5 units. Do not add the rectangular first-to-middle patch from the draft
specimens. The upper pair is one traced filled contour; the first Punctum stays
separate, as in the source's Punctum-based construction.

For **a>1**, the first head has a fitted top-right rising attachment. Its top
runs from the usual left crown to `(6,−6)`, then flat to x=10.5 for the inner
connection edge; the outer connection edge is x=12. The middle member is
specialized: from `(h,u−3)`, its crown curves through `(h+3,u−4)` and
`(h+8,u−6)` to `(h+10.5,u−6)`. Its right underside starts at `(h+12,u+6)`
and curves through `(h+8,u+4)`, `(h+3,u+6)` to `(h+1.5,u+9)`. The complete
contour flows from that hook into the first head's right connection. The
middle selection shape closes at x=h; it excludes the long connector.
This fitted, inclined, hooked head must not be replaced with standalone Punctum.

For all remaining cases, the upper terminal has crown top v−8 when b=1,
otherwise v−6. Its crown shares our approved two-unit curvature. Its underside
returns from `(h+10.5,v+6)` through quadratic control `(h+8,v+4)` to
`(h,v+4)`. A right-side join at x=h+10.5…h+12 meets the middle head. The
b=1 opening remains an indentation, with a raised upper crown; wider intervals
lengthen only the join. The complete joined construction for a>1 is traced as
one filled path, including the middle hook and upper opening.

Complete bounds are x=0…h+12, y=v−8…6 for b=1, otherwise v−6…6. Width is 24
or 22.5 and advance is 57 or 55.5. The specialized middle head's bounds are
12×15, beginning at u−6; the upper head is 12×14 for b=1 and 12×12 otherwise.
Individual anchors remain nominal even when these boxes are optically displaced.

Adjacent first-note hit padding is partitioned at x=12, and upper-column padding
at the nominal midpoint `(u+v)/2`. For a>1, keep the full first/middle horizontal
padding: clipping both controls at a connector midpoint would lose visible head
interiors. Vertical partitioning of the upper column retains all visible heads.

## Ordinary Torculus

Let a be the positive ascent and b the positive descent. Set h=12 when a=1,
otherwise 10.5; z=h+12 when b=1, otherwise h+10.5. Let u=−12a and v=12(b−a).
Nominal anchors are `(6,0)`, `(h+6,u)`, `(z+6,v)`. The lyric anchor remains
x=6 for equal outer pitches and either asymmetric direction.

Torculus has three horizontally advancing heads, with no free leading Clivis
stem and no stacked Pes. Exposed crowns and undersides use the approved
calligraphic vocabulary; attachment edges are fitted rather than stamped with
complete Punctum outlines. The final head retains the same flat join-side top,
curved exposed right crown and scooped underside used by our Clivis terminal.

For **a=1**, the first head's top rises from the usual left crown through
`(6,−6)` to `(10.5,−6)`, then tapers to `(12,−7.5)`. This fits against the
middle head's lower-left edge at u+6=−6. The first head bounds are 12×13.5,
y=−7.5…6; its nominal pitch is still 0. For **a>1**, the first top-right
collar is flat; a 1.5-unit connection at x=10.5…12 reaches the middle head's
lower-left attachment. Its head bounds stay 12×12.

For **b=1**, the middle right edge ends at u+7.5 and tapers to
`(h+10.5,u+6)`. This meets the final head at x=z along a finite contact, as
in adjacent Clivis. The middle bounds are 12×13.5, y=u−6…u+7.5. For **b>1**,
the middle head is 12×12; a 1.5-unit right-side connection joins the final head.
The middle scoop terminates at `(h,u+6)` for adjacent ascent, otherwise
`(h+1.5,u+6)`, protecting the left attachment.

The whole Torculus is one traced outer contour. Each individual selection head
is also one fitted closed contour, including its tapered adjacent corner. No
specimen contact rectangles, overlapping paint pieces, or internal join seams
are rendered. Adjacent note hit padding is partitioned at the shared x edge;
wider intervals retain full padded head rectangles because their visible heads
are vertically separated. Exact shared boundaries belong to the later note
through SVG paint order.

Complete bounds are x=0…z+12, y=u−6…max(6,v+6). Width is 36, 34.5 or 33;
advance is 69, 67.5 or 66. The lower outer note determines the bottom bound.
Changing either interval can change width and wrapping, while whole-neume
transposition cannot change width. First-head half-width is 6 for both newly
engraved kinds, preserving the system's first musical anchor at x=230.

## Reference basis for the three-note constructions

[Research and original comparison sheets](verification/scandicus-torculus/README.md)
record the Gregorio/Greciliae structural evidence. The pinned
[font builder](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/fonts/squarize.py)
explicitly constructs Scandicus (1,1) from Punctum + PesOneNothing, uses
interval-dependent middle and upper members elsewhere, and draws ordinary
Torculus using three advancing heads with adjacent versus wider attachments.
The project paths are independently constructed, not copied font outlines.
The 12-unit cells, 1.5-unit joins, hook depth, optical lifts and contact tapers
are approved project drawing choices. The
[implementation verification](verification/scandicus-torculus/implementation.md)
records actual editor screenshots and browser checks.

## Extrapolations

The reviewed reference range ends at Δ5 for each interval. Scandicus and
Torculus continue their wider-interval construction beyond 5 by lengthening
connections without altering heads or imposing an interval cutoff. This is a
**project extrapolation**, not a verified Vatican rule. Generalizing the right connection above
Δ5 and retaining the Clivis Δ4–5 leading-stem plateau are **project
extrapolations**, not prescriptions verified against published large-interval
glyphs. No interval cutoff or semantic restriction is imposed. Extreme pitches
can exceed fixed system height; this milestone adds no vertical collision
handling, ledger lines, or clef changes.

## Climacus and Porrectus reference basis

The [approved research and visual specimens](verification/climacus-porrectus/README.md)
compare actual Greciliae outlines with independently constructed project paths.
Porrectus ribbons are referenced through descent/ascent Δ5, including distinct
adjacent-ascent ribbon sources. Explicit GregorioTeX descending-inclinatum
spacing cases cover Δ1, Δ2 and Δ3–4; the source's Δ5 fallback is not treated as
a conventional spacing rule. All dimensions, curvature, diamond proportions,
Virga length and spacing plateaus below are approved project optical choices.
The five preceding engraving recipes remain unchanged. No font ships in the app.

## Ordinary Climacus

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
altered. Constant Virga length 27 is an approved simplified short profile, not a
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

## Ordinary Porrectus

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
of their own paths, recorded by browser measurement in the [proposal measurements](verification/climacus-porrectus/specimen-browser-results.json).
They are not substitute square cells at nominal pitches.

For b=1 the ribbon is four units wider and the upper crown is two units higher,
protecting the small opening. For b>1 the right return lengthens while head
width stays fixed. For a>1 the ribbon grows horizontally and vertically; its
cubic controls change with u and W. The queue plateau matches our simplified
Clivis-inspired profile, not the complete source stem schema. For a>5 or b>5,
continuing these formulas is **project extrapolation**, including curvature,
queue plateau and width growth. No font glyph cutoff or new semantic interval restriction is imposed.

## Climacus and Porrectus pointer ownership and feedback

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
broad region is deliberate and shown in the specimens. This mapping is approved.

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
are recorded in the [approved recipes](verification/climacus-porrectus/specimen-recipes.json).

Selected-note feedback is stroke-only, following the actual head/diamond/ribbon
region; no white or colored head replaces normal ink. Whole-neume selection
continues to use complete painted bounds plus today's five-unit padding.
Keyboard focus follows the target contour (including polygonal targets), while
accessible labels, tab ordering,
pressed states, commands and pending-focus IDs remain owned by current code.
Controls remain three semantic notes in musical order, including Porrectus's
two ribbon pitches. Placement mode continues to disable committed targets and
remove them from tab order.

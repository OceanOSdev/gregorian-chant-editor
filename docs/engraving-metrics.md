# Initial square-notation drawing metrics

This guide records the project's approved drawing choices for Punctum, ordinary
Podatus (Pes), ordinary Clivis (Flexa), Scandicus, and Torculus. The geometry contract is owned by
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

## Extrapolations and retained placeholders

The reviewed reference range ends at Δ5 for each interval. Scandicus and
Torculus continue their wider-interval construction beyond 5 by lengthening
connections without altering heads or imposing an interval cutoff. This is a
**project extrapolation**, not a verified Vatican rule. Generalizing the right connection above
Δ5 and retaining the Clivis Δ4–5 leading-stem plateau are **project
extrapolations**, not prescriptions verified against published large-interval
glyphs. No interval cutoff or semantic restriction is imposed. Extreme pitches
can exceed fixed system height; this milestone adds no vertical collision
handling, ledger lines, or clef changes.

Climacus and Porrectus retain 15 × 11 rounded placeholder
heads, 12-unit internal center offsets, and two three-unit vertical connectors.
Connectors are now filled rectangles in the shared ink representation; their
ends overlap the heads. Their silhouette metrics and 39-unit width remain
unchanged. Later neumes can move horizontally when preceding engraved widths
change.

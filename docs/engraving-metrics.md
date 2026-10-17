# Initial square-notation drawing metrics

This guide records the project's approved drawing choices for Punctum, ordinary
Podatus (Pes), and ordinary Clivis (Flexa). The geometry contract is owned by
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

## Extrapolations and retained placeholders

The reviewed reference range ends at Δ5. Generalizing the right connection above
Δ5 and retaining the Clivis Δ4–5 leading-stem plateau are **project
extrapolations**, not prescriptions verified against published large-interval
glyphs. No interval cutoff or semantic restriction is imposed. Extreme pitches
can exceed fixed system height; this milestone adds no vertical collision
handling, ledger lines, or clef changes.

Scandicus, Torculus, Climacus, and Porrectus retain 15 × 11 rounded placeholder
heads, 12-unit internal center offsets, and two three-unit vertical connectors.
Connectors are now filled rectangles in the shared ink representation; their
ends overlap the heads. Their silhouette metrics and 39-unit width remain
unchanged. Later neumes can move horizontally when preceding engraved widths
change.

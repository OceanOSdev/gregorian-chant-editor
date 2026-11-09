# Porrectus mora ownership — rejected proposals (historical)

PR #64, 2026-11-09. **The owner rejected A, B and C.** This comparison is retained
as historical evidence, not a live recommendation. See the
[conventionally constrained model proposal](../../../../plans/stage-8a-conventional-rhythm-model.md)
for the current review question.

**Investigation and rendered review specimens only. No new
convention is selected or implemented in the editor.** Production semantics,
native v2, the approved Porrectus contour and the current renderer are unchanged.
This reopens the visual-interpretation question after the trailing-placement
refinement; it does not supersede the owner's earlier approval by itself.

Start with the [rendered first-only versus third-only comparison](first-versus-third.png).
The four columns are current production ink and three candidates. Read the
candidate additions as proposed editorial conventions, not historical evidence.

## The current ambiguity is real

The generator imports the actual production geometry, rather than approximating
its silhouette. Its assertions confirm equal painted ink, ignoring paint order,
for these distinct authored states:

- First-only `[1,0,0]` versus third-only `[0,0,1]` for all three equal-outer-pitch
  patterns pictured here: `[4,2,4]`, `[3,1,3]`, `[5,4,5]`.
- Double on the third `[0,0,2]` versus singles on the last two `[0,1,1]` for
  `[4,2,4]`. Thus changing only outer-note spacing would not address every alias.

A reader cannot recover these distinctions from ordinary trailing dots alone.
The [prior primary-source research](../README.md#what-the-references-establish)
explains why conventional trailing marks and Gregorio's last-two-note double
sign do not provide a one-to-one notation for our full note-level model.
[Gregorio's rhythmic-sign guide](https://gregorio-project.github.io/gabc/details.html#rhythmic-signs)
is a reference for ordinary signs, not a precedent for any candidate below.

## Rendered examples

Every full sheet includes **first-only, second-only, third-only, first+third,
all three, a double on each individual note, second+third, and mixed singles/
doubles with horizontal episema**. The last-two singles are a conventional
control against the individual-note double. Numbers under each row describe
its authored mora counts in note order; the mixed row is `[2,1,2]` with all
three episemata enabled.

- [Equal outer notes on a line](equal-line.svg), also retained as a
  [Chromium screenshot](equal-line.png).
- [Equal outer notes in a space](equal-space.svg).
- [Adjacent final ascent](adjacent.svg).
- [Unequal outer notes](unequal.svg), as a control.
- [Native 1× glyph scale](equal-line-native.svg); the other sheets show 1.5×.

Open the SVGs at intrinsic width for the stated scale. They are static review
artwork, not screenshots of a new editor mode. Every candidate contains the
exact original black body path. Existing episema ink is reused. The gray color
of added lines/text is a presentation cue, not the ownership encoding; their
shape/text must work in monochrome too.

## A. Local dot groups with endpoint leaders

For exceptional assignments, put the first-note group above the left ribbon
endpoint, and the second/third groups near their corresponding right endpoints.
A thin angled editorial leader connects each group to the relevant endpoint;
a small bracket groups two dots that belong to one note. Doubles on the first
extend upward to avoid the ribbon. The leaders and brackets are essential:
local horizontal placement alone is not the proposed solution.

First-only is the left linked group; third-only remains the usual final dot.
First+third has a separate leader for each owner. A double has one bracketed
group/leader to one endpoint, so it differs from two independently owned groups.
Ordinary last-pair singles retain the current ink without leaders.

This is a visible departure from conventional dot placement. It requires a
legend; thin leaders/brackets could be confused with episemata, ictus or other
annotation strokes. The mixed row shows how crowded the first endpoint becomes
near its episema. A real implementation would need contour-aware clearance and
routing for leaders, brackets and both dots; these specimens do not demonstrate
collision-free routing for all intervals. Complexity is the highest of the
three. In the pictured cases it can require up to 25 extra horizontal units
beyond current ink, plus vertical room above the first note.

## B. Indexed trailing dot groups

Keep the signs to the right, but give exceptional groups explicit editorial
indexes `n1`, `n2`, `n3` in fixed trailing lanes. A single index covers a one- or
two-dot group. Thus an `n3` double cannot be mistaken for the separately indexed
`n1`/`n3` groups. First-only has `n1`; ordinary third-only retains its unindexed
conventional terminal dot. Last-pair singles remain conventional too.

This retains the trailing vocabulary but is not a traditional rhythmic sign.
Without the literal indexes, lane offsets are insufficient: extra space could
just look like loose typesetting, and two neighboring dots could be read as a
double sign. Indexes may resemble other numerical editorial annotations, so
`n` and the legend are required, and they must remain readable at native scale.
The wider lanes make the mixed case easier to separate, at the cost of up to
approximately 46 extra horizontal units in these samples. Implementation is
moderate: measured tags and fixed group lanes, with collision/bounds/reflow
integration. It has the largest horizontal wrapping cost.

## C. Conventional trailing ink plus a visible ownership line — recommended

Keep the **exact current rhythmic ink**. For every first-note mora or individual
note-level double, add a compact editorial line such as `m[1,0,1]` beneath the
notation. The three positions mean the dot counts on notes 1, 2, 3; zero means
no mora. The `m` prefix and brackets distinguish this from rhythmic signs.

Do not add this line to ordinary second-only, third-only or last-two single
moras: those keep their conventional interpretation. Consequently first-only
has `m[1,0,0]`, while ordinary third-only has no ownership line. First+third has
`m[1,0,1]`; a double on the third has `m[0,0,2]`. The line remains visible in
any eventual score output—never selection-only, hover-only, a tooltip or a
separate panel the reader might not have. Its text, not the horizontal stagger,
resolves the ambiguity. The line is engraving derived from existing note data,
not a proposed new persisted field.

This preserves the ordinary Gregorian music layer most faithfully, while
explicitly declaring that unusual per-note distinctions require an editorial
reading convention. It does not assert that two dots on one note have Gregorio's
conventional double-sign meaning. Readers must learn the three-position legend;
that is a real tradeoff, not a claim of instinctive readability.

The sampled 9-unit text fits within the current horizontal ink allocation for
all four pitch patterns, so these examples need no additional horizontal advance.
It extends about 30 units below the staff in the specimen. A production layout
must measure and reserve a dedicated annotation row before lyrics and account
for it in system height, rather than overlaying text into today's fixed lyric
gap. Unusually low notes may need more room. Complexity is moderate and lies in
measured text/vertical layout, instead of leader routing or new musical symbols.
Native-scale readability and readers' ability to use the legend need owner
acceptance. The samples are not proof of a finished vertical-spacing policy.

## Why not simply stagger or separate the notes?

Bare horizontal offsets do not specify which of two equal-pitch notes owns a
dot. Bare vertical staggering is also unsafe: moving a dot into the next staff
space can suggest another pitch, collide with an episema, or imitate the paired
conventional double sign. A and B therefore add explicit group-to-owner cues.
C admits that ordinary dot geometry alone is insufficient and supplies text.

A disjoined rendering—separate first note plus an ascending pair, or three
separate notes—could expose individual attachment points. It would replace the
approved ribbon contour and change the visible grouping. Its equivalence for
each authored case is not established by the current references. Gregorio's
[group-boundary controls](https://gregorio-project.github.io/gabc/details.html#spaces)
allow grouping choices, but do not establish that arbitrary splitting is an
editorially neutral substitute. This alternative is outside the current contour
constraint and is not recommended without reopening that constraint explicitly.

## Historical recommendation — rejected by owner

**Recommend C**, limited to first-note moras and individual-note doubles.
It preserves conventional engraving for common final-pair cases and makes the
remaining distinctions explicit without inventing an unlabeled rhythmic glyph.
A is more spatially direct but has the greatest collision and sign-confusion
risk. B is compact vertically but makes rare assignments consume much wider
musical space and still depends on a new editorial indexing convention.

If permanently visible editorial notation is unacceptable, none of these
specimens demonstrates that ordinary trailing dots alone can satisfy all the
current semantic distinctions. We would need either an approved A/B-style
visual convention or permission to revisit the contour/representation boundary.
Do not silently choose one on the reader's behalf.

The owner has since rejected all three candidates. None is wired into the app;
no editorial ownership notation, semantic/persistence change or merge resulted
from this comparison.

## Reproduction and validation

From the repository root:

```bash
node docs/verification/note-modifiers/porrectus-mora/ownership-review/make-specimens.mjs
```

The script uses the existing Vite dependency to bundle the unchanged geometry
into a fresh temporary directory, generates the review SVGs and `specimens.json`,
then removes that temporary bundle. It never imports a candidate into the editor.
Assertions verify exact body-path reuse, unchanged ordinary-case ink, and the
baseline aliases above. For C, all 27 mora-count combinations have distinct
ink-plus-editorial-text encodings for each fixed episema mask across four pitch
patterns (864 configurations). This checks the encoding, not perceptual
readability, leader collisions, all possible pitches or production layout.

All six SVGs were actually rendered in disposable Chromium: 40 panels per full
sheet, eight in the focused comparison, with no horizontal document overflow at
intrinsic width. SVG `getBBox()` measurements support the sample spacing figures
above; they exclude stroke thickness. The full-sheet and focused screenshots
were inspected by the implementation agent. This is static visual review,
not new editor/browser-interaction or screen-reader acceptance.

The retained [sample measurements](measurements.json) record extra right/bottom
ink relative to current geometry, not the required advance or system-height
increase. Staff/lyric padding already occupies some of that space; a future
layout implementation must determine the actual reservation. The two unchanged
production layout suites passed again (30 tests); formatting and diff checks
also pass. Application builds and interaction suites were not rerun because
this change consists only of review material and its standalone generator.

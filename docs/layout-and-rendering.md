# Layout and rendering

## Scope

This document is authoritative for derived score layout, engraving geometry,
automatic wrapping, lyric placement, SVG rendering, and layout accessibility.

## Related documents

- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Editor interactions](editor-interactions.md)
- [Testing](testing.md)
- [Glossary](glossary.md)
- [Project drawing metrics](engraving-metrics.md)
- [Shared geometry decision](adrs/0007-share-derived-neume-engraving-geometry.md)
- [Accepted combined wrapping decision](adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md)
- [Superseded music-only wrapping decision](adrs/0005-derive-wrapping-from-rendered-geometry.md)
- [Roadmap and limitations](roadmap.md)

## Staff, system, and score

A [staff](glossary.md#staff) is one four-line writing area. A
[system](glossary.md#system) contains a repeated staff, effective opening C/F clef, an ordered
partition of mixed semantic events, and the lyrics owned by that partition. The
[score](glossary.md#score) contains one or more vertically arranged systems.
Even an empty document produces one empty system.

`layoutChant` converts `ChantDocument` to `ChantLayout`:

- score `title`, derived canvas `x`, `y`, `width`, and `height`;
- ordered `systems`;
- each system's index, bounds, staff lines, opening clef, authored clefs, divisions,
  custodes, insertion slots, neumes, lyrics, and
  `startNeumeIndex`.

`startNeumeIndex` is the global semantic index of the first neume assigned to a
system. Interaction resolvers add it to a boundary within that system to recover
a global document boundary.

## Coordinate convention and SVG size

Current child geometry is score-absolute. Staff lines, clefs, noteheads,
connectors, raw bounds, lyrics, and previews already include the vertical
offset of their owning system. `ScoreSvg` can render them directly; its system
groups are organizational and have no translation transform.

This describes the present layout contract, not an eternal ban on a future
system-local coordinate design.

Normal scores retain a 720-unit canvas at x = 0 and responsive SVG scaling.
Height grows with system count and exceptional guide ink; a negative canvas Y
origin can include high custodes without moving systems. Stage 4B's combined music-and-lyric layout
follows [accepted ADR 0010](adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md),
which supersedes the music-only wrapping rule in ADR 0005.
For exceptional unbreakable lyrics, see the overflow policy below. Logical
system placement always retains its normal bounds, independently of canvas size.

Every system repeats the four staff lines and its effective incoming C/F clef
(or a first authored leading clef), positioned on its semantic clef line. Their y coordinates advance by the system offset.

Graphical placement previews contain an ID-free local ghost and a caret on
committed systems. They do not assemble hypothetical systems or lyrics, or
change score dimensions. Shared engraving builders still determine the actual
neume shape; [editor interactions](editor-interactions.md#caret-and-cursor-ghost)
owns caret boundary, local pitch, clamping and remote-target feedback rules.

## Neume geometry

`buildNeumeGeometry` in `src/editor/layout/neume-geometry.ts` is the pure,
ID-free source for note selection contours, engraved ink components,
painted bounds, nominal note anchors, interaction bounds, musical `lyricAnchorX`,
and horizontal `advanceX`. Rectangles and short paths carry explicit bounds;
there is no DOM measurement, notation font, glyph framework, or semantic format
change. See [drawing metrics](engraving-metrics.md) for the exact project
recipes, their reference basis, and large-interval extrapolations.

The public `neume-geometry.ts` entry point dispatches to focused recipes in
`layout/neumes/`: Punctum, the shared Podatus/Clivis construction,
Scandicus/Torculus with their fitted compound edges, Climacus, and Porrectus.
`neumes/shared.ts` owns geometry types, absolute-coordinate construction,
note padding, exposed crown/underside contours, first-head half-widths,
painted-bound union and advance calculation. Scandicus uses the unchanged
Punctum ink and selection head when its first interval is one staff step;
only the (1,1) construction also reuses Podatus for its upper pair. For wider
first intervals, its recipe replaces the initial Punctum head with a fitted
ascending attachment and traces the joined silhouette. Climacus reuses
Punctum's selection head.
Recipe modules do not depend on the public dispatcher. These boundaries
implement ADR 0007 without changing its shared geometry contract.

Punctum, ordinary Podatus, Clivis, Scandicus, Torculus, Climacus, and Porrectus use the approved
square-notation constructions. Intended joined components render as traced
filled contours, without internal antialiased boundaries. A semantically unified
neume may have disconnected ink: Scandicus with adjacent first interval keeps
its conventional first Punctum separate from the upper pair, including the
explicit Punctum + Pes construction at (1,1). No artificial connector is added.
Per-note head shapes exist for selection feedback; they do not separately paint
the normal silhouette. Climacus has a Virga followed by two separate descending
inclinata. Porrectus has one descending ribbon and fitted ascending terminal;
its first two notes select regions of that shared ribbon, not artificial heads.

A note's `anchorX` and `anchorY` represent its nominal musical position; its
`x`, `y`, `width`, and `height` enclose its selection contour. This may be a
head or a region of shared ribbon ink. These need not have the
same center, especially for an optically lifted adjacent Pes upper head.
`hitBounds` encloses independent padded interaction geometry. Optional
`hitShape?: InkShape` supplies a polygonal pointer/focus target for Climacus;
absence retains the rectangular target. Shared ink parts have
no semantic IDs. Only committed `NoteLayout` and `NeumeLayout` attach existing
note and neume IDs.

Complete painted `bounds` support measurement, insertion midpoints, and
whole-neume outlines. They exclude interaction padding and selection styling.
Musical lyric anchors are explicit and never recomputed from the union of all
ink. `advanceX` is the distance from one glyph's left ink edge to the following
left ink edge: complete painted width plus the existing 33-unit edge gap.
Each system's first nominal pitch anchor starts at x = 150; measured left
bearings can increase it. All seven kinds use a six-unit first bearing with
the same minimum ink-gap rule.

## Automatic whole-neume wrapping

`placeNeumeSequence` processes semantic neumes in order and measures each
complete raw rendered extent and measured lyric advance at its proposed horizontal position. A candidate that exceeds
the usable right boundary starts the next system when the current system
already has content.

The algorithm:

- preserves semantic order;
- keeps an exact fit on the current system;
- never exposes or splits a boundary inside a neume;
- derives system membership instead of storing it in `ChantDocument`;
- preserves semantic neume and note IDs across reflow.

Wrapping uses rendered geometry rather than semantic note count. Compact
Scandicus, Torculus, Climacus, and Porrectus geometry and three separately
spaced Puncta do not consume the same horizontal width, even though each
contains three notes.

If one unexpectedly wide neume cannot fit on an otherwise empty system, it is
placed there once and that system is finalized. The input index advances, so
layout always makes progress and does not create a permanent empty trailing
system.

Changing an individual pitch can switch between adjacent and wider Clivis
construction, changing width and system membership. Whole-neume transposition
retains interval widths. Insertion, deletion, normalization, and interval edits
can reflow later entities while preserving semantic IDs and pending focus.
`wrapNeumes` and `getNeumeBoundaryCenterX` are explicitly music-only helpers.
`layoutChant(document, measurementSnapshot)` is authoritative for displayed
scores and interaction resolution. They share the same placement walker,
including exact-fit and oversized progress rules. Hover does not run a wrapping pass.

### Lyric clearances and oversized canvas (Stage 4B)

One placement walk preserves each neume's musical minimum advance, then increases
only the incoming anchored neume's position as required by the previous lyric's
right occupied edge (the union of text advance and painted glyph bounds).
Same-word syllables may abut; distinct words receive a
5-unit (quarter-em at the matching 20-unit font) deterministic minimum gap.
Unanchored melismatic neumes keep their musical advances. Each candidate tests
both musical ink and lyric right bounds; a new system resets lyric clearance
and accommodates the first lyric's left bearing at the staff start. A candidate
fits on equality. Internal neume geometry and lyric-to-musical alignment never change.

All syllables must have valid, positive measurements before lyrics influence
placement. A missing, zero, malformed or partial snapshot keeps provisional
music-only spacing and a 720-unit canvas; the browser remeasures after fonts
become ready. Measurements never enter semantic state or history.

If the first anchored unit cannot fit even after accommodating its left bearing,
retain its normal musical anchor, place it once alone, and advance to the next
normal-width system. Its text is neither split nor scaled. The derived canvas
contains all measured lyric edges with 12 units of padding, extending the normal
[0, 720] interval as necessary, including a negative `ChantLayout.x`. The SVG
uses that origin and width, at one CSS pixel per layout unit for this exceptional
canvas. A named, focusable local score viewport provides native horizontal
scrolling, including arrow-key scrolling; controls remain outside it. Ordinary
scores keep responsive scaling. Canvas width never expands wrapping bounds.
The floating lyric form remains within the workspace, with exceptional vertical
positions in CSS pixels to match the unscaled SVG.

Pointer conversion uses the inverse screen CTM, including scrolling and negative
origins. Focus reveal visits local scroll containers before the page. Reparented
note/lyric controls restore browser focus by ID after measurement reflow without
changing semantic selection or stealing focus from editor controls.

### Stage 4C word composition

[Accepted ADR 0011](adrs/0011-word-aware-chant-engraving.md) specifies the
contextual same-word compaction and derived hyphenation implemented on
[PR #45](https://github.com/OceanOSdev/gregorian-chant-editor/pull/45).
The owner approved the current visual policy on 2026-11-02; PR #45 remains
subject to normal merge checks. [ADR 0010](adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md)
remains Accepted and its Stage 4B rules are the conservative baseline.

With a complete valid font snapshot (including the hyphen), consecutive neumes
starting consecutive syllables of the same semantic word may use a **2-unit ink
gap**. Actual occupied lyric edges then increase the incoming position as needed.
There is a 0.05-em (1-unit) same-word clearance for responsive SVG hinting, in
addition to the measurer's guarded ink bounds. Different-word boundaries retain
the ordinary music minimum and quarter-em lyric gap. Unanchored melismas,
lyricless music, neume contours, pitches and musical/vowel anchors are unchanged.

Compact neighbors receive derived horizontal `hitClip` ownership intervals split
at their ink-gap midpoint. SVG clips padded note targets, lyric-move
destination targets, and whole-neume selection/placement/move rectangle
decorations (including their strokes) to these intervals. Captions are not clipped. Every ink edge remains inside its owner's
interval; existing internal rectangular/polygonal note partitions are preserved.
At the exact shared split line, SVG paint order gives a hit to the following
target when both contain that point. Selection and focus are independent
controls as before; decoration does not own pointer events. No target is transferred to the neighboring neume.

A same-word occupied-edge gap of at most **0.1 em** (2 units at the current font)
is treated as joined. This is tighter than the quarter-em minimum real-word
space: an unmarked continuing syllable must not look separated by a word space.
Occupied edges include the measured advance/ink union and its precision guard.
Larger unavoidable gaps receive one measured hyphen, centered between the lyrics
with at least 0.1 em on each side. A mark only reserves missing clearance after
safe musical placement; no word-specific coordinate or syllable-count rule is
used. Font substitution may change the join decision.

The initial PR #45 iteration used 0.4 em, which exceeded the minimum word gap;
corpus measurements exposed unmarked word-space-sized continuations. The revised
policy intentionally hyphenates those cases, including short adjacent vowels
whose anchors cannot safely come closer. A wide neume may prevent joining; text
never moves independently of its musical anchor. There is no kerning across
separate lyric controls and no promise that every word will join. The
[corpus review](verification/word-composition/corpus-review.md) records both the
relative invariant checks and visual evidence; images are not test goldens.

Placement is a bounded forward walk: build at the contextual musical minimum,
decide separation once from measured edges, then add only missing clearance for
a required mark. There is no iterative reclassification or renderer translation.
While a syllable on the current system has a semantic next syllable continuing
its word, each candidate reserves the measured hyphen width plus two 0.1-em
margins after the maximum occupied music/lyric edge. The reservation is replaced
when the next syllable is accepted. This conservative reservation can wrap a
neume earlier than a lookahead optimizer would. Each candidate has a bounded current/fresh-system fit, with at most one
additional translation of a first source unit into available left room to fit
its outgoing reservation. Music and lyric move together; the musical/vowel
anchor relationship does not change. If the combined unit cannot fit, it is
isolated under the oversized progress policy, with its complete mark visible.
Oversized items still advance once.

After system assignment, consecutive same-word syllables on different systems
produce one outgoing mark on the **source lyric's system**, after its music and
lyric right edges. A melisma can cross intermediate systems without repeated
marks; only the genuine later syllable creates continuation. No incoming mark or
true-word-end mark is generated. The original unbreakable oversized policy also
exposes any outgoing mark through canvas expansion; normal wrapping stays at
656 on the 720-unit logical canvas. Hyphens have measured occupied extents,
`text-anchor="middle"`, and their own pointer-inert, aria-hidden layer. They
never enter lyric text, accessible labels, document identity or history.

Missing/invalid/partial syllable or punctuation measurements disable composition,
reservations and marks together, retaining music-only placement until remeasurement.
Committed rendering and interaction still consume the same measured layout.

## Committed layout and previews

`graphical-placement.ts` owns graphical fit, staff snapping, preferred neume
indices and ghost/caret layout against the committed snapshot. The existing
`layout-chant.ts` public API re-exports those functions and placement types.
Both modules consume shared staff metrics from `staff-metrics.ts`; placement
uses type-only imports for committed layout records. The combined music/lyric
wrapping walker remains in `layout-chant.ts`, and division-aware semantic slot
resolution remains in the interaction layer.

Committed layout copies semantic neume and note IDs into `NeumeLayout` and
`NoteLayout`. Rendering uses those IDs for React keys, selection, focus, and
data attributes. Coordinates remain derived and carry no authority back into
the semantic document.

Graphical previews reuse complete ID-free `NeumeGeometry` for a ghost on the
hovered staff, alongside caret coordinates for the semantic insertion
index. They share shape, snapped pitch and ink rendering with committed notation;
final spacing and system assignment are derived only after insertion. `ScoreSvg`
renders committed systems directly throughout hover, without hiding/replacing
ink or expanding its viewBox. The preview overlay contains no semantic IDs or
interactive controls. See [editor interactions](editor-interactions.md#graphical-placement-and-preview)
for input and lifecycle rules.

## Lyrics

Lyric syllables carry stable `startsAtNeumeId` anchors. Layout resolves each
anchor directly to its committed neume and emits one lyric on that system.
Later neumes in the span never repeat the text, including across system breaks.
Measured lyric advances and glyph bounds participate in the same placement and wrapping walk as music.

Current horizontal alignment rules are:

- Punctum: center of its sole note;
- Podatus: center of its first, lower note;
- Clivis: midpoint of its two nominal head centers (the conventional body span),
  independent of stem/contour overhangs or other ink bounds;
- Scandicus: center of its first, lowest note.
- Torculus, Climacus, and Porrectus: center of their first note.

Valid semantic documents contain only anchored, nonblank syllables in anchor
order. Layout preserves that order. Word boundaries are semantic metadata;
generated hyphens are derived decorations under the Stage 4C branch policy.

`ScoreSvg` renders each entire string with `textAnchor="middle"` at the
measured text midpoint supplied by layout. Stage 4A shifts that midpoint to
align the chosen vowel/segment to the musical anchor; see the measurement
contract below. Each lyric also exposes measured `left`/`right` occupied edges
(or null when unavailable), `boundaryBefore`, and `anchorX`; the enclosing system
provides its boundary; hyphens follow the Stage 4C branch policy.

## Rendering and accessibility

`ScoreSvg` renders each system's staff, clef, notation, and lyrics. It keeps
neume/division paint ordering and ID-based focus restoration; `DivisionControl`
owns each committed division's SVG control, accessible label, and event handlers.
`NeumeInk` displays the same supplied ink for committed notation and previews;
preview opacity changes presentation only. Intended joined ink is painted as a
continuous filled contour; conventional disconnected components remain separate.
Individual note selection adds a stroke-only contour overlay, including ribbon
regions for Porrectus.
A selected whole neume
receives an outline expanded from its raw bounds.

Notes are SVG groups with button roles, accessible names describing their
position within a neume, pressed state for individual selection, and shared
whole-neume keyboard instructions. During placement mode they are removed from
the tab order and pointer interaction and are marked disabled. Stacked Pes hit
padding is partitioned at the nominal inter-pitch y midpoint; adjacent Clivis
padding is partitioned at the shared x edge. Visible heads remain independently
clickable. At an exact shared boundary, the later semantic note's control owns
the boundary through SVG paint order. Focus feedback styles the actual target (polygonal when `hitShape` is supplied,
rectangular otherwise);
whole-neume feedback uses complete painted bounds. Scandicus partitions adjacent
first-note padding at the upper column's left edge and the upper pair at its
nominal y midpoint. Torculus partitions adjacent padding at shared x edges.
Wider intervals retain full horizontal padding to preserve visible head interiors;
these existing controls retain their rectangular targets.

Climacus partitions padded diamond targets with an oblique half-plane so that
visible tips remain owned by the correct semantic note. Porrectus partitions at
the right terminal column and the midpoint of its second/third nominal pitches;
its first target has fixed top y=−14 relative to the first pitch. New Climacus
and Porrectus targets explicitly use `pointer-events: fill`, preventing focus
strokes from enlarging ownership. During placement, target descendants also
receive `pointer-events: none` so explicit fill ownership cannot override the
disabled parent. Target shapes are aria-hidden, nonfocusable children of the
existing named note controls. Selection overlays remain hidden and pointer-free.
No separate rectangular focus outline is rendered for a path target. See
[drawing metrics](engraving-metrics.md) for exact ownership recipes.

The SVG has a title and generated description. The description totals systems,
neumes, notes, and rendered lyric syllables across the complete multi-system
layout. During placement, the root instead exposes the concise placement
name/description specified in [editor interactions](editor-interactions.md#focus).
Its local placement-context cue uses derived neume bounds without altering ink,
advance, or wrapping. Preview geometry and purely visual connectors, repeated clefs, hit targets, and
selection outlines are hidden from accessibility APIs where appropriate.

Pure helpers test the accessible strings. Actual browser focus, event
propagation, and visual behavior still require the manual checks described in
the [testing guide](testing.md).

Lyric selection uses a pale purple, stroke-free SVG rectangle behind the text,
inset two layout units from its measured occupied horizontal bounds (clamped
for very narrow text). It has no outward CSS outline and cannot add a vertical
border through an adjoining syllable. The background is pointer-inert and
aria-hidden; the text remains the sole focusable lyric control and retains its
ordinary ink and accessible pressed state. Until measurements arrive, the
selection summary and pressed state still identify selection without guessed
highlight width. Neume selection keeps its existing dashed outline.

A separate blue caret and “Keyboard focus” caption identify the focused lyric,
independently of selection. Both cues leave musical geometry, lyric spacing,
wrapping and semantic history unchanged. No decorative clearance is reserved.

During lyric reassignment, each neume has a nonfocusable pointer rectangle with
the same rounded bounds and stroke extent as its seven-unit padded outline.
That rectangle owns all pointer input for its neume; constituent note targets
are pointer-inert until reassignment ends, while retaining keyboard focus.
The 33-unit inter-neume ink gap leaves these padded regions disjoint, including
stroke extents. Invalid/occupied regions use the same pointer routing but never
commit. Decorative captions remain pointer-inert. This changes neither normal
note hit geometry nor musical bounds, spacing or wrapping.

## Stage 4A measured vowel alignment

The document's explicit language selects conservative automatic rules in
`domain/lyric-alignment.ts`. Latin accepts one vowel (including y/æ/œ), or a
single ae/au/oe group, and excludes u after q. Greek accepts a single Greek
vowel or recognized pair after decomposing accents. English supports only a
single a/e/i/o/u enclosed by consonants; ambiguous spellings such as `read` or
`fire` center the whole syllable. Unspecified, incompatible scripts, punctuation,
and unrecognized/multiple nuclei also center the whole syllable. These are
spelling heuristics, not pronunciation inference or general syllabification.
Manual grapheme ranges always take precedence.

`layoutChant` optionally consumes a pure text-measurement callback with total
advance width, advance positions at grapheme boundaries, and optional painted
`inkBounds` relative to the advance start. It returns the
chosen segment, measurement status, width, offset and original musical anchor
with each lyric. The positioned x remains the whole text's midpoint, shifted
so the segment's advance center coincides with the existing `lyricAnchorX`.
Missing/nonfinite/inconsistent metrics deterministically retain whole-string
centering. Alignment uses typographic advances, not optical ink centroids.

The browser adapter measures hidden SVG text in an effect with the same
20-unit Georgia / Times New Roman / serif stack as visible lyrics. Measured text,
visible syllables and hyphens all use SVG `text-rendering="geometricPrecision"`.
This avoids Firefox's scale-dependent hinted ink boxes diverging from the hidden
measurements at narrow responsive sizes; no viewport-dependent spacing or
resize-driven layout cycle is introduced. It waits
for `document.fonts.ready` and refreshes after font loading, caching repeated
texts per measurement pass. Unicode grapheme indexes are converted to UTF-16
SVG substring lengths only in that adapter. Platform font substitution can
change measured geometry. `getBBox()` supplies glyph bounds, including serif
and italic overhangs outside typographic advances. The browser adapter encloses
these bounds with a half-layout-unit guard for scale-dependent SVG font hinting;
this precision allowance is much smaller than the word gap. The same union of
advance and guarded ink bounds drives adjacent clearance, system fit, first
left bearings and exceptional canvas expansion. Vowel/segment alignment still
uses only advances; it does not move toward an optical ink centroid. Pure
measurement providers omitting `inkBounds` retain advance-only extents.
Rendering keeps one interactive text control per
syllable, with unchanged baseline, accessible name and ID-based interaction.

Stage 4B extends the Stage 4A measurements into combined placement as described
above. The Stage 4C branch experiment derives conditional and outgoing hyphens
when safe musical geometry leaves continuing syllables visibly separated.

## Stage 5B divisions and score slots

Divisions are non-pitched layout items. `division-geometry.ts` builds thin bars
from staff lines: minima straddles the top line by half a space on each side;
minor spans the central two spaces; maior spans all four lines; finalis has two
full-height strokes six units apart. Strokes are 1.5 units wide. Occupied widths
are 1.5/7.5 units, with 16 units of clearance before and between divisions and
ordinary musical clearance after the last division. Padded targets remain
separate from musical ink and adjacent targets. Finalis is legal in mid-score.
These are provisional modern-square proportions, not publication-quality glyphs.
The [Gregorio separation-bar reference](https://gregorio-project.github.io/gabc/#separation-bars)
and [worked score tutorial](https://gregorio-project.github.io/tutorial/tutorial-gabc-01.html)
inform the forms, without adding rhythmic interpretation.

The same measured walker reserves each neume's following division run before
wrapping. A normally fitting phrase ending moves its neume and bars together;
maior/finalis never force a break. Authored leading bars and division-only scores
are legal. An unusually long division run that cannot fit with a neume on an
empty normal system splits with bounded progress; its remaining bars can begin
subsequent systems. This exceptional punctuation arrangement has no manual-break
or semantic significance. Division positions and reservations clear both the
preceding neume's ink and its active syllable's measured right edge, including
within a melisma. Incoming anchored lyrics clear the preceding division's right
edge as well as earlier lyric edges, for both word and continuation boundaries.
These constraints participate in the same candidate build and wrapping decision.
A source unit may use available left room to fit its complete lyric/bar reservation.

For a genuinely oversized measured syllable, the isolated source unit retains its
following bars after the text. Its derived visual staff and exceptional canvas
extend far enough to expose those bars and their insertion slots. The logical
normal wrapping width remains 656: later neumes still start fresh normal systems
rather than filling the exceptionally long visual staff. No semantic anchor or
post-render translation changes. Empty music still has a deterministic system
and slot.

Each system exposes stable-ID divisions and explicit slots in semantic score
order, including before/between/after adjacent bars. Slot x coordinates come from
occupied neighboring bounds and remain within the staff placement region.
Carets beside divisions sit eight units from the bar ink. Pointer intervals
split at item midpoints, independently of caret distance; a long lyric-induced
gap cannot make a point immediately left of a bar choose its after slot.
Pointer intent chooses a displayed slot; the caret and commit carry that exact
`ScoreInsertionBoundary`. Existing numeric indexes remain compatibility data for
neume-only helpers, not the runtime choice of a division side. Previews are local
and inert, and do not reflow committed music. The reducer rederives current slots
for rapid clicks with the immutable displayed font measurement snapshot.

Under [Accepted ADR 0013](adrs/0013-divisions-interrupt-word-compaction.md), an
intervening division blocks same-word anchor compaction. Semantic word boundaries,
text and anchors never change. Divisions within one syllable's melisma introduce
no syllable or hyphen. Between continuing syllables, the existing measured
joining threshold still decides whether a hyphen is needed; punctuation alone
does not force it. Same-system marks use measured free space after intervening
bars; outgoing marks reserve room after occupied music, lyrics and divisions.
True word boundaries still receive clearance without continuation marks.

## Initial clef engraving (Stage 6A)

`buildClefGeometry` derives a shared curved C/do body and an F/fa-specific attachment, exact occupied bounds
and separately padded hit bounds, scaled from `staffStep`. Both C/do and F/fa
support lines 1–4. The y anchor is the reference line; automatic repetitions use
the effective incoming value, including the empty-score initial clef. Geometry contains no
semantic IDs or DOM/font dependencies. The first copy uses `ClefControl`;
decorative subsequent copies are aria-hidden, pointer-inert paths. The score summary names
the initial type/line and the authored clef-change sequence. See [drawing metrics](engraving-metrics.md#clefs-stage-6a)
for the contours and reference sources.

Clefs occupy the existing leading region at x=100, separated from the normal
first-neume anchor at x=150. Leftward fitting of a first source unit for an
outgoing lyric/bar reservation retains the ordinary 33-unit musical clearance
from the larger clef right extent. The ordinary leading ink gap is 38.6 units
for C and 36.2 for F. Reclaiming the previous oversized gap changes available
system capacity; normal inter-neume minima and lyric composition rules are unchanged.
Melody-preserving edits change note heights before layout.
The existing fixed vertical system spacing and absent neume ledger lines still limit
extreme pitches; this stage adds no vertical collision or pagination engine.

## Measured clef events and custodes (Stage 6B)

The existing `placeNeumeSequence` walker consumes mixed boundary events from
`deriveScoreOrder`, carrying the effective clef through semantic placement.
`ClefChangeLayout` retains the authored ID; `leadingClefChangeId` identifies a
continuation system whose first semantic item supplies its leading clef at x=100.
Only that first authored clef substitutes for the decorative repetition; every
subsequent change remains visible. A leading division keeps the incoming
repetition and its own place before later clefs. The first system always retains
the required initial clef.

The walker measures approved C/F geometry and pure `custos-geometry.ts` paths,
reserves their widths before wrapping, and uses their bounds for incoming lyric,
outgoing hyphen and insertion-slot clearance. Divisions preceding a clef can stay
on the preceding system when they fit. Mixed oversized runs split after bounded
progress without dropping events. Custodes may expose exceptional canvas overflow
with an oversized source unit, following existing scrolling policy.

A mid-staff guide anticipates the next committed note under the outgoing clef;
a system-end guide uses that system's effective outgoing clef, even across an
authored opening change. Pitch follows ADR 0015's offset formula. No-note tails,
redundant offsets and per-unused-clef guide duplication are suppressed. A break
replaces any mid-staff guide for the same pending note with one outgoing guide.
Guide geometry is noninteractive and never semantic/history data.

The guide's small rising head and shaft were inspected against the introductory
[Liber Usualis p. xviii](https://gregobase.selapa.net/sources/3/17.png).
This supports its appearance and anticipatory meaning, not the editor's particular
wrapping policy or universal historical proportions. Approved C/F contours are
unchanged. Clefs do not categorically block same-word compaction: measured event
ink supplies clearance, while ADR 0013 remains the division-only exception.
Lyrics, word boundaries and hyphen rules retain their existing semantics.

Oversized staff extension includes division, authored-clef and custos bounds;
the exceptional canvas includes the full extended staff. The same extended
region is used for pointer hit testing, keeping slots beyond normal x=656 reachable.
Caret positions keep their four-unit caps plus clearance outside custos bounds,
without changing the semantic slot or its pointer interval.

If a boundary run wraps before a division, its outgoing guide already anticipates
the pending next note; a later clef on the new staff does not add a second guide.
When a mid-staff guide is replaced at a later break, the walker rebuilds following
boundary glyphs without its reserved advance before finalizing that system.
This reclaims spacing within authoritative measured layout; no renderer-side
translation or new placement engine is involved.

## Graphical clef preview and edit overlay

`interaction/resolve-graphical-clef-placement.ts` shares measured `ScoreSlotLayout`
geometry and approved `buildClefGeometry` paths between hover and click. It snaps
only inside the existing staff hit band, uses the selected slot's caret, and
keeps the full ghost inside normal or extended staff bounds. The pointer does
not manufacture a semantic index or prospective score. Keyboard placement looks
up the same stable boundary in the current layout and prefers its continuation
copy at a shared system edge.

Safe existing-clef draft overlays are also pure geometry from that module. They
use the committed glyph's x anchor and draft reference line, and are omitted if
they would overlap other committed music/guide ink or leave the staff. They do
not alter canonical layout, hit identities, interpreted pitches or derived
custodes until Apply. Both placement and edit overlays are aria-hidden and
pointer-inert. Approved C/F contours and measured wrapping are unchanged.

## Ledger lines for custodes

Custodes alone have derived ledger runs: the four staff lines are at positions
0/2/4/6; adjacent outside spaces -1/7 need none; more distant guides acquire
short rules at -2/-4/… or 8/10/… through their last required line. Rules share
the guide's horizontal allocation and staff lattice without moving its pitch.
They are rendered behind the unchanged glyph, pointer-inert and nonsemantic.
The compact regular run avoids enumerating an unbounded number of ledger nodes.

Guide bounds and measured reservation include rule thickness and overhang.
Outgoing reservation and reclaimed mid-staff guide spacing use the actual width;
ledger-free guides retain their previous reservation. Existing staff extension,
lyric/hyphen/caret clearance and horizontal canvas logic consume those bounds.
The canvas also includes guide ink above/below its normal extent using a derived
Y origin, without moving staff/system coordinates or adding a vertical collision
engine. Neume ledger lines remain absent. See the [Gregorio comparison and
verification](verification/mid-score-clefs/custos-ledgers.md) for source, dimensions,
actual examples and remaining silhouette differences.

## Rhythmic sign geometry (Stage 8A)

`buildNeumeGeometry` consumes note modifiers after constructing the approved
unmodified glyph. `note-modifiers.ts` derives independent episemata and
conventional single/paired mora signs without changing heads or lyric anchors.
The collision search reserves episema ink before resolving mora columns.
All signs participate in ink bounds, advances, wrapping and per-note focus/reveal
bounds. Final-pair dots are resolved together, retaining each affected note's
bounds; never infer a two-dot count on one note. Contextual line/space and
Clivis first-single rules are specified in [engraving metrics](engraving-metrics.md).
See [ADR 0018](adrs/0018-conventional-mora-patterns.md).

Unmodified geometry remains unchanged. New-neume previews have unmarked notes
and use the same builder; slot reservations consume complete committed sign
bounds. Both rhythmic signs remain inert ink with stable note targets; neume
outlines include all signs. Episemata remain separate when joining would be
ambiguous, with no across-neume bridge. The canvas includes complete vertical
ink, but fixed system/lyric spacing and absent neume ledger lines remain
limitations: extreme pitches can still overlap lyrics or another system. No
vertical collision engine is added.

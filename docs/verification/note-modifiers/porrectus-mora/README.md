# Porrectus mora investigation — decision required

PR #64 follow-up, 2026-11-09. Research and baseline captures only: **no engraving,
semantic, native-format or test-contract change has been made**. The owner's
instruction requires reporting unconventional notation or different semantic
interpretations before implementing a speculative design.

## What the references establish

The [1961 Solesmes Liber Usualis, p. xxiv](https://gregobase.selapa.net/sources/3/23.png)
identifies the first two Porrectus notes with the two extremities of the oblique
stroke. They are not separate square heads along that stroke. Its
[following page](https://gregobase.selapa.net/sources/3/24.png) discusses phrase
endings with one or two lengthened notes and the possible use of two dots.
These pages establish ribbon reading and the ordinary cadential context; they
**do not establish a conventional arrangement of three independently dotted
Porrectus constituents**. The printed source in
[Gregorio's Exaudivit tutorial](https://gregorio-project.github.io/tutorial/Exaudivit-00.png)
also shows ribbon Porrectus forms and paired cadential dots, but is not a
three-dot Porrectus precedent. No such printed precedent was established in
this investigation. That is an evidential limit, not proof that none exists.

The primary implementation is more specific:

- [Pinned Gregorio writer](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/src/gregoriotex/gregoriotex-write.c#L2001),
  `write_punctum_mora`, treats dots earlier than the last two notes as unusual.
  For ordinary Porrectus it emits signs after the complete glyph; it does not
  move the first sign beside the left ribbon endpoint. Earlier dots take zero
  width when another follows, sharing the subsequent sign's horizontal position.
- The same function selects special vertical placement for the second note
  when the final ascent is one staff step. This distinguishes the low ribbon
  endpoint from the upper terminal without scattering signs along the ribbon.
- [GregorioTeX sign macros](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/tex/gregoriotex-signs.tex),
  `gre@punctum@mora`, implement that trailing placement and zero-width behavior.
- `write_auctum_duplex` explicitly interprets the conventional double sign on
  a compound glyph as dots corresponding to its last and preceding notes.
  This is **not** the same contract as our accepted note-level `mora: 2`.
  It is a comparison warning, not a proposal to change ADR 0017 or saved data.

The retrieved writer's SHA-256 is
`392a6b00e54721b995e7e72b47a4873b7d59634a48fcc7770b7efae931cd657f`.
This is the same source pin used by the approved Porrectus silhouette research.

## Actual typesetting experiment

[Reference sheet](gregorio-probes.png), generated with installed Gregorio 6.0.0,
GregorioTeX 6.0.0 and Greciliae using the retained [GABC](cases.gabc) and
[TeX wrapper](comparison.tex). This is actual synthetic Gregorio output, **not**
a traditional printed score or proof of conventional usage. The pinned source
above was inspected separately; this is not a claim that its revision produced
the installed binary.

Each row compares Plain / First / Second / Third / All / Pair / Double:

| Row | Pitches | All-three input | Last-two input | Double input |
| --- | ------- | --------------- | -------------- | ------------ |
| 1   | `h f h` | `h.f.h.`        | `hf.h.`        | `hfh..`      |
| 2   | `g d f` | `g.d.f.`        | `gd.f.`        | `gdf..`      |
| 3   | `i h i` | `i.h.i.`        | `ih.i.`        | `ihi..`      |

With equal outer pitches (rows 1 and 3), First and Third use the same
pitch-related trailing position. In the final, unjustified row, All overlays
their coincident dots; justification can separate the earlier and final dots
horizontally because their spacing uses fixed kern versus stretchable glue.
With unequal outer pitches (row 2), All produces three vertically separated
trailing dots. Pair and Double
produce the same two-note arrangement. Generated output contains three
`GrePunctumMora` calls for All, with width modes 1/1/0: overlapping signs in the
equal-pitch case are not a parser dropping a note.

These observations contradict the premise that moving all three dots toward
individual ribbon regions would reproduce Gregorio's conventional arrangement.
A clearer three-way association would need an explicitly chosen project rule.

## Comparison with our current geometry

[Current production editor](editor-before-chromium.png) and its importable
[v2 specimen](editor-cases.chant.json) cover the same three pitch patterns
(project staff positions `[4,2,4]`, `[3,0,4]`, `[5,4,5]`), each with First /
Second / Third / All. Four consecutive neumes belong to each pattern, irrespective
of automatic wrapping. The fixture is captured before any proposed refinement.

`note-modifiers.ts` checks the entire connected Porrectus's occupied rectangle.
A space-level candidate beside the initial anchor intersects that rectangle,
so it moves to the right edge. A line-level candidate above the glyph can stay
near the first anchor. Thus the common column is partly a conservative-box
artifact, but trailing dots are also an intentional Gregorio convention. Our
collision checks keep equal-pitch dots distinct by finding additional space;
they do not reproduce Gregorio's overlapping-dot fallback.

The approved silhouette, semantic pitches/IDs, anchors and shared geometry have
not been altered. No after screenshot or new preferred-placement assertions
are supplied because a replacement policy has not been approved.

## Alternatives for owner decision

1. **Keep the conventional trailing arrangement.** Consider a narrow follow-up
   for the second note's line/space displacement and compact trailing clearance.
   Treat arbitrary three-note dotting as an uncommon project capability, without
   claiming unique visual association where outer pitches coincide.
2. **Approve an explicit project engraving extension.** Preserve the current
   per-note semantics and silhouette, but choose contour-aware local candidates
   for the first ribbon endpoint and distinct low/terminal signs. This may improve
   clarity, but must be labeled a project rule rather than a verified traditional
   three-dot convention. Only then implement and test interval/double/episema cases.
3. **Review conventional representation more broadly.** Consider disjoined forms
   or note-pair double-sign semantics. This exceeds the requested placement-only
   refinement and conflicts with preserving the approved silhouette or current
   per-note `mora: 2` contract; it requires an explicit design/ADR review first.

Do not silently adopt option 2 or 3 in response to a request for conventional
placement. The investigation stops here pending the owner's choice.

## Reproduction and checks

With a matching Gregorio/TeX installation, in this directory:

```bash
gregorio -o cases.gtex cases.gabc
lualatex -interaction=nonstopmode -halt-on-error comparison.tex
lualatex -interaction=nonstopmode -halt-on-error comparison.tex
pdftoppm -scale-to 1800 -x 0 -y 0 -W 1800 -H 600 -png -singlefile comparison.pdf gregorio-probes
```

For the editor, build and start the production repo-subpath preview, then import
`editor-cases.chant.json` in a disposable profile. Current captures were taken
at 1440px and 320px in Chromium; the retained image is desktop. The GABC
pair/double probes are comparisons of Gregorio syntax, not import/export mappings.

Actual local checks: production build passes; the three modifier command/layout/
persistence suites pass (36 tests). No new engraving tests were added pending
policy selection. The existing Stage 8A production browser regression driver
passed again in Chromium and Firefox, including desktop/320px selection stability,
all-kind modifier controls, history, native keyboard interaction and v1/v2 recovery.
Diagnostics: Chromium `/tmp/chant-note-modifiers-7CwJXX`; Firefox
`/tmp/chant-note-modifiers-ylrM9U`. Current-renderer fixture captures are in
`/tmp/chant-note-modifiers-lkmxji`. Formatting and diff checks also pass. These checks
verify the unchanged baseline, not the requested refinement or conventionality.

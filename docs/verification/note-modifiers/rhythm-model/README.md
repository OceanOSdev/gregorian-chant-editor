# Rhythmic-model evidence — proposal only

The owner rejected the ownership glyphs/indexes/strings in the earlier review.
The [new model proposal](../../../plans/stage-8a-conventional-rhythm-model.md)
recommends a smaller set of ordinary mora/final-pair patterns. This directory
records source evidence and reproducible Gregorio experiments; it changes no
production semantic, persistence or engraving behavior.

## What the primary sources support

1. [Chants of the Church, Desclée, 1954, introduction p. vi / PDF page 6](https://www.imslp.eu/files/imglnks/euimg/8/80/IMSLP12109-ChantsOfTheChurch.pdf#page=6)
   explains the single dot as prolonging one note, distinguishing it from a
   horizontal episema. This is the book's explicitly Solesmes rhythmic profile,
   not a universal performance theory. The page was inspected as a rendered
   scan; the PDF's missing text layer was not treated as evidence of absent text.
2. [1961 Liber Usualis, p. xxv](https://gregobase.selapa.net/sources/3/24.png)
   discusses phrase endings with one or two lengthened notes. Together these
   printed instructions motivate ordinary one-note and two-note ending patterns;
   they do not authorize arbitrary arithmetic dot counts.
3. [Gregorio's GABC rhythmic-sign guide](https://gregorio-project.github.io/gabc/details.html#rhythmic-signs)
   uses a period for a mora and doubled periods for a two-dot sign. It describes
   ordinary mora as present at most once per note. The syntax alone is not a
   semantic schema saying two dots both modify the character before `..`.
4. [Pinned writer](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/src/gregoriotex/gregoriotex-write.c#L1946)
   `write_auctum_duplex` uses current and previous pitches for a compound sign
   in its intended final-note use. With no preceding note, it still generates
   a two-position fallback; this is not evidence for doubling one note twice.
   `write_punctum_mora` also handles earlier dots and special placements rather
   than rejecting every unusual input.
5. [Sign parser](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/src/struct.c#L646)
   changes one-mora state to the distinct auctum-duplex state on a second period.
   [TeX sign macros](https://github.com/gregorio-project/gregorio/blob/b63f074253bd2f6b837f9f9778bba299ac139ec0/tex/gregoriotex-signs.tex)
   then paint the pair using its two heights.

This supports **one affected note versus two affected notes**, not repeated
augmentation on one note. The source algorithm assumes ordinary ending use;
permissive acceptance of earlier `..` or singleton `..` must not be generalized
into a historically sanctioned unlimited per-note modifier model. Nor should
our restricted editor profile be presented as the complete set of all Gregorian
practices. Earlier-note moras can need source-specific grouping and placement.

## Actual software-output probes

[Rendered Gregorio sheet](gregorio-probes.png), with [GABC](cases.gabc),
[TeX wrapper](comparison.tex) and [machine-readable inspection](probe-summary.json).
Compiler: installed Gregorio 6.0.0 / GregorioTeX 6.0.0, Greciliae. The pinned
source above was inspected independently, not asserted to be the build source
for that binary. The generated sheet is synthetic software evidence, not a
printed chant source or the proposed editor's permitted-pattern menu.

| Family    | Final single example | Final double syntax | Explicit two singles | Other syntax compiled                               |
| --------- | -------------------- | ------------------- | -------------------- | --------------------------------------------------- |
| Punctum   | `g.`                 | `g..`               | Not applicable       | Double fallback has two different output heights    |
| Podatus   | `fg.`                | `fg..`              | `f.g.`               | `f.g` lower-only                                    |
| Clivis    | `hf.`                | `hf..`              | `h.f.`               | `h.f` upper-only                                    |
| Scandicus | `fgh.`               | `fgh..`             | `fg.h.`              | Middle-only `fg.h`, early-only `f.gh`               |
| Torculus  | `fhf.`               | `fhf..`             | `fh.f.`              | Middle-only `fh.f`, early-only `f.hf`               |
| Climacus  | `hvGF.`              | `hvGF..`            | `hvG.F.`             | Middle-only `hvG.F`, early-only `hv.GF`             |
| Porrectus | `hfh.`               | `hfh..`             | `hf.h.`              | Middle-only `hf.h`, early-only `h.fh`, all `h.f.h.` |

All 35 cases compile. The inspection confirms two `GrePunctumMora` calls for
an explicit Pair, but one `GreAugmentumDuplex` call for Duplex/Double syntax.
On a compound endpoint that double uses the final and preceding pitches. The
singleton double probe produces heights 9 and 10 despite there being only one
note. Climacus uses a Virga plus separate inclinatum glyphs: **semantic neume**
and Gregorio's glyph objects must not be conflated.

These are affected-note comparisons, not claims of identical pixel placement:
Clivis and Torculus explicit singles can be spaced differently from the double
sign. The final `efg` row also shows why isolated middle-note mora needs care
when a middle line and a final space lead to a shared nominal dot space.
Unusual inputs printing successfully—even with ambiguous or fallback ink—do
not establish suitable default authoring controls.

## Consequences for the proposed editor subset

The proposed final-pair action marks two existing notes once each and chooses
conventional paired engraving. It does not emulate the singleton-double
fallback, create a third pitch, preserve arbitrary GABC spelling, add performance
timing or replace the approved neume contour. Restricting three-note neumes to
none/final/final-pair is a deliberately conservative Stage 8A decision, not a
claim that every middle-only or first-only dot is historically impossible.

The proposal also needs actual conventional pair-placement regressions before
implementation acceptance. The source's adjacent Podatus lower-line displacement
is particularly important: per-note ownership alone does not guarantee correct
engraving. No new policy, schema or data conversion is implemented by these probes.

## Reproduce and checks

In this directory, with a matching Gregorio/TeX installation:

```bash
gregorio -o cases.gtex cases.gabc
node inspect-gtex.mjs
lualatex -interaction=nonstopmode -halt-on-error comparison.tex
lualatex -interaction=nonstopmode -halt-on-error comparison.tex
pdftoppm -scale-to 1900 -x 0 -y 0 -W 1825 -H 1320 -png -singlefile comparison.pdf gregorio-probes
```

Generated `.gtex`, PDF and TeX working files are temporary research outputs,
not application assets to commit. The repository retains the fixture, inspection
script/summary and agent-inspected PNG. Actual probe compilation and inspection
passed. Formatting/diff checks and relevant unchanged production unit suites
are recorded in the proposal's review closeout; these do not claim a new model
has been implemented or browser-accepted.

# Stage 10A — Liquescent notation research record

2026-11-15. Branch `research/liquescent-notation`, target `master` (base
`aea861d`, research plan `260dfe5`). This is a research-and-design gate under
[the Stage 10A plan](../../plans/stage-10a-liquescent-notation.md). It changes
no production code, schema or accepted ADR. The proposed design is in
[the Stage 10B proposal](../../plans/stage-10b-liquescent-podatus-clivis.md)
and [Proposed ADR 0027](../../adrs/0027-neume-level-liquescence.md), both
**not accepted**.

Evidence labels used throughout:

- **[print]** observed in a printed chant book (scan inspected directly);
- **[rubric]** a printed book's own prose about its notation;
- **[renderer]** Gregorio/GregorioTeX behaviour or font design (a modern
  convention, not historical evidence);
- **[secondary]** a third party's published reading of the sources;
- **[inference]** this record's own reasoning.

## 1. Sources

| ID  | Source                                                                                                                                            | Locator                                                                                                                                        | Use                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | _Completorium O.P._ (Suarez), Rome 1949, scan on GregoBase                                                                                        | pp. 119–120; [p. 119](https://gregobase.selapa.net/sources/13/132.png), [p. 120](https://gregobase.selapa.net/sources/13/133.png) (480×675 px) | Primary engraving witness                                                                                                                    |
| P1a | Same two pages, ≈1.6× resolution, annotated with red circles                                                                                      | [Gregorio issue #1, opening comment image](https://github.com/gregorio-project/gregorio/issues/1) (1514×1108 px)                               | Higher-resolution copy of P1 used for crops                                                                                                  |
| G1  | GregoBase #4577 GABC                                                                                                                              | [entry](https://gregobase.selapa.net/chant.php?id=4577), [GABC](https://gregobase.selapa.net/download.php?format=gabc&id=4577)                 | Transcription, cited as `book: Completorium O.P. (Suarez), 1949, p. 119`                                                                     |
| L1  | _Liber Usualis_ (Desclée), Archive.org scan already used by Stage 8B                                                                              | [PDF](https://archive.org/download/TheLiberUsualis1961/liberusualis.pdf), printed p. xxij (PDF 22) table E.1; printed p. xxiv (PDF 24) § IV.10 | Roman/Solesmes print and rubric baseline                                                                                                     |
| R1  | Gregorio GABC documentation                                                                                                                       | [details.html#liquescences](https://gregorio-project.github.io/gabc/details.html)                                                              | Meaning of `~`, `<`, `>`                                                                                                                     |
| R2  | Gregorio 6.0.0 release: `GregorioRef.pdf` appendix A.1 (pp. 276, 280) and A.2 “Dominican Score Font Glyphs” (pp. 292, 296); `CHANGELOG.md` 4.0.0  | [release v6.0.0](https://github.com/gregorio-project/gregorio/releases/tag/v6.0.0)                                                             | Glyph names and Roman vs `op` font shapes                                                                                                    |
| R3  | Gregorio issue #1 “Missing some Dominican neumes” (2014–2015) and implementation [PR #542](https://github.com/gregorio-project/gregorio/pull/542) | [issue thread](https://github.com/gregorio-project/gregorio/issues/1)                                                                          | [secondary] contributor analysis of exactly P1, citing Dominican rubrics; [renderer] 2015 `op` render of #4577                               |
| D1  | Cormier, _Processionarium O.P._ (1913), Regulae Cantus p. 340; Harrison, _How to Sing Plain Chant_ p. 31                                          | As quoted in R3 (2014-08 comment); originals linked there on media.musicasacra.com                                                             | [rubric, via secondary] Dominican single-note liquescents. **Not inspected directly**: that host currently fails TLS certificate validation. |

Unavailable: no higher-resolution scan of the 1949 _Completorium_ was found
(the musicasacra.com Dominican page could not be fetched; no Archive.org copy
located). Each P1 notehead is ≈6 px tall at 480 px and ≈10 px in P1a, so
**fine stroke curvature is not resolvable**; topology, direction, relative
width and terminal-stroke presence are.

Rights: P1/P1a crops are **not committed** (the 1949 scan's redistribution
status is unknown). [`regenerate.sh`](regenerate.sh) downloads them and makes
every crop below at fixed coordinates. Committed images are Gregorio renders,
Gregorio's own reference-manual table cells, and a small L1 excerpt (the
repository already retains L1 excerpts for Stages 8B/9B).

## 2. Repertoire inventory (R1 of the plan)

GABC pitch letters map to this editor's staff positions as `d=0 … j=6`
(C4 clef, `j` = do). All six GABC liquescences are **two-note neumes standing
alone** as a GABC element (own syllable or separated by `/`), at a **second**.

| #   | Text (syllable)      | Local GABC           | Pitches → positions   | GABC type                    | P1 location                             | Printed shape [print]                                                                                                                                                                                                                           | Status                                                                               |
| --- | -------------------- | -------------------- | --------------------- | ---------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| L1  | **Ad** te clamámus   | `Ad(d/fg~)`          | d, then f→g: 0, [2,3] | `~` diminutive pes           | p. 119 sys 2, last figure               | Punctum on d; then one stacked column: full lower head on f with a narrow vertical terminal stroke rising from its right half to g, small hook at its base. No second full head.                                                                | **Confirmed epiphonus**                                                              |
| L2  | **Ad** te suspirámus | `Ad(d/fg~)`          | 0, [2,3]              | `~`                          | p. 119 sys 3, after the double bar      | Same as L1.                                                                                                                                                                                                                                     | **Confirmed epiphonus**                                                              |
| L3  | **E**-ia             | `E-(fg>)ia,(f)`      | f→g: [2,3]            | `>` augmentative, descending | p. 119 sys 4, last figure               | Two full heads **not stacked**: f, then g offset to the right and overlapping; the upper head extends below its body on the right (a descending tail), visibly unlike the stacked ordinary pes elsewhere on the page (e.g. _la-_crimárum `gh`). | **Confirmed augmentative pes, descending terminal** (not inferred from the interval) |
| L4  | **er**-go            | `er(gh~)go`          | g→h: [3,4]            | `~`                          | p. 119 sys 5, first figure              | Same construction as L1 on g→h.                                                                                                                                                                                                                 | **Confirmed epiphonus**                                                              |
| L5  | miseri**cór**-des    | `cór(fv/ixghih/hg~)` | final h→g: [4,3]      | `~` diminutive clivis        | p. 119 sys 5, last figure before custos | Upper full head on h with a long left stem; reduced, narrow lower terminal on g on the right. Narrower than the neighbouring two-head figures.                                                                                                  | **Confirmed cephalicus** (last element of the syllable’s group)                      |
| L6  | **dul**-cis          | `dul(gf~)cis`        | g→f: [3,2]            | `~`                          | p. 120 sys 3, after _O_                 | As L5 on g→f; visibly narrower and lighter than the stacked pes `gh` on _-cis_ beside it.                                                                                                                                                       | **Confirmed cephalicus**                                                             |

Hypotheses from the plan: all five leads (`Ad` ×2, `Eia fg>`, `ergo gh~`,
`misericordes hg~`, `dulcis gf~`) are confirmed with exact syllables. Note
that the cephalicus in _misericórdes_ is on **cór**, not _-des_ (`des(hg)`
is an ordinary clivis), and _dulcis_’s is on **dul**.

### Other markings checked

| Text                           | GABC           | Print                                                                      | Classification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | -------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| os-**tén**-de                  | `tén(c)`       | A single head on c with thin upward strokes on **both** sides (“U” shape). | **Single-note liquescent in Dominican usage** [rubric, via secondary D1]: Cormier’s Regulae Cantus names exactly _osténde_ and _Virgo_ in this antiphon: “Si tamen epiphonus et cephalicus punctulo caruerint … uti nota una simplex figura talis habetur” — an epiphonus/cephalicus lacking its small final point is sung as **one** note. GABC transcribes it as a plain punctum; the GregoBase contributor’s remark (“punctum with the upward tails on ‘ten’ … cannot be reproduced using GABC”) agrees it is unencoded. |
| **Vir**-go                     | `Vir(d)`       | Single head on d with thin **downward** strokes on both sides (“∩”).       | Same as above (descending). **Unencoded in GABC.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| _tra_ (nostra), _cla-má-_ etc. | `gf{gh}`       | Compound grouping                                                          | Not liquescence. Out of scope (fixture approximation).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| _sal-_, _di-_                  | `defEDC`       | Pes subpunctis variants                                                    | Not liquescence. Out of scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `;1`, `;3`, `;6`               | Dominican bars | Modified divisions                                                         | Not liquescence. Out of scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**GABC discrepancies** (independent of this milestone): (1) _tén_ and _Vir_
lose their single-note liquescent figures; (2) GABC `>` names a terminal
direction, but nothing in GABC records that the Dominican print draws that
terminal as a thin plica-like stroke rather than a Solesmes auctus head —
that is a font choice (R2 `op`). No other liquescent figure was found in the
print that GABC omits.

## 3. Shapes: print, rubric and renderer comparison (R2 of the plan)

### Roman/Solesmes baseline [print, rubric: L1]

![Liber Usualis p. xxij liquescent table](liber-pxxij-liquescent-table.png)

- Table E.1 labels the two-note forms **“Epiphonus or liquescent Podatus”**
  and **“Cephalicus or liquescent clivis”** — the book treats liquescence as a
  qualification of the ordinary two-note neume, alongside liquescent torculus,
  porrectus, scandicus and climacus (“ancus”).
- Epiphonus: one stacked column. The lower note is a full-width body with a
  curved/hollowed upper-left and rounded underside; a right-side stroke rises
  to a **small hooked terminal**, not a second square head. The modern
  transcription beside it writes the second note as a small note.
- Cephalicus: a full upper head with a left descending stem; the second note
  is a **reduced terminal hook** on the right, not a second head.
- The table shows **no augmentative (auctus) two-note forms**.
- § IV.10 (p. xxiv): “Liquescent notes: these are printed in smaller type but
  this does not affect their duration nor their execution, except in that they
  must be sung lightly. They occur when two vowels form a diphthong (autem,
  euge), or at the junction of certain consonants (Hosanna, tollis, mundi,
  etc.) or to introduce the semi-consonants j or i (ejus, alleluia).”

So the source itself both (a) describes the liquescent note as “smaller” and
(b) prints it as a **different connected construction** (curved body, hooked
terminal, stem side), not a scaled-down square. Rendering liquescence as a
small ordinary notehead would contradict the printed shapes.

### Dominican witness [print: P1] versus the baseline [inference]

- **Epiphonus (L1, L2, L4)**: same topology as L1-Liber: single column, full
  lower body, right rising stroke, reduced terminal. A Gregorio contributor
  reviewing exactly this page concluded it “is actually an epiphonus …
  as represented in Solesmes editions” [secondary R3]. At this scan resolution
  any difference in curvature is not observable. **No material conflict with
  the Roman profile.**
- **Cephalicus (L5, L6)**: same topology as the Liber cephalicus. Gregorio's
  default and Dominican fonts also share one cephalicus glyph [renderer R2].
  **No material conflict.**
- **Augmentative pes (L3, Eia)**: an offset (non-stacked) pes whose upper
  head carries a **thin descending tail**. The Liber table provides no Roman
  counterpart. Gregorio draws `>`/`<` on a pes as `PesQuadratum…Descendens/
Ascendens` (offset construction) in both fonts, but the default font ends it
  with a rounded auctus head while the Dominican `op` font substitutes the thin
  plica-like stroke [renderer R2], matching P1. **This is the one materially
  Dominican construction in scope.**
- **Single-note liquescents (tén, Vir)**: plica-like strokes on one head
  [print]; Dominican-specific per R3/D1; out of this milestone.

### Gregorio renderer comparison [renderer: R1, R2]

![Greciliae default versus op, liquescent pairs and Salve excerpts](gregorio-roman-vs-op.png)

Fixtures: [`pairs.gabc`](pairs.gabc) (ordinary/`~`/`<`/`>` at 2nd, 2nd on
line/space, 4th rising; 2nd, 2nd, 4th falling) and
[`salve-excerpt.gabc`](salve-excerpt.gabc), compiled by
[`comparison.tex`](comparison.tex) with GregorioTeX 6.0.0 (log: “gregoriotex
2021/03/13 v6.0.0”), default Greciliae then `\gresetgregoriofont[op]{greciliae}`.

![Ascending detail: default (top) and op (bottom)](gregorio-ascending-detail.png)
![Fourth and descending detail](gregorio-descending-detail.png)
![GregorioRef 6.0.0 table cells, A.1 default (top) and A.2 Dominican (bottom)](gregorioref-font-table-cells.png)

Observed [renderer]:

| GABC          | Glyph (`.gtex`)                       | Construction                                                                                                                                                                          | Interval behaviour                                                                         |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `fg~`         | `PesOneDeminutus`                     | One column; lower body with curved top-left and rounded bottom; right stem; small hooked terminal at upper pitch. Same column width as the ordinary pes.                              | Stem lengthens with interval (`fi~` = `PesThreeDeminutus`).                                |
| `gf~`         | `FlexusOneDeminutus`                  | Upper head, left stem descending below it, right stem down to a small terminal hook. **Narrower** than the ordinary clivis (one head + stroke vs two heads).                          | Stems lengthen (`Longqueue` variants when the upper head is on a line at wider intervals). |
| `fg<` / `fg>` | `PesQuadratumOneAscendens/Descendens` | Offset: lower punctum, upper head to its right joined by a stem, upper head with an up/down auctus end; default = rounded auctus, `op` = thin stroke. **Wider** than the stacked pes. | Stem lengthens.                                                                            |
| `gf<` / `gf>` | `FlexusOneAscendens/Descendens`       | Clivis with auctus second head (default) or thin stroke (`op`).                                                                                                                       | —                                                                                          |
| `gwi~`        | `QuilismaPesTwoDeminutus` exists      | Quilismatic epiphonus is encodable.                                                                                                                                                   | Not evidenced in print here.                                                               |

The CHANGELOG for 4.0.0 states the `op` fonts “replace the epiphonus and the
augmented liquescents with corresponding figures from Dominican liturgical
books”. In the 6.0.0 render the `op` epiphonus is visually indistinguishable
from the default at these sizes; the augmentative difference is clear.
Gregorio does **not** document a duration, and neither does this record:
no claim that diminutive means half or augmentative double duration (L1 § IV.10
explicitly denies a duration change).

### Geometry implications [inference]

| Figure           | Column structure                       | Width vs ordinary        | Note anchors                                                                       | Notes                                                                         |
| ---------------- | -------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Epiphonus        | Stacked, like Podatus                  | ≈ same                   | Lower: full head centre. Upper: centre of the reduced terminal at the upper pitch. | Lower body silhouette changes too; not a terminal-only swap.                  |
| Cephalicus       | Upper head + right descending terminal | **Narrower** than Clivis | Upper: head centre. Lower: terminal centre at lower pitch, right of head.          | Changes advance, compaction and lyric centring; needs its own measured width. |
| Augmentative pes | Offset, like a pes quadratum           | **Wider** than Podatus   | Two full-pitch heads; tail beyond the upper head.                                  | Only figure whose topology changes horizontally.                              |

A reduced terminal still needs an ordinary-sized hit/focus target; ink
bounds alone would be too small for pointer and keyboard selection.

## 4. Architecture audit (R3 of the plan)

Checked on base `aea861d` (+ fixture/plan commits only).

| Path                                                                                                           | Behaviour with a hypothetical neume-level `liquescence` on podatus/clivis                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/neume.ts` `mapNeumeNotes`                                                                              | Podatus/Clivis/Punctum/Bistropha/three-note fixed kinds and Pes subpunctis spread `{ ...neume, notes }` → **preserved**. Compound four-note kinds and Scandicus/Climacus rebuild `{ id, kind, notes }` → would **drop** any neume field (latent hazard if liquescence is ever extended to those kinds; make explicit then). |
| `commands/move-note.ts`, `move-neume.ts` (`transposeNeume`), `update-note-modifiers.ts`, `update-note-form.ts` | All go through `mapNeumeNotes` → **preserved**; contour still validated by `isValidNeume`.                                                                                                                                                                                                                                  |
| `commands/edit-clef-change.ts` / clef translation                                                              | `transposeNeume` → **preserved**; positions only.                                                                                                                                                                                                                                                                           |
| `domain/neume.ts` `normalizeNeumeAfterNoteDeletion`                                                            | Podatus/Clivis → fresh `PunctumNeume { id, kind, notes }` → would **silently drop** the field. Needs an explicit policy. Three-/four-/five-note reductions to Podatus/Clivis build fresh objects → never introduce liquescence (correct).                                                                                   |
| `commands/musical-passage-clipboard.ts`                                                                        | Copy: `{ ...mapped, id: '' }`; paste: `mapNeumeNotes` + `{ ...mapped, id }` then `isValidNeume` → **preserved** with fresh IDs. Clipboard is in-memory only (no serialized payload to validate).                                                                                                                            |
| `persistence/native-document.ts`                                                                               | `shape(value, ['id','kind','notes'])` is strict, and each case rebuilds `{ id, kind, notes }` → v1–v9 **reject** an unknown key (good) but a v10 reader must add the key per kind.                                                                                                                                          |
| `domain/note-forms.ts`                                                                                         | Form whitelist is note-level by kind/index/count; liquescence combination checks belong in `isValidNeume` alongside it.                                                                                                                                                                                                     |
| Fixture                                                                                                        | v9, 35 neumes / 62 notes / 24 syllables / 6 divisions, C4; neumes carry only `id/kind/notes`, notes only `id/staffPosition`. Unchanged by this branch.                                                                                                                                                                      |

## 5. Verification performed in this research PR

- Downloaded GABC is byte-identical across two independent fetches.
- `regenerate.sh` was run end-to-end into a scratch directory (GregorioTeX
  6.0.0 via an existing extracted TeX tree in `TEXMFHOME`) and reproduced every
  crop and the Gregorio render; GregorioTeX's “gregorio-6_0_0: not found” probe
  message is harmless (it falls back to `gregorio`).
- All crops and renders were visually inspected. No browser, unit test or
  application run is claimed: no application code changed.
- Fixture unchanged: `git diff aea861d -- docs/verification/liquescent-notation/fixtures` shows only its original addition.

## 6. Unresolved historical questions

1. **Eia (L3)**: a Roman/Solesmes printed counterpart for an augmentative pes
   was not located (L1 has none). Whether to engrave it with the Dominican thin
   tail, a Solesmes-style auctus head, or defer is an owner decision.
2. **Single-note liquescents** at _osténde_/_Virgo_: confirmed as Dominican
   liquescents by rubric (via R3), but out of scope and unencoded in GABC.
3. Fine curvature of the Dominican epiphonus vs Solesmes cannot be resolved
   from the 480 px scan; a higher-resolution witness of the 1949 book would be
   needed before claiming a Dominican-specific epiphonus silhouette.
4. Direct inspection of Cormier 1913 and Harrison (D1) is pending host
   availability; their wording is quoted here only through R3.

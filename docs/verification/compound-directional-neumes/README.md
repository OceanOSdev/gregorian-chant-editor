# Stage 9B-3: Compound directional neumes — reference and decision record

Status: **research complete; owner Gates A–C pending** (2026-11-13). Nothing
is implemented. Follows the committed
[plan](../../plans/stage-9b3-compound-directional-neumes.md) and supports
**Proposed** [ADR 0025](../../adrs/0025-compound-directional-four-note-neumes.md).

All crops are actual scans or actual Gregorio output; no notation is redrawn.
Pitches are read from the scans as staff-step intervals (`+1` = one step up).
"n1 = n3" marks a nonadjacent unison.

## Sources

- _Liber Usualis_ (Desclée, 1961/1962 printing, 400 ppi scan), local copy of
  the [CC Watershed PDF](https://archive.ccwatershed.org/media/pdfs/18/11/29/00-45-28_0.pdf).
- Sister M. Demetria, _Basic Gregorian Chant and Sight Reading_ (1960),
  Lessons 18–21, pp. 49–55 (600 ppi bilevel scan). Its "Excerpts from the
  Liber" were checked against the Liber where located.
- Gregorio 6.0.0 / GregorioTeX (Stage 8C/8D tree), [`cases.gabc`](cases.gabc),
  [`marked.gabc`](marked.gabc), [`comparison.tex`](comparison.tex).
- Suñol, Mocquereau and the Gregorio/Cambridge/SMuFL references cited in the
  plan were not re-imaged; Mocquereau's flexus/resupinus text (printed
  pp. 153–154) gives definitions only.

## Printed specimens

| Kind                                       | Source / file                                                                                                                                                   | Specimen                                                   | Construction seen                                                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| All four                                   | Liber p. xxj, "Compound neums" table — `liber-pxxj-compound-table.png`                                                                                          | TR F G F G; PF A F G E; SF F G A F (two forms); CR A G F G | See rows below. Table (didactic), not repertoire.                                                                                                            |
| Torculus resupinus                         | Liber p. xxj                                                                                                                                                    | +1 −1 +1, n0 = n2, n1 = n3                                 | Punctum + three squares; the last has a short right tail. **No porrectus stroke** for the step.                                                              |
| Torculus resupinus                         | **Liber p. 1002**, Intr. _Exaudi Domine_ (Pent. V), "despí-", "-as", "Dé-" — `liber-p1002-torculus-resupinus.png`                                               | "spí" all steps; "as" and "Dé" a wider fall                | **Punctum joined to a porrectus stroke** whose terminal rises; "Dé" carries a horizontal episema over notes 2–4. No mora.                                    |
| Torculus resupinus                         | Demetria p. 55 (definition; Ex. 80 _Si consurrexistis_, Ex. 81 _Exaudi_) — `demetria-p55-torculus-resupinus.png`, `demetria-p55-ex80-81-torculus-resupinus.png` | sol-la-sol-la (all steps) "or" fa-sol-fa-sol               | Prints **both** the four-square form and the punctum + porrectus-stroke form for the same stepwise contour; the repertoire excerpts use the stroke.          |
| Porrectus flexus                           | Liber p. xxj                                                                                                                                                    | −2 +1 −2                                                   | Porrectus stroke (left stem) + third note joined to the fourth by a **right-side stem**, i.e. the terminal becomes the head of a clivis.                     |
| Porrectus flexus                           | Demetria p. 49 — `demetria-p49-porrectus-flexus.png`; Exx. 53–55                                                                                                | la-fa-sol-mi (−2 +1 −2); do-ti-do-sol (−1 +1 −3, n0 = n2)  | Same construction for step and skip strokes and a fourth below. No mora on any specimen.                                                                     |
| Scandicus flexus                           | Liber p. xxj                                                                                                                                                    | +1 +1 −2 (n0 = n3)                                         | **Two forms:** (1) Punctum + Torculus-like group (G A F joined); (2) stacked **Pes + Clivis**, slightly separated.                                           |
| Scandicus flexus                           | **Liber p. 403**, Intr. _Lux fulgebit_, "fulgé-" — `liber-p403-scandicus-flexus.png`                                                                            | rising skip, rise, step fall                               | **Pes + Clivis**, contiguous. Demetria Exx. 59–60 (_Lux fulgebit_, _Deus solus_) agree.                                                                      |
| Scandicus flexus                           | Demetria p. 50 — `demetria-p50-scandicus-flexus.png`                                                                                                            | mi-sol-la-sol (+2 +1 −1); sol-la-do-la (+1 +2 −2, n1 = n3) | Pes + Clivis in both.                                                                                                                                        |
| Climacus resupinus                         | Liber p. xxj                                                                                                                                                    | −1 −1 +1 (n1 = n3)                                         | Virga + two diamonds + **detached square punctum**.                                                                                                          |
| Climacus resupinus                         | **Liber p. 361**, All. _Crastina die_, "delé-" — `liber-p361-climacus-resupinus.png`                                                                            | −1 −1 +1 (n1 = n3)                                         | Virga + two diamonds + detached punctum, ictus under the second diamond. No mora.                                                                            |
| Climacus resupinus (5 notes, out of scope) | Liber p. 1118, Ant. _Lux perpetua_, "et" — `liber-p1118-climacus-resupinus-5.png`                                                                               | pes + virga + 3 diamonds + punctum                         | Same detached final punctum after a longer tail. Related only.                                                                                               |
| Climacus resupinus                         | Demetria p. 52 — `demetria-p52-climacus-resupinus.png`; Ex. 68 — `demetria-p53-ex68-climacus-resupinus.png`                                                     | do-ti-sol-la (−1 −2 +1)                                    | Definition: detached punctum close to the last diamond. **Ex. 68 instead draws the final square with a right stem**; her Liber excerpts (Exx. 70–71) do not. |

**Kyrie XI** (Liber p. 46) contains no genuine instance of any of the four.
`ixfgh!ivHGfvED` descends after `HG`. `JH'Gh.` belongs to two syllable-internal
neumes, not one resupinus. No other repertoire search was exhaustive.

## Gregorio comparison

`gregorio-cases.png` (unmarked) and `gregorio-marked.png` (marks). Rows are
labelled TR, PF, SF and CR.

- **TR** `fgfg fhgh fhgi fjgh fgeh ehgj`: always Punctum + porrectus stroke.
  The first note joins the stroke's left stem. When the third note falls
  below the first (`fgeh`), the stem extends down. Gregorio does not draw the
  Liber table's four-square form. **It matches Liber p. 1002.**
- **PF** `hfge jijg hghg hfhf hgig ifhd`: porrectus stroke + right-stem clivis
  terminal for every interval, including nonadjacent unisons. **It matches
  the Liber and Demetria.**
- **SF** default `fghf eghg ghjh fghe fgjf`: Gregorio's own partition is
  Punctum + Pes + Punctum, which matches **neither** printed form. Forced
  `fg!hf` gives a joined Pes + Clivis and `fg/hf` a slightly separated
  Pes + Clivis (the Liber table's second form). As in Stage 9B-2, Gregorio's
  partition is parser behavior, not evidence.
- **CR** `hGFg jIGh hGEh hFEi iHGh hGFh`: virga + diamonds + detached
  punctum, including a final above the first (`hFEi`). **It matches the Liber.**

## Gate A: recommended engraving profiles

| Kind               | Recommendation                                                                                                                                                                  | Evidence                                                                                        | Alternative                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Torculus resupinus | **Punctum + porrectus**: the first note is a square joined at the foot of the existing porrectus left stem, which extends down when n2 < n0. Use the stroke for every interval. | Direct: Liber p. 1002 (step and wider), Demetria repertoire excerpts, Gregorio.                 | Liber-table four-square form (Demetria's "or"). It is printed, but the plan says not to "just append a fourth square". **Not recommended.** |
| Porrectus flexus   | **Porrectus + clivis terminal**: the existing stroke, the third note drawn as the head of a clivis, and a right-side stem down to the fourth note.                              | Direct: Liber table, Demetria definitions and exercises, Gregorio. Consistent across intervals. | None found.                                                                                                                                 |
| Scandicus flexus   | **Pes + Clivis**: the approved Podatus followed by the approved Clivis in the next column, contiguous. Do not reuse the Stage 9B-2 staircase or the three-note Scandicus glyph. | Direct: Liber p. 403 repertoire, Liber table form 2, Demetria (definition and Exx. 57–60).      | Punctum + Torculus (Liber table form 1). Printed, but not found in repertoire here. Gregorio's default partition is rejected.               |
| Climacus resupinus | **Climacus + detached punctum**: the existing three-note Climacus heads, unchanged, then a square punctum in the next column at its own pitch. No connector.                    | Direct: Liber table, Liber p. 361, Demetria definition, Gregorio.                               | Demetria Ex. 68 right-stemmed final square. This is an exercise-typography outlier. **Not recommended.**                                    |

No interval-specific variant is proposed: none of the sources varies
construction by interval, except the stem extension that Gregorio shows for
`fgeh`.

**Implementation impact.** CR and SF compose approved primitives. TR and PF
need **new derived geometry** inside the current porrectus builder, which is
one monolithic ink path:

- TR: a leading punctum and a variable-length left stem.
- PF: a right-stem clivis terminal in place of the porrectus terminal crown.

Three-note porrectus output must stay byte-identical, so both are gated
geometry. They are not implemented before approval.

## Gate B: mora

No printed specimen of any of the four kinds with a mora was found. All Liber
and Demetria specimens above are unmarked. Every "allow" below rests on
analogy plus unambiguous Gregorio rendering, as in Stages 9B-1 and 9B-2.

| Kind | None                   | Final note                                                                                                                                 | Final two                                                                                                                                     | Earlier notes |
| ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| TR   | Direct (all specimens) | **Allow.** Analogy: the porrectus terminal; three-note Porrectus final is approved. Gregorio `fgfg.` places one dot right of the terminal. | **Defer.** Strong analogy (the same two notes as the approved Porrectus final-two), and `fgf.g.` is clear in Gregorio, but there is no print. | Defer         |
| PF   | Direct                 | **Allow.** Analogy: the Clivis second note. Gregorio `hfge.` is clear.                                                                     | **Defer.** Analogy: Clivis "both". `hfg.e.` puts the upper dot inside the join.                                                               | Defer         |
| SF   | Direct                 | **Allow.** Analogy: the Clivis second note. Gregorio `fghf.` / `fg!hf.` are clear.                                                         | **Defer.** The upper dot depends on grouping (`fgh.f.` shifts the layout).                                                                    | Defer         |
| CR   | Direct                 | **Allow.** Analogy: the Punctum sole mora on a detached head. Gregorio `hGFg.` is clear.                                                   | **Defer.** `hGF.g.` puts the dot under the last diamond, as in the deferred Climacus/Pes subpunctis final-two.                                | Defer         |

Recommended matrix: **`{none, final}` for all four**. No authored forms.
Independent horizontal and vertical episemata on all four notes use the
existing contracts. Liber p. 1002 prints a horizontal episema over a TR
porrectus.

## Gate C: model, normalization, toolbar and format review

Checked against the code at `5c24857`:

- **ADR 0004 fit.** Each new kind is a single fixed four-note tuple. **No
  bounded-union qualification is needed** (unlike ADRs 0023/0024). ADR 0025
  only extends the named-kind list. ADRs 0004 and 0022–0024 stay Accepted and
  unamended.
- **Contour rules.** The strict adjacent directions with nonadjacent freedom
  match the existing `isValidNeume` Torculus/Porrectus rules. The printed
  specimens include n0 = n2, n1 = n3 and n0 = n3 cases, so the freedom is
  needed.
- **Deletion matrix.** It was re-derived from the contours. The plan's table is
  correct and complete. Every outcome is an existing three-note kind, decided
  by the surviving adjacent contour, as in the ADR 0023 amendment. Adjacent
  unisons reject.
  - With `{none, final}` mora and no forms, **no surviving mark can make a
    deletion invalid**: every three-note kind allows a final mora.
  - Rejection can still come only from unisons.
  - Older kinds' rules are unchanged, so ADR 0024's "no other normalization
    rule is broadened" holds.
- **Toolbar.** Today the palette has four split families (`punctum`,
  `podatus`, `scandicus`, `climacus`), with `torculus` and `porrectus` as plain
  buttons (`palette-navigation.ts`). The plan's arrangement gives six
  families. The Scandicus menu would then list "Four-note scandicus" and
  "Scandicus flexus", both four notes, so the labels must name the figure, not
  the count. I = insert-recall and T = focus-palette are unaffected.
- **Native v9.** `currentSchemaVersion` is 8, and the decoder's
  `default: fail('Unsupported neume kind.')` already rejects unknown kinds.
  A `version < 9` gate keeps v1–v8 exact. The next ADR number, **0025**, is
  free: no ADR, branch or open PR uses it.

## Not done

No editor screenshots exist, because nothing is implemented. The comparison is
qualitative, not measured. Suñol, Mocquereau's figures and the Nocturnale
Romanum were not re-imaged. No browser, performance or full regression run
was needed for this research-only change.

# Stage 9B-3: Compound directional neumes — reference and decision record

Status: **owner Gates A–C approved (2026-11-14); implemented with focused
verification; implementation acceptance pending owner review** (PR #80).
Follows the committed
[plan](../../plans/stage-9b3-compound-directional-neumes.md) and
**Accepted** [ADR 0025](../../adrs/0025-compound-directional-four-note-neumes.md).
The research sections below are preserved as written for the gate review
(2026-11-13); [owner decisions](#owner-decisions-2026-11-14) and
[implementation and verification](#implementation-and-verification) follow.

All crops are actual scans or actual Gregorio output; no notation is redrawn.
Pitches are read from the scans as staff-step intervals (`+1` = one step up).
"n1 = n3" marks a nonadjacent unison.

## Sources

- _Liber Usualis_ (Desclée, 1961/1962 printing, 400 ppi scan), local copy of
  the [CC Watershed PDF](https://archive.ccwatershed.org/media/pdfs/18/11/29/00-45-28_0.pdf).
- Sister M. Demetria, _Basic Gregorian Chant and Sight Reading_ (1960),
  Lessons 18–21, pp. 49–55 (600 ppi bilevel scan). Its "Excerpts from the
  Liber" were checked against the Liber where located.
- Gregorio 6.0.0 / GregorioTeX 6.0.0, [`cases.gabc`](cases.gabc),
  [`marked.gabc`](marked.gabc), [`comparison.tex`](comparison.tex); see
  [regenerating the Gregorio references](#regenerating-the-gregorio-references).
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

Three-note porrectus output must stay byte-identical, so both were gated
geometry, implemented only after approval (see below).

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

## Research-phase limits

At the gate review no editor screenshots existed, because nothing was
implemented. The comparison is qualitative, not measured. Suñol, Mocquereau's
figures and the Nocturnale Romanum were not re-imaged. No browser, performance
or full regression run was needed for the research-only change.

## Regenerating the Gregorio references

[`regenerate-gregorio.sh`](regenerate-gregorio.sh) recompiles both GABC files
and re-crops `gregorio-cases.png` and `gregorio-marked.png`. It is evidence
tooling, not an application dependency. It does not assume any temporary
directory survives.

Prerequisites, at the versions used for the committed images:

- `gregorio` 6.0.0;
- a GregorioTeX 6.0.0 TeX tree (the TeX files must match the binary's
  version);
- LuaLaTeX (TeX Live);
- `pdftoppm` (Poppler);
- ImageMagick 6 `convert`.

Configuration:

| Variable            | Meaning                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GREGORIOTEX_TEXMF` | TEXMF root that holds a matching GregorioTeX; exported as `TEXMFHOME`. Unset: use the TeX installation's own copy. |
| `GREGORIO`          | Executable, default `gregorio`.                                                                                    |
| `OUT`               | Output directory, default a new temporary directory.                                                               |

```sh
GREGORIOTEX_TEXMF=/path/to/texmf \
  sh docs/verification/compound-directional-neumes/regenerate-gregorio.sh
```

On 2026-11-14 the script reproduced both committed images pixel-for-pixel
(ImageMagick `compare -metric AE`: 0 differing pixels). The committed files
are the script's output. That run used a local GregorioTeX 6.0.0 extract
(the Stage 8C/8D tree); any matching tree works.

The marked image previously clipped the Torculus resupinus row. It now shows
the complete examples: `fgfg.`, `fgf.g.` and `fhgh.`.

## Owner decisions (2026-11-14)

After reviewing draft PR #80 at `9bb4564`, the owner approved:

- **Gate A — the recommended deterministic profiles:**
  - Torculus resupinus: a leading Punctum joined to the Porrectus left stem,
    with interval-sensitive geometry. Stem attachment and extent derive from
    the actual pitches (third note above, equal to or below the first), with
    no fixed stem adjustment.
  - Porrectus flexus: the Porrectus stroke with a right-stemmed Clivis
    terminal.
  - Scandicus flexus: Pes + Clivis as one semantic neume.
  - Climacus resupinus: the ordinary three-note Climacus followed by a
    detached Punctum, with no connector.

  Existing three-note and extended-family geometry must stay byte-identical.

- **Gate B:** `{none, final}` mora for all four, explicitly based on analogy
  and Gregorio rather than direct marked print. Final-two and earlier-note
  mora remain deferred. There are no authored alternate forms. Independent
  horizontal and vertical episemata stay supported.
- **Gate C:** the four fixed tuples, the deletion matrix, six split toolbar
  families and strict native v9. ADR 0004 needs no new qualification. All
  older normalization rules, stable identities, lyric/structural anchors and
  ADR 0021 accidental ownership are preserved.

## Implementation and verification

Implemented as approved; see the owning guides for contracts:

- [domain model](../../domain-model.md#compound-directional-neumes-stage-9b-3);
- [layout](../../layout-and-rendering.md#compound-directional-neumes-stage-9b-3);
- [interactions](../../editor-interactions.md#compound-directional-neumes-stage-9b-3);
- [persistence](../../persistence.md#native-v9-compound-directional-neumes-stage-9b-3);
- [testing](../../testing.md#compound-directional-neumes-stage-9b-3).

One implementation finding needed a narrow rule:

- **What failed:** exhaustive sign testing found 272 Scandicus flexus cases
  with no vertical-episema placement. Each had horizontal episemata on all
  four notes, a vertical episema on a Pes note, and the Clivis head one step
  above the Pes.
- **Rule:** for the four new kinds only, a tick may sit left of the neume's
  ink, and only when no ordinary candidate fits.
- **Effect:** every ordinary placement is unchanged and no existing kind is
  affected. Afterwards a one-off probe built 3,328,000 marked compound
  geometries without an exception: steps 1–5, first pitch −3..9, all
  episema masks, final mora on/off.
- **Status:** the owner reviewed this fallback in the PR #80 review
  (2026-11-14) as a narrow extension of the derived placement rules. It is
  **not** one of the Gate A–C decisions.

### Owner review follow-up: left-overhang integration

**Defect found:** the fallback tick extended ink 3.75 units left of the
requested origin. The overhang only normalized when accidentals were present,
but layout assumes `leftX` is the left ink edge. A regression with the
fallback-producing Scandicus flexus `[0,1,2,1]` (all horizontal episemata,
vertical episema on note 1) after a Punctum showed:

| Scenario                                           | Before fix                     | After fix                                   | Unmarked equivalent |
| -------------------------------------------------- | ------------------------------ | ------------------------------------------- | ------------------- |
| Ordinary word gap                                  | ink gap 29.25                  | 33                                          | 33                  |
| Compact same-word join (narrow lyrics)             | tick overlapped the 2-unit gap | tick exactly 2 units after the previous ink | 2                   |
| Lyric-shifted continuation ("A" / "b")             | first head 170.25              | 174                                         | 174                 |
| Lyric-shifted continuation ("Glooooooooria" / "b") | 217.25                         | 221                                         | 221                 |
| Lyric-shifted new word                             | 221.25                         | 225                                         | 225                 |

In each case the reflow rebuild at `bounds.x + shift` lost the overhang.

**Fix:** `buildNeumeGeometry` now applies the existing accidental
normalization, a single translation of the group by its left overhang,
whenever ink lies left of the origin. The local clearance checks and the
tick are unchanged.

**Also checked:**

- **Accidentals:** a prefix flat ends at x = 112 with the tick at 116.25; no
  overlap, and the group starts at the origin.
- **First system:** the group starts at the same origin as the unmarked
  figure.
- **Preview/committed geometry:** consistent by construction, since both use
  `buildNeumeGeometry`. A newly placed neume carries no marks, so its ghost
  never uses the fallback.

**Tests:** five layout/geometry regressions in
`compound-directional-geometry.test.ts`. All five fail with the previous
accidental-only condition and pass with the fix.

### Pre-existing sign exceptions (owner review item 2)

All 72 exceptions in the existing-geometry comparison, identical on master
`5c24857` and this branch, are **five-note Scandicus** staircases:

- 18 contours, each with every horizontal episema and a vertical episema on
  note 1 (the first Pes's upper note);
- 4 mark variants per contour: that vertical alone or on every note, each
  with and without a final mora;
- in every case note 3 (the following Punctum) is one step above note 1, for
  example `[-2,-1,0,2,3]` or `[1,3,4,6,9]`.

The cause is the same column crowding as the new fallback. There is
`No local vertical episema placement`, so `buildNeumeGeometry` throws, and the
editor would fail to render such an authored state. The probe covers only
the comparison's mask subset for longer groups (empty, full and single-note
masks), so this is a lower bound, not a full census.

**No new editing path reaches them.** Deleting a constituent of a compound
figure yields only three-note kinds, and four-note Scandicus normalization is
unchanged. A focused test deletes every index of every bounded compound
contour (steps 1–3) with every surviving mark (all horizontal episemata, each
vertical-episema mask and a final mora). Every normalized result renders.

**Proposed separate follow-up (not done here):** decide whether the extended
five-note Scandicus should receive the same left-of-ink fallback, now safe
under the left-edge invariant, or another rule. This changes existing
derived output for those states, so it needs its own owner decision.

**Existing geometry:**
[`existing-geometry-baseline.mjs`](existing-geometry-baseline.mjs) compares
every pre-existing kind with master `5c24857`:

- valid contours with steps of ±1..3 and unisons;
- every supported form and mora scope;
- the full episema matrix for one- to three-note kinds, and empty, full and
  single-note masks for longer kinds.

The cases were compared both before and after the vertical-episema fallback:

- 194,830 cases in each tree;
- 72 exceptions in both, already present on master and unchanged;
- identical output, SHA-256
  `8cddd271325fe0b4d1dfbc8d9bf3382c5afe27e3838eb10bb3385c2b04f27e8e`.

**Editor rendering:** `editor-engraving.png` is the browser driver's
1440px Chromium capture of the fixture. It shows Torculus resupinus with a
B flat, horizontal and vertical episemata and a final mora, then Porrectus
flexus, Scandicus flexus, Climacus resupinus and a Torculus resupinus with
nonadjacent unisons. Compare it qualitatively with `gregorio-cases.png` and
the Liber crops. No measured typographic match is claimed.

### Verification at `d15d2ef` (clean tree)

**Repository gate:** `npm run format:check`, `npm run lint`, `npm test` (89
files, 1,976 tests), `npm run build`, `git diff --check` and
`npm run test:verify-runner` (28 tests, after adding the manifest entry) all
passed.

**Browsers:** one runner invocation of the new driver and every genuinely
affected driver, in both browsers. Environment:

- headless Chromium 157.0.8103.38 (CDP) and Firefox 146.0 (BiDi), production
  preview for preview drivers;
- run directory `.verification-runs/run-2026-11-14T06-18-27-903Z-xqrhYk`
  (local, git-ignored).

Result: **27 passed, 0 failed, 1 expected unsupported** (`clefs` is
Chromium-only); wall clock 445 s at concurrency 2.

Drivers run:

- `compound-directional-neumes` (new) and `extended-scandicus-climacus`;
- `pes-subpunctis`, `repeated-note-neumes`, `note-modifiers`, `note-shapes`;
- `b-accidentals`, `b-accidentals-acceptance`, `local-persistence`,
  `bundled-example`;
- `vertical-episemata`, `vertical-episemata-context`, `clefs`,
  `mid-score-clefs`.

Earlier runs on the uncommitted tree failed 10 jobs, all on deliberate
contract changes, which the existing drivers were updated for:

- Scandicus/Climacus menu End now reaches the named compound figure;
- saves now write v9;
- "unknown version" probes used 9 and now use 10.

No engraving, interaction or persistence code changed to make a driver pass.

The new driver covers, at 1440px and 320px:

- all six split families: keyboard browse to each named figure, Escape and
  Tab, menus inside the viewport, cross-menu switching with at most one menu
  open, and one Tab stop;
- dismiss-only score click, then I/T recall;
- exact ghosts and repeated one-click placement of all four kinds with
  distinct IDs;
- centre-point hit ownership of all 16 constituents, and pointer selection of
  both ends of each stroke after natively dismissing note properties
  (Maintenance C);
- labels; None/Final mora only; disabled Form; episemata; B ownership;
- move rejection with its announcement, a valid move and whole-neume
  transposition;
- contour normalization keeping marks, B and lyric, with exact undo/redo;
  mark and B removed with their owner; equal-survivor rejection;
- v9 reload, export and import, and v8 rejection;
- wrapping.

**Not run (left to the owner's comprehensive matrix):** the lyric drivers
(`continuous-lyrics`, `lyric-move`, `vowel-alignment`, `lyric-spacing`,
`lyric-spacing-selection-cue`), `word-composition` and `divisions`. These
dev-fixture drivers address palette buttons by `data-tool` and do not
exercise the changed kinds or versions. The Firefox `mid-score-clefs`
intermittency remains unresolved, although it passed here.

**Limitations:**

- headless only, so there is no foreground focus, real OS/browser zoom,
  native popup/IME or spoken screen-reader verification;
- no measured typographic comparison;
- no performance benchmark;
- neume ledger lines remain absent;
- the mora policy rests on analogy and Gregorio, not marked print.

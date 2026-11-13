# Stage 9B-1: Pes subpunctis implementation record

Status: **implemented, in review, mora gate open.** Implemented under the
committed [plan](../../plans/stage-9b1-pes-subpunctis.md) and the **Proposed**
[ADR 0023](../../adrs/0023-bounded-tuple-union-for-pes-subpunctis.md). Mora is
**provisionally none-only** and the PR must not merge until the owner resolves
the [mora gate](#mora-gate).

## What is implemented

- One explicit `pes-subpunctis` kind with a bounded union of four/five-note
  tuples (p0 < p1 > p2 > p3 (> p4)); the name derives from cardinality.
- Two entry variants (`pes-subbipunctis`, `pes-subtripunctis`) behind a Podatus
  split control. The reviewed Stage 9A split-menu lifecycle was generalized
  into `NeumeFamilyMenu`, now shared by the Punctum and Podatus families.
- Five note IDs allocated once at the interaction boundary, shared by every
  insert path, including Insert before/after a clef.
- Contour-aware movement and deletion normalization (five to four, four to
  Torculus/Climacus, otherwise rejected with an announcement).
- Podatus plus detached Climacus diamonds, with disjoint pointer regions.
  Climacus output was verified byte-identical after the shared tail extraction
  (4,000 cases recorded before and after the refactor).
- Independent horizontal/vertical episemata on every note; length-aware mora
  indexes; provisional none-only mora.
- Strict native v7; exact v1–v6 readers reject the kind.

## Reference evidence

`comparison.png` (regenerate with
`node docs/verification/pes-subpunctis/render-comparison.mjs <driver-output-dir>`,
which requires ImageMagick) combines, without redrawing notation:

| Source                                                                                                | Crop                                            | Finding                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mocquereau, _A Study of Gregorian Musical Rhythm_, printed p. 154, Fig. 37 no. 21 (PDF page 156)      | `mocquereau-fig37-21.png`                       | Two pes subbipunctis forms: the first with a B-flat before the apex, the second with a **dot after the final diamond**; the transcription lengthens only that final note.                            |
| Same, Fig. 38 no. 24                                                                                  | `mocquereau-fig38-24.png`                       | Pes subtripunctis: Podatus and three detached descending diamonds.                                                                                                                                   |
| Sister Demetria, _Basic Gregorian Chant_ (1960), printed p. 57, Ex. 88 (In Monte Oliveti)             | `demetria-p57-ex88.png`                         | Both counts beside neighboring neumes and lyrics; first diamond immediately right of the pes; no mora on any pes subpunctis tail (the final dot belongs to a separate neume).                        |
| Same, Ex. 89 (Gloria I)                                                                               | `demetria-p57-ex89.png`                         | Pes subtripunctis with vertical episemata under tail diamonds; no mora.                                                                                                                              |
| _Liber Usualis_ (1961), p. 46, Kyrie XI (Orbis factor), Christe; GregoBase id 2982 GABC `kv.jkJH'Gh.` | `liber-p46-christe.png`                         | `jkJH'G` is printed as a pes with an adjacent first diamond, then a wider gap before the lower H (ictus below) and G. The preceding dotted virga and following dotted square remain separate neumes. |
| Same, last Kyrie; GABC `d.gv.fgFD'Cd.`                                                                | `liber-p46-last-kyrie.png`                      | `fgFD'C`: same construction, ictus under D, wider gap for the skip F→D.                                                                                                                              |
| Gregorio 6.0.0 / Greciliae: `cases.gabc`, `comparison.tex`                                            | `gregorio-cases.png`, `gregorio-mora-cases.png` | Independent rendering of default contours, line/space, wider intervals, both Kyrie fragments, final mora, final-two, and episemata.                                                                  |
| Editor, Chromium 1440px (`browser-check.mjs` `engraving-1440.png`)                                    | `editor-engraving.png`                          | Both counts, line/space, a wide interval, both Kyrie fragments with ictus, all sign kinds, a B-flat, neighbors, lyrics and multi-system wrapping.                                                    |

Reproduce the Gregorio images by compiling `cases.gabc` with `gregorio`, then
running `lualatex` twice on `comparison.tex` with GregorioTeX available (the
Stage 8C/8D extracted tree, `TEXMFHOME=/tmp/chant-custos-tex/usr/share/texlive/texmf-dist`
and `TEXMFVAR=/tmp/chant-custos-tex-cache`, was used).

The editor reuses the original project Podatus and Climacus diamond geometry.
No font outline is copied. The comparison is **qualitative**: it supports the
Podatus-plus-detached-diamonds profile, the tight first diamond, wider gaps on
skips and the ictus placement. It is not a measured typographic match. Measured
claims (byte-identical Climacus, reuse of Podatus ink, disjoint hit regions,
ghost/commit parity) come from the automated tests.

### Kyrie XI scope

Only the five-note fragments `jkJH'G` and `fgFD'C` are represented, each as one
Pes subtripunctis. The surrounding notes of those syllables remain separate
neumes. Intra-syllable spacing/fusion and the complete Kyrie are out of scope;
this record makes no claim that the full syllables or the Kyrie are supported.
Licensing: the crops are short documentation excerpts like earlier stages'
records. No new example score was bundled.

## Mora gate

The plan requires sourced, unambiguous patterns before enabling any new mora.

| Pattern       | Printed evidence found                                                                              | Gregorio rendering                                                                                                                                           | Proposal                  |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| None          | All examples                                                                                        | n/a                                                                                                                                                          | Allow (implemented)       |
| Final note    | Mocquereau Fig. 37 no. 21 (dot after the final diamond; the transcription lengthens only that note) | `fhGF.`, `fiHGF.`: one dot right of the last diamond, unambiguous ownership                                                                                  | **Proposed for approval** |
| Final two     | None found in Mocquereau, Demetria or the Kyrie XI page                                             | `fhG.F.`, `fiHG.F.`: auctum-duplex column after the last diamond; the upper dot sits inside the descending stagger, so ownership is less clear than in print | Unresolved, keep disabled |
| Earlier notes | None                                                                                                | Not investigated (out of scope)                                                                                                                              | Not allowed               |

Implementation state: commands, contextual UI and native decoding accept only
`none`. `moraIndexes` is length-aware, so enabling `final` would be a one-line
change to `moraChoices('pes-subpunctis')`. `pes-subpunctis-geometry.test.ts`
already checks that a final-note dot is placed right of the last diamond, as
evidence only.

**Owner decision requested:** (1) keep none-only, or (2) approve {none, final}
based on Mocquereau Fig. 37 and Gregorio. Final-two stays out without further
printed evidence either way. ADR 0018 and ADR 0023 will record the decision.

## Actual verification (2026-11-13)

Repository gate: `npm run format:check`, `npm run lint`, `npm test` (85 files,
1,794 tests) and `npm run build` passed.

Browsers: headless Chromium 157 (CDP, port 9250) and Firefox 146 (BiDi, port
9251), disposable profiles, production `vite preview` of the same build on
127.0.0.1:4176, drivers run sequentially. Stale headless browsers from earlier
sessions held the default ports, so dedicated ports were used. Firefox refuses
port 4190, so the preview moved to 4176.

| Driver                                         | Chromium | Firefox |
| ---------------------------------------------- | -------- | ------- |
| `pes-subpunctis/browser-check.mjs`             | pass     | pass    |
| `repeated-note-neumes/browser-check.mjs`       | pass     | pass    |
| `b-accidentals/browser-check.mjs`              | pass     | pass    |
| `b-accidentals/acceptance-browser-check.mjs`   | pass     | pass    |
| `bundled-example/browser-check.mjs`            | pass     | pass    |
| `local-persistence/browser-check.mjs`          | pass     | pass    |
| `note-modifiers/browser-check.mjs`             | pass     | pass    |
| `note-shapes/browser-check.mjs`                | pass     | pass    |
| `vertical-episemata/browser-check.mjs`         | pass     | pass    |
| `vertical-episemata/context-browser-check.mjs` | pass     | pass    |

The existing drivers' current-version assertions and future-version probes
were bumped by one (6→7, 7→8), as Stage 9A did for 5→6. No other driver logic
changed except a stale diagnostic selector in the Stage 9A driver.

The Stage 9B-1 driver covers, at 1440px and 320px: the Podatus menu (open,
ArrowDown, Escape back to the chevron, Tab dismissal, aria-expanded/checked and
the active-variant name); the menu staying inside the viewport; primary
Podatus re-arming plain Podatus with the menu open, closing it and keeping
primary focus; cross-menu switching with at most one menu open and no score
edit; dismissal-only score clicks restoring chevron focus, then I and T; exact
ghosts (Podatus body plus each diamond) and repeated one-click placement of
both variants with distinct IDs; T focusing the chevron without arming
Podatus; I recall of the exact count; keyboard Right Arrow/Enter/End/Home/
ArrowDown/Enter selection; v7 reload, export, import and rejection of a v6
file containing the kind; centre-point pointer ownership of every note of
three groups; the disabled mora select and its explanation; episemata on the
ictus; B ownership on a contour that revisits B; rejected and accepted single
moves; whole-group transpose; Climacus normalization with undo/redo; a rejected
first-note deletion with its announcement; specimens and wrapping without
horizontal overflow and with one toolbar Tab stop.

At 320px the open Punctum menu covers the wrapped Podatus chevron (as Stage 9A
recorded). The driver detects this and switches families by keyboard (Escape,
then Enter on the Podatus chevron). Headless Firefox emits no blur for
programmatic `focus()`, so Escape is used rather than a focus move.

### Not performed

- Foreground owner interaction in Chromium and Firefox (real pointer, real
  keyboard focus behavior outside automation).
- Actual screen-reader testing of the Podatus menu, active variant, note labels
  ("fourth note of pes subtripunctis"), disabled mora and rejection messages.
- A measured typographic comparison with the printed sources.
- `lyric-anchors` / `lyric-move` (pre-existing failures recorded in Stage 9A),
  dev-server clef/division drivers and the optional legacy-build check.

## Remaining limitations

- Mora is provisionally none-only; the gate above is open.
- Extended Scandicus/Climacus, other subpunctis families, intra-syllable
  fusion, liquescence, GABC interchange and the complete Kyrie XI remain later
  work.
- Older builds cannot read v7 files, including files without the new kind.

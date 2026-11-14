# Stage 9B-1: Pes subpunctis implementation record

Status: **implementation-complete and owner-accepted (2026-11-13)** in PR #75
at `0e521b6`, under the committed
[plan](../../plans/stage-9b1-pes-subpunctis.md) and
[Accepted ADR 0023](../../adrs/0023-bounded-tuple-union-for-pes-subpunctis.md).
The owner approved the bounded-tuple design and the none/final mora matrix on
2026-11-13 ([mora decision](#mora-gate)). See
[owner acceptance](#owner-acceptance-2026-11-13) for its basis and the checks
not performed.

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
  indexes; owner-approved none/final-note mora.
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

Resolved by the owner on 2026-11-13: **none or final note** for both
cardinalities. Final-two and every other nonempty subset are deferred until
there is sufficient historical evidence and unambiguous engraving.

| Pattern       | Printed evidence found                                                                              | Gregorio rendering                                                                                                                                           | Decision |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| None          | All examples                                                                                        | n/a                                                                                                                                                          | Allowed  |
| Final note    | Mocquereau Fig. 37 no. 21 (dot after the final diamond; the transcription lengthens only that note) | `fhGF.`, `fiHGF.` and the marked cases in `marked.gabc`: one dot right of the last diamond, unambiguous ownership                                            | Allowed  |
| Final two     | None found in Mocquereau, Demetria or the Kyrie XI page                                             | `fhG.F.`, `fiHG.F.`: auctum-duplex column after the last diamond; the upper dot sits inside the descending stagger, so ownership is less clear than in print | Deferred |
| Earlier notes | None                                                                                                | Not investigated (out of scope)                                                                                                                              | Deferred |

**Strength of evidence differs by cardinality.** The four-note form has a
direct printed example (Mocquereau Fig. 37 no. 21). No printed five-note
example with a final mora was found in the sources examined. The five-note
form is allowed by the same final-note convention: Gregorio renders it with
identical, unambiguous ownership (`fiHGF.`, `eiHGE.`, `jkJH'G_.`, `fgFD'C.`),
and the editor uses the same descending-tail construction and sign placement
for both counts.

Implementation: `moraChoices('pes-subpunctis')` offers None and Final note.
The final note is derived from the actual tuple length (index 3 or 4), and the
mark belongs to that stable note ID. Commands and native decoding reject every
other subset. Deleting an earlier note keeps a surviving final mora on its own
note (in the resulting Pes subpunctis, Torculus or Climacus); deleting the
marked note removes the mora and never transfers it to the new final note.

`gregorio-marked.png` (`marked.gabc`, `marked.tex`) and `editor-marked.png`
compare marked groups of both counts, including a final mora combined with
episemata and the Kyrie ictus. Both place the dot after the last diamond in
that note's row. Episema placement details differ qualitatively, for example
whether a Podatus episema sits above or below.

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

## Review revision: approved mora and coverage (2026-11-13)

After the owner's review of `be79a1e`:

- **Mora:** None and Final note are enabled (see [mora decision](#mora-gate)).
- **Pure tests:**
  - `domain/pes-subpunctis.test.ts` checks every mora subset of three contours
    against an independent rule (valid iff empty or only the last note);
  - scope and per-note edits;
  - movement, transposition, deletion of earlier and marked notes (five to
    four, and four to Climacus/Torculus), rejected survivors, one-entry
    history with exact undo, and v7 round trip with v2–v6 rejection.
- **Exhaustive modifier geometry:** `layout/pes-subpunctis-geometry.test.ts`
  renders every horizontal/vertical episema combination × final mora on/off
  for eight contours (11,776 geometries): `[2,4,3,2]`, `[1,3,2,1]`,
  `[0,4,2,-1]`, `[2,5,4,3,2]`, `[1,4,3,2,1]`, `[5,9,8,6,3]` and both Kyrie
  fragments. For each, it checks:
  - unchanged notation ink;
  - exact sign counts by type;
  - per-note modifier ownership: horizontal episemata on their own note,
    vertical episemata within ±15 units, the dot right of the final diamond
    in its row;
  - all ink inside the measured bounds;
  - no exceptions.

  This replaces the earlier sampled (step 7) five-note loop.

- **Browser driver additions:**
  - the Mora scope options are exactly None/Final note and enabled;
  - a Final note scope edit, then deleting an earlier note (mora kept on
    `p-3` in the resulting Climacus) with undo/redo;
  - deleting the marked note (Torculus with no mora);
  - a five-note final mora combined with the ictus, persisted across reload;
  - marked specimens;
  - five-note insertion through both "Insert Pes subtripunctis before/after
    clef" controls, with distinct IDs and correct clef anchoring.
- **Clef/division drivers** (dev server; port-substituted copies, 9230→9250
  and 5173→5180, otherwise unedited):

  | Driver            | Chromium | Firefox               |
  | ----------------- | -------- | --------------------- |
  | `clefs`           | pass     | n/a (CDP-only driver) |
  | `mid-score-clefs` | pass     | pass                  |
  | `divisions`       | pass     | pass                  |

An earlier attempt at these drivers was interrupted when the host laptop
suspended mid-run. After a clean restart of servers and browsers, each driver
ran separately with its own log and hard kill, and all passed.

Repository gate after the revision: `format:check`, `lint`, `npm test` (85
files, 1,801 tests) and `build` passed. Preview regression results:

All 20 runs passed on the revised build: the `pes-subpunctis`,
`repeated-note-neumes`, `b-accidentals` (both), `bundled-example`,
`local-persistence`, `note-modifiers`, `note-shapes` and `vertical-episemata`
(both) drivers, each in headless Chromium 157 and Firefox 146 against the
production preview, run sequentially with per-driver logs and a 10-minute hard
kill.

Observation: in same-word continuations the existing word-compaction policy
(ADR 0011) places the next neume close after a trailing mora dot. A layout
probe showed identical gaps for Climacus and Pes subpunctis with and without
a final mora, so this is existing uniform behavior, not a new rule.

### Not performed

- Foreground owner interaction in Chromium and Firefox (real pointer, real
  keyboard focus behavior outside automation).
- Actual screen-reader testing of the Podatus menu, active variant, note labels
  ("fourth note of pes subtripunctis"), the None/Final note mora control and
  rejection messages.
- A measured typographic comparison with the printed sources.
- `lyric-anchors` / `lyric-move` (pre-existing failures recorded in Stage 9A)
  and the optional legacy-build check. The dev-server clef, mid-score-clef and
  division drivers were not part of the initial run; they were run and passed
  in the review revision above.

## Owner acceptance (2026-11-13)

The owner accepted the final review of PR #75 at `0e521b6`. Acceptance rests
on the automated verification recorded above (repository checks, pure and
exhaustive geometry tests, and the Chromium/Firefox drivers) and on the
qualitative historical comparisons in `comparison.png`. It does not rest on
any of the following, which were **not performed**; no claim is made that
they passed:

- Foreground browser interaction by the owner.
- Actual screen-reader testing.
- A measured typographic comparison with the printed sources.

## Follow-up maintenance

The pre-existing `lyric-anchors` and `lyric-move` driver failures (recorded in
Stage 9A) remain out of scope. Repair or retire those drivers in separate
maintenance work.

## Remaining limitations

- Final-two and earlier-note morae are deferred (owner decision).
- Extended Scandicus/Climacus, other subpunctis families, intra-syllable
  fusion, liquescence, GABC interchange and the complete Kyrie XI remain later
  work.
- Native v7: exact v1–v6 readers reject the new kind, and older builds cannot
  read v7 files, including files without the new kind.

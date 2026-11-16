# Stage 11B — dynamic vertical system layout: implementation record

Branch `feat/dynamic-vertical-layout`, target `master`, base `3d5a93f`
(PRs #91 and #92 merged). Implements the
[Stage 11B plan](../../plans/stage-11b-dynamic-vertical-layout.md) under
[ADR 0028](../../adrs/0028-compose-before-vertical-lyric-clearance.md). The
contract is owned by
[layout and rendering](../../layout-and-rendering.md#dynamic-vertical-system-layout-stage-11b)
and [engraving metrics](../../engraving-metrics.md#vertical-system-metrics-stage-11b).

## Acceptance fixture

The bundled
[Dominican Salve Regina](../../../src/editor/examples/Salve-Regina-Dominican.chant.json)
(unchanged bytes). Its only off-staff note is the punctum at -3 on _Je_ of
_Et Jesum_ (ledger at -2). Before (Stage 11A, historical):
[`../neume-ledger-lines/et-jesum-1440.png`](../neume-ledger-lines/et-jesum-1440.png),
where the low A overlaps its lyric. After (this stage, Firefox 1440 px):

![Et Jesum at 1440px: the low A and its ledger clear the lowered shared lyric row; neighbouring systems keep ordinary spacing](et-jesum-1440.png)

Je's system grows by 10 units (ink bottom 167 → baseline 190 in local
units); its staff does not move; every later system moves down 10 units;
every other system keeps height 220 and baseline 180. Kyrie XI and all other
ordinary layout snapshots are unchanged.

## Implementation summary

- `src/editor/layout/system-vertical-layout.ts` (new, pure): vertical
  constants, `measureSystemVertical` (clamped musical extent, top expansion,
  shared baseline, bottom) and `stackSystems` (score-absolute frames).
- `layout-chant.ts`: the walker composes every system in the canonical
  frame; `layoutChant` measures each system's complete musical ink
  (`positionedMusicInk`), stacks, then translates each composed system with
  `positionComposedSystem` (see [geometry rebuilding](#final-position-geometry-rebuilding)).
  Systems expose
  `bottomStaffY`, `lyricBaselineY` and `musicBand`; lyrics and hyphens use
  the system baseline; the vertical canvas is the stacked systems.
- Removed lyric-dependent accidental exclusions: `AccidentalLyricBox` and its
  parameter (`neume-geometry.ts`, `accidental-geometry.ts`), the
  preceding-lyric accidental shift, `lyricBandAccidentals` reservations and
  `continuationHyphenLeft` obstacles (hyphens are now centred in the text
  gap). Musical clearance, ledger-stroke clearance, default prefixes,
  explicit placement and anchors are unchanged. No callers remained.
- `ScoreSvg.tsx`: per-system render band (`renderBandFor(system.musicBand)`)
  for ledger runs and outlines, a per-system `clipPath` on a new
  `.score__system-music` group (staff, clefs, custodes, neumes, signs,
  divisions and their pointer regions; lyrics and hyphens stay outside), the
  remote-placement caption 12 units above the system bottom, and
  `data-system-top`, `data-system-height`, `data-lyric-baseline`,
  `data-music-top`, `data-music-bottom` for drivers.
- `SyllableControls.tsx`: the floating lyric entry sits 24 units above the
  system's `lyricBaselineY` (formerly `system.y + 156`).

## Final-position geometry rebuilding

An earlier working revision re-ran the whole horizontal walker at the
resolved origins and threw if system membership differed. That check covered
membership only (system count, `startNeumeIndex`, group count), and it could
plausibly be triggered by a valid document: builders make y-overlap decisions
(sign versus ink, ledger strokes level with a sign) that can round
differently after translation at safe-integer coordinates, which could change
a width and then a wrap. It was replaced before commit:

- The walker runs **once**, in the canonical frame. Each composed system is
  then translated **independently** (`positionComposedSystem`): every neume
  group (with its signs, ledgers and modifiers) is rebuilt through
  `buildNeumeGeometry` at its composed `bounds.x`; custodes, clef changes and
  divisions through their builders at their composed x. A system already at
  the canonical origin is reused unchanged.
- Membership, order and every horizontal decision are fixed by construction;
  there is no production invariant exception. Slots, hyphens and hit clips
  are derived once, afterwards, from the translated geometry.
- Horizontal geometry, not just membership, is tested: for every bundled
  example (measured and provisional fonts), every group rebuilt at the
  canonical origin has identical left edge, width, advance, lyric anchor,
  note anchors and sign ink x, and is displaced vertically by exactly the
  system's origin offset. Other tests show x and slots unchanged when extreme
  notes move further from the staff.
- Limitation: at safe-integer coordinates, a translated y may round so that
  a sign's collision column differs, changing that group's internal x (not
  membership). This falls under the existing extreme-coordinate policy.
- Unusual font measurements cannot affect vertical positioning beyond the
  lyric presence of a system, which does not depend on measurement.

Performance (Vitest, Node 24.12.0, median of 7 × 100 layouts after warm-up,
deterministic test metrics): bundled Salve Regina 3.33 ms on `3d5a93f` versus
3.98 ms here; Kyrie XI 0.84 ms versus 1.07 ms (about +20%, one extra builder
call per element of a translated system). Layout already runs only on
document or measurement changes.

## Consumer audit

| Consumer                                      | Assumption found                    | Result                                                    |
| --------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Walker / custodes / divisions / clefs         | `firstSystemBottomStaffY + i * 244` | Origin callback; canonical frame then resolved origin     |
| Lyric and hyphen placement                    | `180 + i * 244`                     | System `lyricBaselineY`                                   |
| Canvas                                        | `220 + (n-1) * 244`, ink ±1,200     | Stacked systems; horizontal 11A containment unchanged     |
| `resolveScoreSlot`, graphical neume placement | System `y`/`height`, staff lines    | Already derived; tested on a later system after expansion |
| Graphical clef placement, `staffPositionY`    | Staff lines                         | Already derived                                           |
| Range/neume selection outlines                | Bounds, staff lines, lyric `y`      | Already derived; now clamped to the system band           |
| Render band (`render-band.ts`)                | Whole canvas                        | Per-system `musicBand`                                    |
| Floating lyric entry                          | `system.y + 156`                    | `lyricBaselineY - 24`                                     |
| Remote placement caption                      | `system.y + 208`                    | `system.y + system.height - 12`                           |
| Focus/reveal, scroll                          | DOM rects                           | Unchanged; focus by ID verified through reflow and resize |
| Accessibility description                     | No geometry                         | Unchanged                                                 |
| Print CSS                                     | No fixed heights                    | Unchanged; PDF produced in both browsers                  |
| `canGraphicalNeumeFitNormalSystem`            | Canonical origin, width only        | Unchanged (x is origin-independent)                       |
| Browser drivers (`mid-score-clefs`, 11A, 8D)  | `244` advance, `-1200` canvas       | Updated; see below                                        |

## Exceptional geometry (clipping policy)

Measured extents are clamped to the canonical band 1,200 units beyond the
220-unit system (Stage 11A margin), so the tallest system is about 2,700
units; distant pitches never allocate pitch-proportional height. Each
system's `musicBand` translates with it; ink and pointer regions beyond it
are clipped by an SVG `clipPath`, and ledger runs/outlines are painted only
within the band plus one ledger space (compact runs, no per-level DOM).
Because everything inside the band is measured and reserved, clipped ink
never reaches lyrics or another system; opposing high/low extreme systems
are covered by unit tests and the extreme-pitch section of the 11A driver.
Semantic pitches, history, clipboard and export are unchanged; distant notes
remain keyboard-editable; arbitrary safe-integer coordinates are not claimed
to engrave faithfully. Horizontal text-relative containment, uncapped text
and outgoing-hyphen containment (PR #91) are unchanged.

## Intentional changes to existing expectations

All in `accidental-geometry.test.ts` unless noted; each changed assertion is
commented in place. Unrelated coverage was retained.

- A low natural beside its own lyric keeps its music-only position (equal to
  the syllable-free layout); the baseline moves to `ink bottom + 3 + 20`.
- A later low sign after a preceding Sanctus/Benedictus/Sanctissimus lyric
  sits at the compact melisma minimum instead of shifting past (or wrapping
  after) the lyric.
- High flat/natural: room is added above the staff in the system (staff
  moves down) instead of a negative canvas origin; also `custos-geometry`
  position 14 and the `b-accidentals` browser driver.
- A later centred lyric passes beneath earlier low accidental ink instead of
  being pushed right.
- An intervening low natural no longer forces a hyphenated continuation:
  text edges equal the unsigned layout.
- Current-group hyphen: earlier-anchor case keeps the compact A-men join
  (formerly hyphen at [162, 182], men at [196, 256]); default-prefix case
  centres the hyphen at [173, 193] with men at [206, 266] (formerly
  [173.5, 193.5] and [219, 279]). Same change in the `b-accidentals` driver.
- Hyphens below both preceding and current low signs: the split
  continuation now first occurs with 9 fillers (formerly 8); 8 fillers stay
  on one system.
- `ledger-lines.test.ts` Et Jesum: the system now grows (was fixed 220).

## Automated verification

Run on Linux x64, Node 24.12.0, Chromium 157.0.8103.38 (snap), Firefox 146.0.
Final results are recorded below in [Results](#results).

- Unit: `system-vertical-layout.test.ts` (25 tests, including per-example x-invariance) covers measurement
  formulas and exact clearance boundaries (157 → 180, 157.5 → 180.5),
  top-padding boundary, lyricless/empty systems, band clamping, stacking,
  ordinary multi-system and Kyrie XI geometry, a single expanded system and
  its successors, high ink, x/slot/membership invariance when extreme notes
  move further away, custodes/clefs/divisions in their frames, provisional
  lyrics, later-system hit mapping, slot ownership of the gap, graphical
  placement and reflow after transposition, opposing extreme systems, and the
  bundled Salve Regina (measured and provisional). `vertical-clearance.testing.ts`
  holds the shared invariants used across the layout suites.
- Browser driver `dynamic-vertical-layout` (Chromium and Firefox, 1440 and
  320 px), against the real bundled Salve Regina: actual lyric font metrics
  within the 20/5 band (accented capitals ascent 19, descenders 5); stacked
  measured systems and clipped music groups; every lyric/hyphen on its
  system baseline and below all painted ink (real text boxes); Je's ledger
  and clearance; only Je's system expanded; every neume and syllable,
  three _O_ syllables, final _ia._, the anchored _Nobis_ flat above the row;
  pointer selection and nine-step keyboard transposition on the following
  system (expands it, moves later systems, earlier systems unchanged), focus
  retained by ID through reflow and viewport resize, Undo restores bytes and
  frames; real-pointer graphical placement on that system at pitch 4 with
  ghost on its resolved staff and Undo; export equals the bundled document
  and re-import restores identical frames; print-media emulation (Chromium)
  leaves frames unchanged and a PDF is produced in both browsers. Section 7
  covers 150% CSS zoom with a clef on an expanded later system (see below).

### Updated existing drivers

- `neume-ledger-lines`: section 9 asserts the Stage 11B containment
  contract instead of the 11A canvas origin; other sections unchanged.
- `b-accidentals`: high-sign, current-group hyphen and narrow-join
  expectations as listed above; all non-overlap checks retained.
- `mid-score-clefs`: note y relative to each system's staff line (was
  `systemIndex * 244`); `click()` adds a page-scroll fallback after
  `scrollIntoView`. Evidence: with a `MAX_SAFE_INTEGER` note in the system,
  Firefox 146 scrolled the clef-control `<g>` to 59 although its client rect
  required ~1,514 (its ink path and the staff line scrolled correctly; with
  the clip disabled the result was the same). Clean master passed 4/4 runs
  and the branch failed 2/2 before the fallback. The application's focus
  reveal uses client rects and `scrollBy`, not `scrollIntoView`.
- Runner: manifest entry and the pinned full-preset pair count (44 → 46).

### Firefox `mid-score-clefs`: driver scrolling versus production behaviour

The branch-only Firefox failure was in the driver's generic `click()`, which
relies on native `scrollIntoView`. A temporary probe (identical script, run
on this branch and a detached `3d5a93f` worktree, both browsers, 1440 and
320 px, 100% and 150% CSS zoom, ordinary/high/safe-integer fixtures with a
clef change on a later system) established:

- Firefox's native `scrollIntoView` on the clef-control `<g>` already fails at
  1440 px on `3d5a93f` for ordinary systems. On the branch's tall
  safe-integer system it also fails at 320 px. Its client rect is correct in
  every case (ink path and staff-line `scrollIntoView` scroll correctly).
- The application's reveal (`focusin` → next frame → `focusAndReveal`, client
  rects and `scrollBy`; it never calls `scrollIntoView`) reveals the clef in
  expanded, high and safe-integer systems at both zooms in Chromium, on both
  trees.
- Headless Firefox never has document focus (`document.hasFocus()` false):
  focus moves (`activeElement` is the clef) but **no `focusin` is
  dispatched** (Chromium: one), so the application's reveal cannot run there
  on either tree. Firefox results in that mode reflect native focus
  scrolling only. Foreground Firefox reveal remains an owner check.
- With the clef brought into view from its client rect, a real pointer
  press at its rendered location selects it, an Arrow draft keeps focus on
  it, a transposition on its expanded system restores focus to the note by
  ID, and Undo restores the stored bytes. All of these pass in Chromium and
  Firefox, at 1440 and 320 px, at 150% zoom, for all three fixtures (driver
  section 7).

The `mid-score-clefs` fallback (page scroll from the element's client rect
after `scrollIntoView`) therefore changes only how the driver reaches its
target; production pointer targeting and focus behaviour are covered above.
The temporary probe was removed and is not committed.

### Pre-existing failures (reproduced on clean base `3d5a93f`)

Run with the unchanged runner on a detached worktree of `3d5a93f`:
`lyric-move` (Chromium, "Missing button Move syllable"), `lyric-spacing`
(Chromium), `lyric-spacing-selection-cue` (Firefox) and `word-composition`
(Chromium and Firefox, "punctum selected whole-neume cue must be clipped")
fail identically there. They are not fixed or waived here.

## Results

See the PR for the final revision; filled in after the final regression run.

## Not verified / remaining owner acceptance

No foreground browser, spoken screen-reader or physical print inspection was
performed; PDFs were generated but not visually reviewed. Owner steps: load
the Salve Regina, inspect Et Jesum and its neighbours at desktop and narrow
widths, resize, insert/select/transpose/Undo on a later system, and compare
the normal score with print preview.

# Stage 9B-2: Extended Scandicus and Climacus implementation record

Status: **implemented in a draft PR, awaiting owner review.** It follows the
committed [plan](../../plans/stage-9b2-extended-scandicus-climacus.md) and
[Proposed ADR 0024](../../adrs/0024-bounded-tuple-union-for-scandicus-and-climacus.md).
Three owner gates remain open; see the [owner checklist](#owner-checklist).

## What is implemented

- `scandicus` and `climacus` accept three-, four- or five-note strictly
  monotonic tuples (`MonotonicNotes`, built by `monotonicNotes`). No stored
  count; names derive from the length.
- Entry variants `scandicus-4/5` and `climacus-4/5` behind two new
  `NeumeFamilyMenu` split controls. Primaries always arm the ordinary
  three-note figure.
- Shared five-ID allocation covers every insertion path.
- `mapNeumeNotes` rebuilds tuples in every command and removes the old
  fallback branches that would have silently truncated a longer group to
  three notes.
- Count-aware form and mora eligibility: no forms on longer groups, and a
  provisional none-only mora matrix. The three-note matrices are unchanged.
- Deletion keeps the family from five to four and from four to three.
- Engraving:
  - Climacus extends the shared diamond tail.
  - Scandicus uses the Mocquereau Fig. 34 staircase (proposed profile).
  - Three-note output is byte-identical.
- Strict native v8; exact v1–v7 readers reject longer instances of the old
  kinds.

## Reference evidence

All crops are actual scans or actual Gregorio output; no notation is redrawn.

| Source                                                                                          | File                                  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mocquereau, _A Study of Gregorian Musical Rhythm_, printed p. 152 (PDF p. 154), Fig. 34, 600dpi | `mocquereau-p152-fig34.png`           | Note b: "The scandicus and the climacus can be made up of four, five, or even more notes." **Scandicus, 4 notes** (line 2, space, line 3, line 4 = +1 +1 +2): Pes (stacked, joined) then a Pes one column right whose upper note is a skip above, carrying the right stem; elements touch only at a corner. **Scandicus, 5 notes** (+1 +1 +1 +2): Pes, then a single Punctum, then Pes, as a staircase. **Climacus, 4 and 5 notes**: virga then three/four detached descending diamonds; wider gaps on skips. |
| Same, Fig. 32 (three-note Scandicus forms)                                                      | `mocquereau-p152-fig32-scandicus.png` | Three-note alternatives (Punctum + Pes; Pes + virga-like upper; Punctum + Pes with skip). The existing approved three-note recipes are unchanged by this stage.                                                                                                                                                                                                                                                                                                                                               |
| Sister Demetria, _Basic Gregorian Chant_ (1960), p. 40                                          | `demetria-p40-climacus.png`           | "The Climacus is a neume of three (or more) descending notes"; printed four-note Climacus "La-sol-fa-mi" (virga + three diamonds), no mora. Ex. 38 on the same page ends with a four-note Climacus carrying an ictus under an inner diamond and no mora; the dotted punctum after it is a separate neume.                                                                                                                                                                                                     |
| _Liber Usualis_ (1961), p. xxj, "Compound neums" table                                          | (not cropped)                         | Lists Pes subbipunctis, Torculus resupinus, Scandicus flexus, Porrectus flexus, Salicus flexus, Climacus resupinus. No four/five-note Scandicus or Climacus specimen in the table.                                                                                                                                                                                                                                                                                                                            |
| Gregorio 6.0.0 / Greciliae, `partition.gabc`                                                    | `gregorio-partition.png`              | Gregorio's own grouping of plain ascending GABC: `fgh` is Punctum + Pes (matches the editor's three-note form); `fghj` is Punctum + Pes + Punctum; `efghj` is Punctum + Pes + Pes. **This differs from Mocquereau's printed staircase** and is parser behavior, not evidence of a printed convention (the plan's warning).                                                                                                                                                                                    |
| Gregorio, `staircase-and-mora.gabc`                                                             | `gregorio-staircase-and-mora.png`     | a/d: Mocquereau's staircase forced with `!` joins (`fg!hj`, `ef!g!hj`). b/e: final mora; c/f: final-two. g–l: Climacus `iHGF`, `kJIHG` unmarked, final mora, final-two. m/n: episemata.                                                                                                                                                                                                                                                                                                                       |
| Editor, Chromium 1440px (`browser-check.mjs` `engraving-1440.png`)                              | `editor-engraving.png`                | Three-note ordinary and quilismatic Scandicus, both Fig. 34 contours, stepwise/skip/mixed four- and five-note Scandicus, Demetria's four-note Climacus, skip/mixed Climacus, signs on every family, a B-flat on a later constituent, lyrics and wrapping.                                                                                                                                                                                                                                                     |

Reproduce the Gregorio images by compiling both `.gabc` files with `gregorio`,
then running `lualatex` twice on a wrapper like
`../pes-subpunctis/comparison.tex` (staff size 24). The GregorioTeX tree used
was the Stage 8C/8D extract
(`TEXMFHOME=/tmp/chant-custos-tex/usr/share/texlive/texmf-dist`).

**Repertoire search.** No printed chant specimen with a four- or five-note
Scandicus was located in the sources examined in this session (Mocquereau
p. 152, Liber p. xxj, Demetria pp. 39–40). Demetria's four-note Climacus is an
exercise specimen. Kyrie XI and the Requiem Gradual were not re-examined for
these figures, and no claim is made about any full chant.

### Engraving decision (owner gate 1)

- **Climacus (unambiguous):** virga + one detached diamond per later note,
  reusing the approved helpers. Mocquereau and Demetria both print this. The
  editor's first three heads are byte-identical to the three-note Climacus.
- **Scandicus (proposed):** the only printed construction found is
  Mocquereau's staircase, one figure per count: four notes = Pes + Pes, five
  notes = Pes + Punctum + Pes. The editor reuses the approved Podatus and
  Punctum in successive 12-unit columns.
  - It is not a chain of three-note Scandicus glyphs, adds no connector, and
    implies no salicus, oriscus, quilisma, liquescence or new rhythm.
  - The grouping does not depend on intervals: Fig. 34 shows the same
    grouping for its stepwise-then-skip contours, and no source showing
    other groupings was found.
  - Gregorio's partition (Punctum first) is the main alternative. It was not
    adopted because it is parser output, not a printed convention.

  Comparison is **qualitative**; no measured typographic match is claimed.

## Mora gate

Owner gate 2. Implemented provisionally as **none-only** for four- and
five-note groups; three-note groups keep none/final/final-two unchanged.

| Family / length | Pattern   | Direct printed evidence                            | Analogy                                                                                                                          | Gregorio                                                                                                                                                                                                      | Proposal |
| --------------- | --------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Climacus 4/5    | None      | Demetria p. 40 (both examples), Mocquereau Fig. 34 | –                                                                                                                                | –                                                                                                                                                                                                             | Allow    |
| Climacus 4/5    | Final     | **None found**                                     | Same descending-diamond tail and final-dot placement as the owner-approved Pes subpunctis final mora (Mocquereau Fig. 37 no. 21) | `iHGF.`, `kJIHG.`: one dot right of the last diamond in its row; unambiguous                                                                                                                                  | Allow    |
| Climacus 4/5    | Final two | None found                                         | Pes subpunctis final-two was deferred for the same tail                                                                          | `iHG.F.`, `kJIH.G.`: the upper dot sits inside the descending stagger, between the last two diamonds; ownership less clear                                                                                    | Defer    |
| Scandicus 4/5   | None      | Mocquereau Fig. 34                                 | –                                                                                                                                | –                                                                                                                                                                                                             | Allow    |
| Scandicus 4/5   | Final     | **None found**                                     | The final element is an approved Podatus; Podatus "second note" is an established pattern                                        | `fg!hj.`, `ef!g!hj.`: one dot right of the top note; unambiguous                                                                                                                                              | Allow    |
| Scandicus 4/5   | Final two | None found                                         | The final two notes are exactly the final Podatus; Podatus "both" (auctum duplex) is established                                 | `fg!h.j.`, `ef!g!h.j.`: stacked pair right of the final Pes, clear in Gregorio. Plain GABC `fgh.i.` (Gregorio's own partition) instead puts the lower dot between elements, so the result depends on grouping | Defer    |
| Either          | Earlier   | None                                               | –                                                                                                                                | Not investigated                                                                                                                                                                                              | Defer    |

**Proposed matrix for owner approval:** none or final note for both families
and both lengths. The final note is the last note of the actual tuple; the mark
stays on that stable note ID through deletion of earlier notes and is removed,
never transferred, when its note is deleted. Final-two is deferred for both.
Scandicus final-two has the strongest analogy, but it has no printed example
and its rendering depends on the grouping profile, which is itself a gate.

The final-note proposal rests on analogy plus unambiguous Gregorio rendering,
**not** on a direct printed example. The owner may prefer to keep none-only.
Enabling the proposal is a one-line change in `moraChoices`, plus tests and a
browser check.

## Proposed ADR 0023 amendment (owner gate 3)

Not applied; the accepted rejection is still implemented and tested.

Proposal: deleting a Pes subtripunctis constituent that leaves four strictly
descending notes normalizes to a four-note Climacus. This applies to deleting
the first note, and to deleting the apex when the survivors strictly descend.
The neume ID, survivor IDs, order, episemata, B ownership and anchors are
preserved. A retained final mora must be legal for a four-note Climacus;
otherwise the deletion is rejected rather than the mark being discarded:

- under the current none-only matrix, a marked case still rejects;
- under the proposed final-note matrix, it would normalize.

Equal adjacent survivors stay rejected, and no other normalization rule
(including the equal-outer-note Torculus/Porrectus cases) is broadened.
Evidence: the survivors satisfy the Climacus contour exactly, as printed
(Demetria p. 40, Mocquereau Fig. 34). The change keeps identity and marks
rather than forcing the author to delete and re-enter the group.

## Three-note preservation (measured)

A detached `master` worktree (`a2111bf`) and this branch each ran the same
temporary Vitest dump (not committed). It produced SHA-256 hashes of the full
`buildNeumeGeometry` JSON for:

- Scandicus (ordinary and with quilisma) and Climacus;
- first pitch −4..8 and both intervals 1–4;
- every mora scope (none/final/final-two) and all 8 × 8 horizontal × vertical
  episema masks.

That is **119,808 cases**. The two outputs were byte-identical (file SHA-256
`991e50b6…6600`), with zero exceptions. The three-note recipes and dispatch
are untouched; the new recipe is selected only for length > 3.

## Actual verification

Repository gate: `npm run format:check`, `npm run lint`, `npm test` (87
files, 1,893 tests) and `npm run build` passed.

### Browser results

Environment:

- headless Chromium 157 (CDP, port 9260) and Firefox 146 (BiDi, port 9261),
  each with a disposable profile;
- the production `vite preview` of the same build on 127.0.0.1:4177;
- drivers run sequentially with per-run logs and a 10-minute hard kill.

Every log ends in its driver's success report:

| Driver (preview)                            | Chromium | Firefox |
| ------------------------------------------- | -------- | ------- |
| `extended-scandicus-climacus/browser-check` | pass     | pass    |
| `pes-subpunctis/browser-check`              | pass     | pass    |
| `repeated-note-neumes/browser-check`        | pass     | pass    |
| `b-accidentals/browser-check`               | pass     | pass    |
| `b-accidentals/acceptance-browser-check`    | pass     | pass    |
| `bundled-example/browser-check`             | pass     | pass    |
| `local-persistence/browser-check`           | pass     | pass    |
| `note-modifiers/browser-check`              | pass     | pass    |
| `note-shapes/browser-check`                 | pass     | pass    |
| `vertical-episemata/browser-check`          | pass     | pass    |
| `vertical-episemata/context-browser-check`  | pass     | pass    |

The clef and division drivers ran on a dev server on 127.0.0.1:5180, using
port-substituted copies (9230→9260, 5173→5180) that are otherwise unedited:

| Driver (dev server) | Chromium | Firefox                             |
| ------------------- | -------- | ----------------------------------- |
| `clefs`             | pass     | n/a (CDP-only driver)               |
| `mid-score-clefs`   | pass     | 1 failure, then 2 passes (see note) |
| `divisions`         | pass     | pass                                |

Note: the first Firefox `mid-score-clefs` run failed one assertion (no clef
inserted by a pointer click at 150% CSS zoom; line 1032). Two unchanged
reruns passed. That path uses no Scandicus/Climacus code. The failure is
recorded as intermittent, not as a pass. It was not investigated further or
compared against master.

Existing driver changes: only the current-version assertions and
future-version probes were bumped by one (7→8, 8→9), as Stage 9B-1 did.

The Stage 9B-2 driver exercises:

- **Menus:** both split menus open, ArrowDown, Escape back to the chevron,
  Tab dismissal, aria-expanded/checked and the active-variant name; menus stay
  inside the viewport at 1440px and 320px.
- **Primary reset:** the primary re-arms the ordinary figure with the menu
  open.
- **Cross-menu switching:** around all four families, with at most one menu
  open (by keyboard where a wrapped menu covers a chevron).
- **Dismissal:** a score click only dismisses, then I and T work.
- **Placement:** exact ghost ink (2/3 Scandicus elements, 4/5 Climacus parts)
  and repeated one-click placement of all four variants with distinct IDs;
  T/I recall; keyboard End/Home/ArrowDown/Enter selection.
- **Quilisma:** the ordinary quilismatic Scandicus is unchanged, and the
  primary resets it.
- **Persistence:** v8 reload, export and import; a v7 file containing a
  four-note Scandicus is rejected.
- **Hit ownership:** the centre of every constituent of four- and five-note
  groups and of a quilismatic three-note group is owned by that note.
- **Labels and controls:** count-aware note labels; None-only Mora and a
  disabled Form select on longer groups, with the three-note matrix and
  quilisma intact.
- **Marks:** episemata; a B on a later Climacus constituent.
- **Moves:** rejected moves announce the strict-direction rule; a valid move;
  whole-group transpose.
- **Deletion:** 5→4→3→2 with undo/redo; Climacus 5→4.
- **Clef-boundary Insert:** five-note insertion through Insert before/after
  for both families.
- **Specimens:** wrapping without horizontal overflow, with one toolbar Tab
  stop.

## Not performed

- Foreground owner interaction in Chromium and Firefox.
- Actual screen-reader testing of the new menus, count-aware labels, the
  disabled Form/Mora controls and the rejection messages.
- A measured typographic comparison with the printed sources.
- `lyric-anchors` / `lyric-move` (pre-existing failures, separate maintenance).

## Owner checklist

1. Approve, or change, the extended Scandicus staircase profile
   (Pes + Pes; Pes + Punctum + Pes, interval-independent).
2. Approve the mora matrix for four- and five-note groups (proposed: none +
   final note for both families; final-two deferred), or keep none-only.
3. Approve, or decline, the ADR 0023 amendment (Pes subtripunctis → four-note
   Climacus on deletion).
4. Review the qualitative comparisons and the automated results; then mark
   ADR 0024 Accepted.

## Remaining limitations

- Neume ledger lines remain absent for every kind (existing limitation), which
  affects the outer notes of long groups far off the staff.
- No lengths beyond five, no other compound directions, no authored forms on
  longer groups, no intra-syllable fusion, GABC interchange or playback.
- Native v8: older builds cannot read v8 files, including files without longer
  groups.

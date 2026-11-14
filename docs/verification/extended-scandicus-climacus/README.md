# Stage 9B-2: Extended Scandicus and Climacus implementation record

Status: **implemented in PR #76; ADR 0024 Accepted.** It follows the committed
[plan](../../plans/stage-9b2-extended-scandicus-climacus.md) and
[Accepted ADR 0024](../../adrs/0024-bounded-tuple-union-for-scandicus-and-climacus.md).
On 2026-11-13, after review of `34e7bb7`, the owner approved:

1. the Scandicus staircase as the initial profile;
2. `{none, final}` mora for four- and five-note groups;
3. the ADR 0023 amendment.

See [owner decisions](#owner-decisions-2026-11-13). Final review of the PR is
pending.

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
- Count-aware form and mora eligibility: no forms on longer groups, and
  exactly none or final note for their mora. The three-note matrices are
  unchanged.
- Deletion keeps the family from five to four and from four to three. Pes
  subtripunctis deletion that leaves four strictly descending notes becomes a
  four-note Climacus (ADR 0023 amendment).
- Engraving:
  - Climacus extends the shared diamond tail.
  - Scandicus uses the Mocquereau Fig. 34 staircase (approved initial profile).
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
| Gregorio, `marked.gabc`                                                                         | `gregorio-marked.png`                 | Marked counterparts of the editor's marked specimens: `fg!hj.` (4-note Scandicus, final mora), `ef!g'!hj.` (5-note, final mora, vertical episema on note 3), `jIHG.` (4-note Climacus, final mora), `kJ_IHG.` (5-note, final mora, horizontal episema on note 2).                                                                                                                                                                                                                                             |
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

### Engraving decision (approved 2026-11-13)

- **Climacus (unambiguous):** virga + one detached diamond per later note,
  reusing the approved helpers. Mocquereau and Demetria both print this. The
  editor's first three heads are byte-identical to the three-note Climacus.
- **Scandicus (approved initial deterministic profile):** the only printed
  construction found is Mocquereau's staircase, one figure per count: four
  notes = Pes + Pes, five notes = Pes + Punctum + Pes. The editor reuses the
  approved Podatus and Punctum in successive 12-unit columns.
  - It is not a chain of three-note Scandicus glyphs, adds no connector, and
    implies no salicus, oriscus, quilisma, liquescence or new rhythm.
  - Applying this grouping to every other interval combination is the
    **chosen initial engraving profile**, not a claim that all historical
    extended Scandicus figures use this construction. Fig. 34 shows only its
    two contours.
  - Gregorio's default partition (Punctum first) remains a documented
    alternative, not the selected profile.

  Comparison is **qualitative**; no measured typographic match is claimed.

## Mora gate

Approved 2026-11-13: **none or final note** for four- and five-note Scandicus
and Climacus; three-note groups keep none/final/final-two unchanged.

| Family / length | Pattern   | Direct printed evidence                            | Analogy                                                                                                                          | Gregorio                                                                                                                                                                                                      | Decision |
| --------------- | --------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Climacus 4/5    | None      | Demetria p. 40 (both examples), Mocquereau Fig. 34 | –                                                                                                                                | –                                                                                                                                                                                                             | Allow    |
| Climacus 4/5    | Final     | **None found**                                     | Same descending-diamond tail and final-dot placement as the owner-approved Pes subpunctis final mora (Mocquereau Fig. 37 no. 21) | `iHGF.`, `kJIHG.`: one dot right of the last diamond in its row; unambiguous                                                                                                                                  | Allow    |
| Climacus 4/5    | Final two | None found                                         | Pes subpunctis final-two was deferred for the same tail                                                                          | `iHG.F.`, `kJIH.G.`: the upper dot sits inside the descending stagger, between the last two diamonds; ownership less clear                                                                                    | Defer    |
| Scandicus 4/5   | None      | Mocquereau Fig. 34                                 | –                                                                                                                                | –                                                                                                                                                                                                             | Allow    |
| Scandicus 4/5   | Final     | **None found**                                     | The final element is an approved Podatus; Podatus "second note" is an established pattern                                        | `fg!hj.`, `ef!g!hj.`: one dot right of the top note; unambiguous                                                                                                                                              | Allow    |
| Scandicus 4/5   | Final two | None found                                         | The final two notes are exactly the final Podatus; Podatus "both" (auctum duplex) is established                                 | `fg!h.j.`, `ef!g!h.j.`: stacked pair right of the final Pes, clear in Gregorio. Plain GABC `fgh.i.` (Gregorio's own partition) instead puts the lower dot between elements, so the result depends on grouping | Defer    |
| Either          | Earlier   | None                                               | –                                                                                                                                | Not investigated                                                                                                                                                                                              | Defer    |

**Approved matrix:** none or final note for both families and both lengths.
The final note is the last note of the actual tuple. The mark stays on that
stable note ID when earlier notes are deleted (5→4→3, and on to the
established Podatus/Clivis "second note"). It is removed, never transferred,
when its note is deleted. Final-two and earlier-note patterns are deferred.

**Evidence, stated accurately:** no direct printed example of a final mora on
a four- or five-note Scandicus or Climacus was found. The policy rests on two
things:

- analogy with the existing Podatus "second note" and the descending-diamond
  final mora (the approved Pes subpunctis final mora, Mocquereau Fig. 37
  no. 21);
- unambiguous Gregorio rendering of the same marked groups
  (`gregorio-marked.png`).

## ADR 0023 amendment (approved 2026-11-13)

Deleting one Pes subtripunctis constituent normalizes to a four-note Climacus
whenever the actual survivors strictly descend and every surviving authored
modifier is valid there. The result is decided from the surviving contour, not
from the deleted index:

- **First-note deletion:** `[2,5,4,3,2]` loses `n0` and becomes a four-note
  Climacus.
- **Apex deletion:** `[4,5,3,2,1]` becomes a four-note Climacus, while
  `[3,5,4,2,1]` still rises and stays a Pes subpunctis.
- **Equal adjacent survivors** (`[4,5,4,3,2]` minus its apex) remain rejected,
  with the announcement "… such as two equal adjacent pitches, or a mark the
  resulting neume does not allow".

The neume ID, survivor objects and order, horizontal/vertical episemata, a
final mora (now legal on the four-note Climacus), B ownership and placement,
lyric anchors and divisions are preserved. A surviving mark that the Climacus
does not allow rejects the deletion. No other normalization rule is
broadened.

## Three-note preservation (measured)

`three-note-baseline.mjs` (committed) creates a detached temporary worktree
for a baseline commit (default `a2111bf`, Stage 9B-1 master). It runs the same
temporary Vitest dump there and in the working tree, then compares the
results. Both trees use this checkout's `node_modules`, and nothing is left
behind. The dump records SHA-256 hashes of the full `buildNeumeGeometry` JSON
for:

- Scandicus (ordinary and with quilisma) and Climacus;
- first pitch −4..8 and both intervals 1–4;
- every mora scope (none/final/final-two) and all 8 × 8 horizontal × vertical
  episema masks.

That is **119,808 cases**. Run it with:

```sh
node docs/verification/extended-scandicus-climacus/three-note-baseline.mjs
```

Results, all byte-identical with zero exceptions and the same file SHA-256
`991e50b6bc1c9912686015bf2f2167c63e1e4e5f38829cf14ac982cd01696600`:

- at `34e7bb7`, against the same dump run by hand;
- after the owner-approved mora and normalization changes, run with the
  committed script.

The three-note recipes and dispatch are untouched; the new recipe is selected
only for length > 3.

## Actual verification

### After the owner decisions

Run on the final changes:

- `npm run format:check`, `npm run lint`, `npm test` (87 files, 1,894 tests)
  and `npm run build` passed.
- The pure tests and the exhaustive geometry tests (20,992 marked geometries)
  pass.
- `three-note-baseline.mjs` reported byte-identical three-note geometry.

**Browser drivers were not re-run on the final changes.** The Stage 9B-2
driver was extended (approved mora, marked deletion/movement, Pes-to-Climacus
normalization) and the Stage 9B-1 driver was updated for the amended
deletion. Neither updated driver has been run yet; to save time, the owner
asked to stop before the browser runs. The browser results below are from
`34e7bb7`.

### Firefox mid-score-clefs investigation

Branch and master `a2111bf` were each served by their own dev server
(5180/5181) to one fresh headless Firefox 146 (BiDi), running alternating,
otherwise identical copies of the driver. The copies added a diagnostic dump
at line 1032. The results: **7 runs, all passed** (branch 4, master 3). The
investigation was stopped early at the owner's request, before the planned 16
runs.

The failure was not reproduced on either tree, so its cause is
**undetermined**. Observations:

- The Firefox path rounds pointer coordinates to whole CSS pixels
  (`Math.round`), while Chromium does not. At 150% zoom that can move a click
  relative to the hovered point.
- The one failure came first after a 22-run batch in the same long-lived
  Firefox process.

Both suggest a timing or coordinate effect rather than Stage 9B-2 code, but
this is **not established**. A regression is unlikely given 0/4 branch
failures, but it is not ruled out.

### Initial run at `34e7bb7` (before owner decisions)

Repository gate: `npm run format:check`, `npm run lint`, `npm test` (87
files, 1,893 tests) and `npm run build` passed.

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
reruns passed. See the
[investigation](#firefox-mid-score-clefs-investigation).

Existing driver changes: only the current-version assertions and
future-version probes were bumped by one (7→8, 8→9), as Stage 9B-1 did.

At this stage the Stage 9B-2 driver exercised:

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

## Owner decisions (2026-11-13)

All three gates were approved after review of `34e7bb7`:

1. **Extended Scandicus engraving:** the Mocquereau Fig. 34 staircase as the
   initial deterministic profile.
2. **Mora:** `{none, final}` for four- and five-note Scandicus and Climacus;
   final-two and earlier-note patterns deferred.
3. **ADR 0023 amendment:** Pes subtripunctis deletion leaving four strictly
   descending notes normalizes to a four-note Climacus.

ADR 0024 is Accepted and ADR 0023 records the amendment. Final review of
PR #76 is pending.

## Remaining limitations

- Neume ledger lines remain absent for every kind (existing limitation), which
  affects the outer notes of long groups far off the staff. This is recorded
  as separate follow-up work in the [roadmap](../../roadmap.md).
- Final-two and earlier-note morae on longer groups are deferred.
- No lengths beyond five, no other compound directions, no authored forms on
  longer groups, no intra-syllable fusion, GABC interchange or playback.
- Native v8: older builds cannot read v8 files, including files without longer
  groups.

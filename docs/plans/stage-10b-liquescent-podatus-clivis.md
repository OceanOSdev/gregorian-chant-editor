# Stage 10B — Liquescent Podatus and Clivis (proposed)

Status: **Proposed, awaiting owner gate.** Not authorized for implementation.
It was produced by the [Stage 10A research gate](stage-10a-liquescent-notation.md).
Evidence: [research record](../verification/liquescent-notation/README.md).
Decision: [Proposed ADR 0027](../adrs/0027-neume-level-liquescence.md).
Suggested branch after approval: `feat/liquescent-podatus-clivis`, target `master`.

## Owner decision table

Recommended options are listed first. **Bold** rows are needed before 10B
starts. The others have defaults that the owner can accept as written.

| #      | Decision                                     | Recommended                                                                                                                                                  | Alternatives                                                                                                                                                                                                           | Evidence / reason                                                                                                                                                                                            |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D1** | Semantic representation                      | Neume-level optional `liquescence` on Podatus/Clivis (ADR 0027 option 2)                                                                                     | Note-level field/NoteForm; dedicated kinds                                                                                                                                                                             | Print labels “liquescent Podatus/clivis”. The construction changes the whole figure. The contour is identical. Existing reconstruction paths already preserve neume fields for these kinds (audit § 4).      |
| **D2** | Augmentative pes (Eia, `fg>`)                | **A. Defer** from 10B. Author Eia as an ordinary Podatus and toggle it later (IDs are stable). Open 10C to find a Roman printed auctus witness, then choose. | B. Add `augmentative-descending` (Podatus only) with the **Dominican** thin descending tail, a sourced construction that is not Roman. C. The same value with Gregorio's default auctus head (renderer-only evidence). | P1 shows an offset pes with a thin descending tail. The _Liber_ table has no augmentative forms. Gregorio's two fonts differ exactly here. It is the only in-scope figure whose horizontal topology changes. |
| **D3** | Engraving profile for epiphonus/cephalicus   | Roman/Solesmes (_Liber_ p. xxij) as primary, Gregorio default as secondary                                                                                   | A Dominican-specific epiphonus                                                                                                                                                                                         | The Dominican print agrees topologically, and a Gregorio contributor read the same page as a Solesmes epiphonus. Curvature differences cannot be resolved at 480 px.                                         |
| **D4** | Supported kinds/variants                     | Podatus + diminutive (epiphonus), Clivis + diminutive (cephalicus)                                                                                           | Also liquescent Torculus/Porrectus/Scandicus/Climacus (in the _Liber_ table)                                                                                                                                           | Bounded to the repertoire need. Larger kinds also need `mapNeumeNotes` changes.                                                                                                                              |
| **D5** | Deleting a constituent                       | Survivor becomes an ordinary Punctum. The liquescence is removed with the figure in one undoable transaction, with a status announcement.                    | Reject deletion until toggled off (ADR 0019 quilisma precedent)                                                                                                                                                        | The property belongs to the deleted two-note figure, not to the surviving note. Either option is explicit; the choice is UX.                                                                                 |
| D6     | Intervals                                    | Any interval valid for Podatus/Clivis. References verified at Δ1–Δ4; wider intervals use the existing stem-plateau extrapolation, documented.                | Restrict to Δ1–Δ2                                                                                                                                                                                                      | Avoids a new move-rejection rule. Gregorio renders all intervals. The Salve uses only seconds.                                                                                                               |
| D7     | Marks matrix                                 | First note: existing marks, mora `none`/`first`. Liquescent second note: none. Toggling on is rejected while the second note has marks.                      | Allow all existing Podatus/Clivis marks                                                                                                                                                                                | No print evidence of marks on liquescent figures was collected. This is a product limit, not a historical claim.                                                                                             |
| D8     | Quilisma + epiphonus                         | Rejected (product deferral)                                                                                                                                  | Allow (`gwi~` is encodable)                                                                                                                                                                                            | No print evidence collected.                                                                                                                                                                                 |
| D9     | Insertion UX                                 | Podatus split family gains an **Epiphonus** variant. Clivis becomes a split family with **Cephalicus**. One click once armed; no popup.                      | A separate “Liquescent” button with a figure select (Quilisma-style)                                                                                                                                                   | Reuses the existing split-control/remembered-variant architecture.                                                                                                                                           |
| D10    | Contextual toggle                            | Neume-scoped **Liquescent** toggle button (`aria-pressed`) in the note context toolbar, shown for Podatus/Clivis                                             | A “Liquescence” select (becomes necessary only if D2 adds a second value)                                                                                                                                              | One click. Name derived (“Epiphonus”/“Cephalicus”).                                                                                                                                                          |
| D11    | Persistence                                  | Native v10 with the optional key. v1–v9 unchanged and strict.                                                                                                | —                                                                                                                                                                                                                      | The strict codec already rejects unknown keys.                                                                                                                                                               |
| D12    | Single-note liquescents (_osténde_, _Virgo_) | Record as future Dominican repertoire work; no action in 10B                                                                                                 | —                                                                                                                                                                                                                      | They are liquescent per Dominican rubric (Cormier 1913, via Gregorio #1) but unencoded in GABC and outside this milestone.                                                                                   |

Unresolved historical questions (not blockers for D1/D3/D4) are listed in
§ 6 of the research record.

## Scope (if D1–D5 are approved as recommended)

In scope: epiphonus and cephalicus as liquescent Podatus/Clivis; authoring,
toggling, deletion, moves, clef translation, accidentals, clipboard, history,
v10 persistence; Roman/Solesmes engraving with shared preview/committed
geometry; accessible names.

Out of scope: augmentative forms (unless D2 = B/C), liquescence on other kinds,
single-note liquescents, initio debilis, Scandicus subpunctis, compound
grouping (`gf{gh}`), Dominican bars, automatic text-derived liquescence,
GABC import/export, playback, notation-profile switching, fixture corrections.

## Semantic contract

- `Liquescence = 'diminutive'` (plus `'augmentative-descending'` only if D2 = B/C).
- `PodatusNeume.liquescence?` and `ClivisNeume.liquescence?`. Absent means
  ordinary. Value objects get no IDs.
- `isValidNeume` adds the following, so commands, paste and decoding share
  one rule:
  - the key is present only on podatus/clivis, with an allowed value;
  - strict contour, unchanged;
  - liquescent ⇒ `notes[0].form` absent;
  - liquescent ⇒ `notes[1]` has no `mora`/`episema`/`verticalEpisema`;
  - liquescent ⇒ mora scope ∈ {`none`, `first`}.
- `moraChoices(kind, count, liquescence)` and the note-modifier controls
  derive from the same table. `allowedNoteForms` becomes neume-aware for the
  quilisma rejection, or `isValidNeume` handles it; implementation picks one
  site and does not duplicate it.
- `neumeDisplayName` derives “epiphonus”/“cephalicus” for labels and
  announcements.
- Deletion (`normalizeNeumeAfterNoteDeletion`) follows D5 explicitly, with
  tests for both constituents of both kinds.
- Leave a regression test or comment at the `mapNeumeNotes` branches that
  rebuild `{ id, kind, notes }`, so a future extension cannot silently
  drop the field.

## Commands, UX and interaction

- `updateNeumeLiquescence(document, neumeId, value | undefined)`. It is
  atomic, one history entry, and a no-op without history or autosave if
  unchanged or invalid. It leaves neume/note IDs, pitches, syllable
  anchors and accidentals unchanged.
- Entry kinds `epiphonus` and `cephalicus` in `GraphicalNeumeKind`. They
  use the same two-pitch placement as podatus/clivis and insert the semantic
  kind plus the field in one action. The ghost preview uses the liquescent
  geometry.
- Palette (D9): `podatusFamily` gets `'epiphonus'`. New `clivisFamily =
['clivis', 'cephalicus']` as a split control. Roving focus, the remembered
  variant, sticky-toolbar narrow/wide layouts and accessible names follow
  the existing family pattern.
- Context toolbar (D10): a neume-scoped toggle when the selected note's
  neume is Podatus/Clivis. When rejected, it shows a visible reason (for
  example “Remove marks from the second note first” or “A quilismatic pes
  cannot be liquescent”). The help text says it changes the whole neume.
- Accessible labels: “Epiphonus, lower note, F” / “upper liquescent note,
  G”; score description counts.

## Engraving and layout

Pure, shared builders in `layout/neumes/podatus-clivis.ts` (or a sibling
`liquescent.ts`), consumed by both the ghost preview and the committed layout:

- **Epiphonus**: a stacked column at the Podatus x. The lower body has a
  curved top-left and rounded underside, a right stem lengthening with the
  interval, and a reduced hooked terminal at the upper pitch. Lyric anchor
  and column width are as for the Podatus unless measurement shows otherwise.
- **Cephalicus**: the upper head and left stem as for the Clivis (reuse
  `clivisStemLength`), and a right descending stroke to a reduced terminal at
  the lower pitch. Its measured width is narrower than the Clivis.
- Both: the note centre and an ordinary-sized hit/focus box for each
  constituent; ink bounds for spacing, compaction, wrapping and the
  ADR 0026 intra-syllable gap; selection outline and range highlight from
  the shared bounds; accidentals and first-note marks positioned from note
  anchors; custodes unchanged (pitch-derived).
- Compare against the _Liber_ crop and the Gregorio render at Δ1–Δ4 and in
  line/space positions. Record the measured constants in
  `docs/engraving-metrics.md`. Existing ordinary glyph metrics are unchanged.

## Persistence

v10 per ADR 0027 § 6: the reader accepts the key only for podatus/clivis
under v10; v1–v9 reject it with “Unsupported … for this schema version”.
Writes are v10. The fixture `salve-regina-dominican-wip.chant.json` (v9) must
load unchanged and save as v10 only on an explicit save. Update
`docs/persistence.md` and `docs/domain-model.md` in the same change.

## Tests (focused unit)

- Validity table: every kind × liquescence value × form × mark × mora
  scope, including rejection of the key on other kinds and of unknown values.
- Codec: v10 round trip; v9 with the key rejected; v1–v9 fixtures and the
  Salve fixture unchanged.
- Toggle: on/off preserves IDs, pitches, anchors and accidentals; it is a
  no-op when unchanged; rejected with marks/quilisma; one history entry;
  undo/redo.
- Moves: up/down keep liquescence; inversion/unison rejected; whole-neume move.
- Clef change translation and written B signs preserved.
- Deletion of each constituent of each kind under D5; whole-neume deletion.
- Clipboard: copy a liquescent figure between documents and clefs, keeping
  the field with fresh IDs and effective pitch; conflicts unchanged.
- Insertion via `epiphonus`/`cephalicus` entry kinds; graphical placement.
- Geometry: ink, anchors and hit bounds at Δ1–Δ4; preview/committed parity;
  cephalicus width and spacing; ordinary Podatus/Clivis regression baselines.

## Browser and visual verification

Run the standard gate plus the affected drivers (palette families, context
toolbar, insertion, persistence, clipboard) in Chromium and Firefox at narrow
and wide viewports. Check one-click insertion, the toggle, focus/selection,
the sticky toolbar, save/reload/export/import, and clipboard across clefs.

The visual acceptance is **sourced**: side-by-side with the _Liber_ p. xxij
crop and the P1 crops from `regenerate.sh`. Matching pitch or the Gregorio
render alone is not sufficient. The owner performs a foreground check. Do
not rerun the full historical matrix only to rediscover known baseline
failures.

## Acceptance examples

From the owner's v9 fixture (positions: d=0 … j=6, C4):

1. Load the fixture unchanged. Continue with **Ad te**: Punctum 0
   (_Ad_), Epiphonus [2, 3] (_Ad_ continues), Punctum 4 (_te_), division.
   Save as v10, reload, and compare with p. 119 system 2.
2. Second _Ad te_: the same figures. Copy the first _Ad_ passage and paste
   it; IDs are fresh and the epiphonus is preserved.
3. _er-go_: Epiphonus [3, 4]. _E-ia_: an ordinary Podatus [2, 3] while D2 =
   A (documented approximation).
4. _miseri-cór-_: closing Cephalicus [4, 3]. _dul-cis_: Cephalicus [3, 2].
5. Toggle each figure off and on; IDs and anchors are unchanged. Delete
   the terminal of an epiphonus and check the D5 behaviour, then undo.

## Stop conditions

Stop and report if the shared geometry cannot express the reduced terminal
without per-renderer state, if the cephalicus width breaks accepted spacing
contracts (ADR 0010/0011/0026), or if any reconstruction path drops the field
in a way the tests cannot cover locally.

# Stage 10B — Liquescent Podatus and Clivis

Status: **Owner-approved 2026-11-15; implementation authorized.**
Stage 10A research is complete. Evidence: [research record](../verification/liquescent-notation/README.md).
Decision: [Accepted ADR 0027](../adrs/0027-neume-level-liquescence.md).
Continue on `research/liquescent-notation`, existing draft PR #89 against
master. No merge until implementation review and foreground owner acceptance.

## Owner decisions

All D1–D12 were approved on 2026-11-15. D2 explicitly selects the Dominican
construction rather than the research author's initial deferral recommendation.

| #   | Accepted decision |
| --- | --- |
| D1  | Optional neume-level liquescence on Podatus and Clivis. |
| D2  | Include Dominican augmentative-descending Podatus (Eia): offset full heads and thin descending terminal, not standard rounded auctus. |
| D3  | Roman/Solesmes diminutive silhouettes (Liber Usualis p. xxij). |
| D4  | Two-note Podatus/Clivis only. |
| D5  | Deletion of either constituent normalizes to ordinary Punctum, retaining surviving note, neume identity and compatible marks; one undoable edit with announcement. |
| D6  | All otherwise valid intervals; distinguish observed and extrapolated geometry. |
| D7  | Existing first-note marks only; no second-note mora, horizontal or vertical episema on any approved liquescent pair. |
| D8  | No quilisma combined with liquescence. |
| D9  | Direct insertion via Podatus and Clivis split families; same two-pitch placement. |
| D10 | Podatus explicit appearance selector: Ordinary / Epiphonus / Augmentative pes (Dominican); Clivis binary Liquescent toggle. |
| D11 | Native v10; strict v1–v9 readers and existing save boundaries. |
| D12 | Single-note Dominican liquescents (osténde, Virgo) deferred. |

## Scope

Epiphonus and cephalicus, plus the sourced Dominican augmentative Podatus;
authoring, appearance editing, deletion, moves, clef translation, accidentals,
clipboard, history, v10 persistence; shared preview/committed geometry and
accessible names. All six two-note occurrences in the repertoire are in scope.

The augmentative value is an explicitly bounded Dominican construction within
the existing Roman/Solesmes product profile. No general notation-profile
selector, no automatic changes to ordinary Podatus, no claim that the Dominican
shape is universal, and no speculative rounded or ascending-terminal variant.

Out of scope: other augmentative forms, liquescence on other kinds, single-note
liquescents, initio debilis, Scandicus subpunctis, compound grouping
(`gf{gh}`), Dominican bars, automatic text-derived liquescence, GABC
import/export, playback, notation-profile switching, fixture corrections.

## Semantic contract

- `PodatusLiquescence = 'diminutive' | 'augmentative-descending'`;
  `ClivisLiquescence = 'diminutive'`. Use the respective optional field on
  PodatusNeume and ClivisNeume. Absent means ordinary; reject explicit
  undefined/null/none and unknown values at runtime. Value objects get no IDs.
  Keep existing Neume kinds, tuple and identity.
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
- Derive display names Epiphonus, Cephalicus and Augmentative pes (Dominican)
  from kind/appearance for labels and announcements. No persisted name.
- Deletion (`normalizeNeumeAfterNoteDeletion`) follows D5 explicitly, with
  tests for both constituents of all three variants. Preserve note and neume
  IDs, pitch, lyric anchors and compatible surviving marks; use existing
  accidental reconciliation (do not transfer signs from deleted owners).
- Leave a regression test or comment at the `mapNeumeNotes` branches that
  rebuild `{ id, kind, notes }`, so a future extension cannot silently
  drop the field.

## Commands, UX and interaction

- `updateNeumeLiquescence(document, neumeId, value | undefined)`. It is
  atomic, one history entry, and a no-op without history or autosave if
  unchanged or invalid. It leaves neume/note IDs, pitches, syllable
  anchors and accidentals unchanged.
- Entry variants `epiphonus`, `cephalicus`, and
  `augmentative-pes` (or equivalent consistent entry-only name). They use
  the same two-pitch placement as podatus/clivis and insert the semantic kind
  plus the field in one action. The ghost preview uses the liquescent geometry.
- Palette (D9): extend `podatusFamily` with Epiphonus and Augmentative pes
  (Dominican); retain existing options. New Clivis family includes Clivis and
  Cephalicus. Roving focus, remembered insertion including I, keyboard and
  pointer placement, cancellation, narrow/wide layout and accessible names
  follow the existing family pattern; no per-insertion modal.
- Context toolbar (D10): for a selected constituent or whole Podatus, offer
  a labelled neume-level Appearance selector with Ordinary, Epiphonus and
  Augmentative pes (Dominican). For Clivis, a neume-level Liquescent toggle
  (`aria-pressed`). Both use the same atomic command, preserve all stable
  IDs and pitches, retain focus/selection, and work in the existing ordinary
  selection context. No range-wide change or implicit draft commit. Rejected
  changes keep previous appearance, marks and history; show visible accessible
  reasons (e.g. remove marks from the second note or remove quilisma first).
  Controls must derive allowed choices from the same validation rules.
  Changing to ordinary preserves first-note marks and clears only the
  neume-level field. Switching between liquescent variants changes only that
  value. The conservative D7 restriction applies even to the full-headed
  augmentative terminal; it is a product limit, not a historical claim.
- Accessible labels identify the actual appearance and each constituent's
  pitch/order; score descriptions and insertion/status text remain coherent.

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
- **Augmentative pes (Dominican)**: two full heads horizontally offset,
  connected according to the Eia print, with a thin downward terminal stroke
  extending from the upper head. Not the ordinary stacked pes or a rounded
  Greciliae auctus head. Use P1 L3 and op render as primary/secondary
  references; retain separate pitch anchors and derive its wider advance,
  bounds, lyric anchor and placement from the ink. Original SVG geometry;
  no copied font outlines.
- All three: the note centre and an ordinary-sized hit/focus box for each
  constituent; ink bounds for spacing, compaction, wrapping and the
  ADR 0026 intra-syllable gap; selection outline and range highlight from
  the shared bounds; accidentals and first-note marks positioned from note
  anchors; custodes unchanged (pitch-derived).
- Compare against the _Liber_ crop (diminutive) and P1 L3/op (augmentative).
  Existing pairs.gabc samples Δ1 and Δ3 (seconds/fourths), not all Δ1–Δ4.
  Extend research comparison to Δ2/Δ4 (thirds/fifths), line/space positions,
  for each approved appearance; record actual observed evidence and any
  unsupported renderer cases. D6 authorizes all otherwise valid intervals;
  geometry beyond observed intervals uses documented stem/plateau
  extrapolation, not invented historical evidence. Test representative wider
  and extreme valid positions. Record measured constants in
  `docs/engraving-metrics.md`. Existing ordinary glyph metrics are unchanged.

## Persistence

v10 per ADR 0027 § 6: the reader accepts the key only for podatus/clivis
under v10; v1–v9 reject it with “Unsupported … for this schema version”.
Writes are v10. The fixture `salve-regina-dominican-wip.chant.json` (v9) must
decode without semantic changes; import/replacement and committed edits
write v10 via existing autosave, as does export. Cache hydration alone does
not force a migration write. Keep the original v9 fixture untouched. Update
`docs/persistence.md` and `docs/domain-model.md` in the same change.

## Tests (focused unit)

- Validity table: every kind × liquescence value × form × mark × mora
  scope, including rejection of the key on other kinds and of unknown values.
- Codec: v10 round trip for each variant; reject augmentative Clivis,
  unknown values, explicit null/none and keys on other kinds; v1–v9 with
  the key rejected, legacy fixtures decode unchanged. Confirm actual v10
  bytes on import/edit/export and no forced migration on cache hydration.
- Appearance: all valid transitions among Podatus variants, Clivis on/off,
  preserve IDs, pitches, anchors and accidentals; it is a
  no-op when unchanged; rejected with marks/quilisma; one history entry;
  undo/redo.
- Moves: up/down keep liquescence; inversion/unison rejected; whole-neume move.
- Clef change translation and written B signs preserved.
- Deletion of each constituent of each of the three variants under D5,
  including surviving marks, owner/anchor accidental behavior, undo; whole-neume deletion.
- Clipboard: copy a liquescent figure between documents and clefs, keeping
  the field with fresh IDs and effective pitch; conflicts unchanged.
- Insertion via all three entry variants; graphical and keyboard placement,
  remembered family choice, ordinary variant regressions.
- Geometry: ink, anchors, mark placement and hit bounds at Δ1–Δ4, wider
  intervals, line/space; preview/committed parity; narrower cephalicus and
  wider augmentative pes spacing; selection/range geometry, accidental and
  lyric anchors, wrapping; ordinary Podatus/Clivis regression baselines.

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
3. _er-go_: Epiphonus [3, 4]. _E-ia_: augmentative-descending Podatus
   [2, 3] with the sourced Dominican thin descending tail, compare p. 119
   system 4. Verify all three Podatus appearance choices without changing IDs.
4. _miseri-cór-_: closing Cephalicus [4, 3]. _dul-cis_: Cephalicus [3, 2].
5. Change each figure to ordinary and back; IDs and anchors are unchanged. Delete
   the terminal of an epiphonus and check the D5 behaviour, then undo.

## Stop conditions

Stop and report if the shared geometry cannot express the reduced terminal
without per-renderer state, if the cephalicus or augmentative pes width breaks accepted spacing
contracts (ADR 0010/0011/0026), or if any reconstruction path drops the field
in a way the tests cannot cover locally.

Do not reopen settled D1–D12 unless evidence reveals a genuine conflict.
The research fixture is not a completed chant; preserve it and add only
separate minimal acceptance fixtures as needed. Record unresolved regional
single-note forms and later compounds separately. No merge without owner
foreground acceptance.

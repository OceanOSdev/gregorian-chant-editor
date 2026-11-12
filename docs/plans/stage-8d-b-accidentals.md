# Plan: Stage 8D — authored B-flats and B-naturals

Branch: `feat/stage-8d-b-accidentals`
Target: `master`
Status: **Ready to resume implementation (owner-approved placement amendment).**

PR #72 stopped at the historical placement gate on 2026-11-11.
The owner chose option 2: retain B-note ownership but permit an explicit
earlier-note engraving anchor. [Accepted ADR 0021](../adrs/0021-author-b-accidentals-at-neume-boundaries.md)
now incorporates that decision. The
[placement-gate evidence](../verification/b-accidentals/README.md) remains
the historical record of the stop. Application implementation, native v5,
the broader comparison matrix and feature verification remain pending.

## Problem and user-visible goal

Select a B and choose None, Flat or Natural in the existing contextual
note properties. The normal sign appears before its whole neume. For
exceptional historical engraving, select the sign and place it above an
eligible earlier note. The sign remains independently selectable/deletable,
with stable B-note ownership, measured layout, history, native interchange
and local recovery. Its musical effect is derived according to the initial
Roman/Solesmes rules, not stored on every note. Read ADR 0021 in full;
it owns the scope, ownership, placement, validation and mutation contracts.

## Before implementation

Read `AGENTS.md`, `docs/ai-workflow.md`, the domain, commands/history,
layout/rendering, engraving metrics, editor interactions, persistence
and testing guides. Respect Accepted ADRs 0002–0004, 0007, 0008, 0010–0016
and 0018–0021. ADR 0006 is still Proposed; no playback engine is planned.
Inspect the actual current branch and preserve unrelated local work.

Preserve all current bundled examples byte-for-byte, including the
owner-authored v4 Pater Noster updated in merged PR #68. Do not use
mutable bundled examples as fixed-version behavior-test fixtures. Use
independent historical fixtures and dedicated accidental specimens.

### Focused visual research gate

The owner-approved interpretation and placement decisions are settled.
Do not restart broad octave research. Before finalizing contours/spacing,
record a reproducible visual comparison matrix:

- Reuse PR #72's retained printed crop, exact GABC and actual Gregorio
  compilation of _Beata gens_, _o-_ of _omnis_: a B-flat above the
  terminal F diamond, before G–A and the later B virga. Reproduce the
  earlier-note placement in editor geometry, without changing the
  affected B or inventing a new neume kind. The gate is resolved for this
  specimen by the amended ADR, not waived.
- Compare the printed specimens linked in ADR 0021: _Laetatus sum_
  (`ixiji`, B-flat–C–B-flat Torculus), _Ecce virgo_ (`ixihi`,
  B-flat–A–B-flat Porrectus), _Benedicta et venerabilis_ (between
  groups of one syllable) and _Beata gens_ (explicit natural within
  _Domini_).
- Compile focused Gregorio flat/natural probes (record tool/font versions
  and exact inputs) before Punctum, Podatus/Clivis with B in either
  constituent, Scandicus, Torculus, Climacus and Porrectus; line/space
  positions, C/F clefs, close preceding ink, two B registers at one
  boundary, system starts and explicit anchors over earlier compound
  constituents. Include separate anchor/owner systems and an intervening
  clef as synthetic probes, not claims of printed historical precedent.
- Compare scale-normalized crops and measured editor ink/advances.
  Use traditional square-notation signs and reproducible measured
  contours, not arbitrary Unicode/font metrics. Preserve existing
  notehead shapes and canonical staff/print geometry. Distinguish
  historical evidence from extrapolation and generated GABC.
- If new printed evidence requires unsupported alterations (including
  different accidental states between matching Bs of one connected
  neume, or floating signs with no owner), stop that affected decision
  and report evidence/options. If faithful legible geometry conflicts
  with accepted shared layout, stop rather than inventing a new placement
  mode or silently moving an authored anchor.

## Workstreams

Implement in coherent commits on the existing branch. Investigate the
actual code and choose the smallest changes satisfying the contract.

### 1. Semantic model, ordering and pitch derivation

- Add the distinct `ChantAccidental` collection, with stable globally
  unique ID, kind, B ownerNoteId and optional placement exactly
  `{ kind: 'above-note', noteId: string }`. Omitted placement means
  before the owner's neume. Do not store duplicated pitch, neume anchor,
  graphics coordinates, or inferred alteration. Validate all collections
  together, including live B owners, canonical earliest matching B,
  at most one sign per owner neume/register, and exact placement fields.
  Blank/new/migrated in-memory documents have a required empty array.
  Audit factories, fixtures, candidates and all ID allocation checks.
- Validate explicit placement: anchor in an earlier neume, live owner
  is the first matching B from immediately before the anchor, no
  intervening word/division reset or same-register sign. Clefs and
  automatic wrapping alone are not resets. A word reset at the anchor
  neume's beginning precedes its anchored signs. Derive simultaneous sign
  order from owner order, not array or pixel position.
- Extend the authoritative semantic traversal with default prefixes and
  signs before their explicit placement notes. Preserve ADR 0015's
  structural boundary order, insertion slots and reanchoring. No
  independent insertion slot between a sign and its placement neume
  and no structural split of a connected neume. No lyric anchor to a
  sign. The explicit anchor affects when state begins, not the owner's
  identity or the anchor note's pitch.
- Derive pitch without SVG using safe relative degree arithmetic:
  staffPosition + effective clef offset, B = normalized modulo 7
  residue 6. Reset every register at each word start and each minima,
  minor, maior, finalis; no reset for continuation syllables, extra
  neumes on a syllable, absent lyrics, clef changes or wrapping.
  Apply default prefixes before owner neume constituents; apply explicit
  signs before placement notes. Natural clears its own register.
  Keep written presence separate from effective pitch. Preserve redundant
  authored signs and never draw an inferred natural at a reset.
- Isolate register-key/state transition logic for a possible future
  pitch-class-wide interpretation. Do not implement alternate settings,
  a generalized policy framework or playback now.

### 2. Commands, ownership, placement and clef preflight

- Select a B to add/update/remove the sign owned by its neume/register,
  irrespective of which matching constituent is selected or whether
  the sign is placed earlier. First matching B is canonical owner.
  Kind change retains ID, explicit glyph deletion removes only the
  sign, identical edits are referential no-ops.
- Provide commands to set a valid earlier anchor or restore default
  placement, keeping owner, kind and ID. An ineligible explicit
  placement request rejects unchanged; same placement is a no-op.
- Audit note/neume move, delete, normalization, insert and any existing
  split/merge paths. Deleting original owner or moving it off B removes
  the sign; deleting merely affected/inheriting notes does not. No
  ownership transfer because of deletion. Surviving B owners retain
  sign identity and follow a changed B register. Canonicalize to the
  first matching B of the resulting owner neume after owner-loss
  processing. Reject edits that would merge distinct signs at the
  same owner neume/register with an accessible explanation.
- After owner-loss processing and canonicalization, revalidate surviving
  explicit placements against the final candidate. If the anchor is
  deleted, no longer earlier, separated by a word/division reset,
  intervening matching B/sign, or invalidated by register/ownership
  change, clear placement and retain owner, kind and ID. Preserve valid
  anchors through movement/normalization. Recheck deterministically after
  repairs as needed. Provide accessible restoration feedback; the
  initiating edit and repairs share one history snapshot. Do not
  automatically repair malformed imported documents. Recalculate effects
  without materializing extra signs.
- Audit initial and explicit clef insertion/update/deletion transforms.
  Initial edits always Keep pitches; retain ADR 0015's preselected mode,
  effective-range comparison and staged existing-clef Apply/Cancel.
  Keep pitches preserves all surviving relative chromatic pitches,
  sign IDs, kinds and valid explicit anchors. Use existing effective
  offsets; intermediate untransposed candidates with temporarily non-B
  owners must not block valid preservation transforms. Validate final
  candidate. The anchor clef and owner clef can differ: derive sign
  height from the owner's register under the clef at the written
  location.
- Keep note positions preflight retains staff positions and valid B
  owners, removes signs whose owners cease to be B, and revalidates
  surviving explicit placements. Before removing signs, show targeted
  confirmation with exact count of written flats/naturals (not
  inheriting notes or restored placements). Cancel leaves document,
  history, redo and cache unchanged; confirm commits clef edit,
  removals and repairs atomically. Ordinary zero-loss insertion/Apply
  remains immediate without another pitch-mode dialog. Integrate loss
  warning with existing conditional clef-deletion confirmation.
  Arrow edits adjust the draft only; warn at Apply, not each arrow.
  Respect pending/stale guards, no-op/invalid edit identity, exact
  undo/redo and synchronous autosave. Do not silently switch mode.
- Preserve unrelated entities and keep selection/target/pending state
  transient, not persisted.

### 3. Measured engraving and interaction geometry

- Use the authoritative placement/layout pipeline. Default sign at
  owner's B staff coordinate after divisions/clefs, before whole neume.
  Explicit above-note sign horizontally aligned to the anchor note's
  measured geometry, vertically to the owner's register under the
  anchor's effective clef. Do not change anchor neume contour. Multiple
  distinct-register signs use deterministic order; repeated matching
  Bs share one sign.
- Include sign ink and clearances in measured advances, system bounds,
  hit/focus targets, wrapping, same-word compaction, responsive overflow,
  combined lyric/music spacing and print. Preserve neume lyric alignment.
  Account for note forms, connectors, staff/ledger lines, clefs,
  divisions, mora/episemata and custodes. No unmeasured renderer-only
  decoration or unrelated vertical-tick raster hint.
- Wrap default signs with owner neume; wrap explicit signs with
  placement neume instead. Owner may lie on a subsequent system.
  Do not force the entire span into a single line or strand a sign
  from its placement group. Effective system clefs precede signs at
  new systems; preserve accidental state across wrapping without
  duplicating authored ink. Respect ADR 0015 clef wrapping and existing
  bounded overflow/progress policy for oversized groups. Never silently
  change an anchor to solve a collision.
- Verify insertion ghosts, preview, hit and keyboard navigation agree
  with committed geometry and mode guards. No false insertion gap
  between default prefix and owner, or inside an anchored group.
  Preserve canonical print/SVG export paths where supported.

### 4. Editor UX

- Extend existing contextual note-properties overlay, not a new toolbar
  mode or permanent inspector. On B show written None / Flat / Natural
  and clear effective pitch (written, inherited, default). Non-B omit
  or disable accessibly. Either B in repeated-B compound exposes the
  same owned sign. A sign owned here but placed earlier is still
  writable via this control. None removes only a sign owned here;
  an inherited flat from another neume persists, and Natural authors
  an explicit cancellation.
- Provide real selectable/focusable glyph hit targets and accessible
  labels, kind editing, direct deletion and ordinary keyboard Delete.
  Glyph deletion retains all notes. Support normal focus after removal.
- Selected glyph exposes Placement: Before owning neume (default),
  or Place above earlier note. The latter enters an explicit targeting
  interaction: highlight eligible notes, click or keyboard-select one,
  commit in one step, Escape cancels with no semantic/history/cache
  change. Return focus to the sign appropriately. Provide Restore
  default, and feedback if no eligible target or a placement is invalid.
  No free dragging or accidental toolbar tool. Preserve the sign's
  stable ID and musical owner; anchor is not a new musical note.
- Respect existing accessible contextual controls, focus/scroll/reflow,
  narrow 320px layouts, pending workflows and no score shift on
  selection. Retain Form/Mora/Episema editing. The clef warning counts
  removed authored signs only; ordinary edits still use preselected
  mode and no extra prompt. Accessible restoration feedback for an
  invalidated placement need not create a confirmation dialog.

### 5. Strict native v5, recovery and tests

- Native v5 requires `accidentals` even if empty. Each entity has exact
  keys/types, optional placement with exact kind and noteId. Reject
  null/extra/wrong placement fields, nonexistent or later/same-neume
  anchors, interrupted spans, noncanonical/non-B owners, duplicate
  signs/IDs, unsafe arithmetic, invalid kind and malformed collection.
  Decode v1, finalized v2, v3 and v4 with unchanged version-specific
  whitelists to empty in-memory collection; reject v5-only fields in
  older envelopes. No inferred signs or source mutation.
- Preserve all bundled example files, real immutable v1–v4 fixtures,
  v4 Pater Noster's five vertical episemata and existing version
  checks. Update tests distinguishing raw envelope, normalized model
  and current save version; future-version rejection uses v6.
- Preserve withdrawn draft-v2 classification, original-byte recovery,
  1 MiB limit, same browser storage key, conflict protection, blocked
  writes and confirmed replacement. No hydration writes for old
  cache; next committed action writes v5 once. Audit New/Import/Export,
  Load example, history and version-dependent browser drivers.

## Verification and acceptance

Add focused pure tests, including these required cases, then run full
regression checks. Report actual results and unrun checks.

- Correct B identification at C3 degrees -1/+6 and all C/F clef
  staff lines, including negative modulo. Independent register states
  and explicit natural clearing only its register.
- Word and all four division resets (minima within word included);
  continuation syllables/multiple neumes/no lyrics persist; no inferred
  natural at reset. Redundant signs retained. Clef and wrap alone do
  not reset. Same-boundary word reset precedes written signs.
- B–C–B Torculus and B–A–B Porrectus share one sign; either B edits
  it. B as second/third constituent, two distinct B registers in a
  wide compound, first matching B canonicalization, deterministic
  simultaneous signs and no duplicate signs.
- _Beata gens_ regression: flat over earlier F diamond, G–A intervenes,
  later B virga owns sign. Compare against retained printed and
  Gregorio evidence. Show exact placement, no change to F/G/A,
  derived B-flat, matching same-register inheritance, natural
  cancellation. Test explicit natural anchor synthetically.
- Explicit anchor placement/restore default, no-op/invalid placement
  requests, keyboard/cancel targeting, prior/next word, all divisions,
  intervening B/sign, later or missing anchor rejection. Validate
  multiple anchored signs and deterministic repair without new signs.
- Owner deletion removes sign even with surviving matching Bs; deleting
  other B or middle note preserves it. Anchor deletion restores
  default; anchor movement/normalization retains valid placement;
  owner changes register, moves off B or is deleted. Insert division,
  lyric word break, intervening B/sign; restore default with same
  owner/kind/ID and undo exactly. Delete glyph without deleting notes.
  Reject ambiguous convergence of distinct signs in one owner
  neume/register; no mutation/history/cache write.
- Initial/explicit clef insertion, editing and deletion Keep pitches
  preserves full effective chromatic pitches and valid anchors,
  including a sign spanning a clef change. Keep note positions
  zero vs multiple invalidated owners: immediate vs exact warning,
  Cancel unchanged, confirm one entry; restored placement not counted
  as deletion. Unaffected passages after later clef unchanged.
  Verify draft arrows, stale candidates, overflow rejection and exact
  undo/redo/cache behavior.
- Default group wraps atomically. Explicit sign wraps with anchor
  neume, owner on a different system with continuing effect; sign
  height uses placement clef. Test collisions, measured ink/hit
  bounds, lyric compaction and narrow/oversized wrapping progress.
- Strict v5 round trip of default and explicit placements with forms,
  modifiers, divisions and clefs; all malformed placement/ownership/
  collection cases reject. Preserve exact legacy v1–v4 readers,
  incompatible draft-v2 recovery, cache conflict and failed import.
  Untouched legacy cache stays byte-unchanged until committed edit.

Extend `docs/verification/b-accidentals/` with the broader reference
matrix, actual editor comparisons and targeted browser drivers/evidence.
Run disposable Chromium/CDP and Firefox/BiDi production preview
(account for current Pages/custom-domain base). Exercise contextual and
glyph editing lower in the score, repeated-B control, anchor targeting
and restoration, keyboard deletion, Undo/Redo, clef warnings/cancel,
wrapping, mixed notation, lyrics, divisions, print where applicable,
native export/import and refresh/legacy recovery. Retain screenshots
including 320px and anchored/owner cross-system cases. Preserve the
historical stop-condition record.

Run `npm run format:check`, `npm run lint`, `npm test`,
`npm run build` and `git diff --check`. Run relevant existing clef,
division, layout, note-properties, forms, examples, persistence and
browser drivers with current native-version expectations. Fix the
original handoff Markdown formatting failures reported in PR #72
if any remain. Record actual commands/results, environment, failures,
limitations and unrun manual checks. Headless automation does not
establish foreground accessibility/screen-reader speech acceptance.

## Exclusions and stop conditions

No sharps, non-B alterations, clef signatures, ownerless/trailing
signs, distinct within-neume alterations of matching Bs, freehand
placement, alternate interpretation settings, new neume forms,
playback/MIDI/audio, GABC interchange, pagination, backend or broad
renderer redesign. The approved above-earlier-note anchor is the
only manual placement extension. Do not add an accidental toolbar
placement tool. Keep blocked-autosave warning, extreme-pitch viewport
and manual episema overrides separate except direct regressions.

Register-specific scope is owner-approved despite inconclusive
cross-octave historical evidence. Report genuinely conflicting
references, unrepresentable notation, unsafe arithmetic, material
ambiguity or Accepted ADR conflicts with evidence/options; stop the
affected decision before divergent implementation. Ordinary coding
choices within the amended ADR need no additional approval.

## Documentation and delivery

Update owning domain, command/history, layout/rendering, engraving
metrics, interaction, persistence, testing and roadmap guides for
implemented behavior and v5. Link ADR 0021. Keep old records
historical; update current-facing README claims if needed. Preserve
bundled examples.

Commit on the existing branch and continue **PR #72** against
`master`, not a new implementation PR. Update the draft description
to reflect the approved amendment and actual implementation/results;
make ready for review when applicable verification is complete.
Return PR URL, implementation summary, evidence, test results,
deviations and remaining visual/manual acceptance items. Retain
this plan for review and accurate closeout. Do not merge.

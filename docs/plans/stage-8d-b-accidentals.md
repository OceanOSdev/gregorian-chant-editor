# Plan: Stage 8D — authored B-flats and B-naturals

Branch: `feat/stage-8d-b-accidentals`
Target: `master`
Status: **Ready for implementation (owner-approved design, 2026-11-11).**

## Problem and user-visible goal

Let an author select a B note in ChantPad, choose None, Flat or Natural
in the existing contextual note properties, and see the traditional sign
before its whole neume. The sign is independently selectable/deletable,
participates in history, spacing, wrapping, native export/import and local
recovery, and influences the derived effective pitches of later Bs according
to the initial Roman/Solesmes convention. A user must not need to know the
underlying event-order or clef-coordinate model to author a sign.

The owner approved the design in
[Accepted ADR 0021](../adrs/0021-author-b-accidentals-at-neume-boundaries.md).
Read it in full; it owns the precise scope, ownership, validation and
mutation contracts. This plan authorizes implementation, not a claim that
engraving or tests are already accepted.

## Before implementation

Read `AGENTS.md`, `docs/ai-workflow.md`, the domain, commands/history,
layout/rendering, engraving metrics, editor interactions, persistence and
testing guides. Respect ADRs 0002–0004, 0007, 0008, 0010–0016, 0018–0021.
The proposed playback ADR 0006 remains Proposed; this task does not implement
a performance engine. Inspect the actual current branch before changes.

Owner-supplied Pater Noster was updated to native v4 in merged PR #68.
Do not regenerate or reformat the bundled examples; retain all current
examples (including any added since the discussion) exactly. They are
user-facing documents, not fixed-version behavior-test fixtures. Use
independent historical fixtures and dedicated accidental specimens.

### Focused visual research gate

The historical scope and UX decisions are settled; do not restart broad
research on octave scope. Record a small reproducible comparison matrix
before finalizing accidental contours and spacing:

- The actual printed specimens and GABC snippets linked from ADR 0021:
  *Laetatus sum* `ixiji` (Torculus B-flat–C–B-flat),
  *Ecce virgo* `ixihi` (Porrectus B-flat–A–B-flat),
  *Benedicta et venerabilis* (between neumes on one syllable),
  *Beata gens* (natural cancellation within a word).
- Compile focused Gregorio reference probes (record tool/font versions
  and exact inputs) for flat and natural before Punctum, Podatus/Clivis
  with B in each constituent position, Scandicus/Torculus/Porrectus and
  Climacus, line/space positions, C/F clefs, close preceding ink,
  two different B registers at one boundary, and system starts.
  Compare scale-normalized crops and measured editor ink/advances to
  actual printed/Gregorio examples. Distinguish demonstrated historical
  cases from extrapolation for unusually wide neumes; do not assert
  exact print fidelity from generated GABC alone.
- Use traditional square-notation signs, not arbitrary Unicode/font
  metrics. Derive reproducible geometry; preserve existing notehead
  silhouettes, staff coordinates and print geometry.
- If an actual printed score requires unsupported note-internal or
  floating signs, retain the evidence and stop that affected design
  decision; do not silently extend the vocabulary. If safe legible
  geometry conflicts with the shared measured layout or Accepted ADRs,
  present evidence and options to the owner before divergent changes.

## Workstreams

Implement in small coherent commits on this branch. Investigate the
existing code and choose the smallest changes that realize the contract;
these are responsibility boundaries rather than a prescriptive file list.

### 1. Semantic model, ordering and pitch derivation

- Add distinct `ChantAccidental` entities and `ChantDocument.accidentals`;
  preserve the seven neume kinds, note identities and modifiers.
  Validate exact fields, unique IDs across every collection, live B
  owners, canonical earliest matching B and at most one sign per
  neume/register. Use a required empty array in blank/new and migrated
  in-memory documents. Audit all factories, fixtures, command candidates
  and ID allocation/collision checks.
- Extend the existing score-order traversal with derived prefixes;
  preserve existing division/clef ordering, insertion boundary
  vocabulary and reanchoring. No free-standing accidental insertion slot
  and no insertion between accidental prefix and owner neume. Do not
  change a lyric anchor to an accidental ID.
- Implement pure effective-pitch derivation from relative diatonic
  degrees and active clefs. B is normalized degree modulo 7 = 6.
  Resolve authored signs before the containing neume and reset all
  registers at each word start and each of the four divisions.
  Continuation syllables, additional neumes on a syllable, absent lyrics,
  and clefs/wrapping alone do not reset. Natural clears only its register.
  Retain written presence separately from inherited pitch.
- Isolate register-key/transition logic for possible future pitch-class
  interpretation; do not expose alternate policy, settings, extra fields
  or playback now. Avoid a second persisted pitch model or a rendering-
  dependent interpreter. The semantic resolver must operate without SVG.

### 2. Commands, ownership and clef preflight

- Author/update/remove a sign by selecting a B note; look up the existing
  sign for its neume and register, irrespective of which matching B is
  selected. First matching B is canonical owner. A replacement of kind
  preserves ID; duplicate writes/no-op requests do not create history.
  Explicit glyph deletion removes the sign alone.
- Audit note and neume move/delete/normalization, insertions and any
  existing split/merge paths. Remove signs if their original owner is
  deleted or moves off B. No automatic reanchor to a surviving inheriting
  note on owner deletion. Preserve sign with surviving B owner and follow
  its new register; normalize canonical owner after valid edits as in
  ADR 0021. Reject an edit that would conflate distinct authored signs at
  the same neume/register, with a clear accessible explanation. No silent
  loss/merging of authored signs. Recalculate inherited state, not new ink.
- Audit initial and explicit-clef insert/update/delete transforms.
  Initial clef edits always preserve melody. Existing explicit-clef mode
  selection and staged Apply/Cancel remain. Keep pitches preserves
  effective chromatic pitch, stable IDs and authored signs over the
  whole score, including notes after a later clef boundary. Use existing
  effective-offset machinery and safely derive the untransposed candidate's
  offsets before final strict validation; an intermediate non-B owner
  must not block a valid keep-pitches operation.
- For Keep note positions, preflight the proposed final document and
  identify exact authored signs invalidated by the owner ceasing to be B.
  Preserve staff positions and valid B owners, count removed flats and
  naturals (not inheriting notes), warn only if removal is necessary,
  allow Cancel, and commit the operation plus removals atomically.
  The existing visible preselected mode remains the choice; do not ask
  the pitch-mode question again on insertion/Apply. Integrate the warning
  with the existing conditional deletion flow, and maintain draft-only
  arrow-key edits. Guard against stale candidates and pending workflows.
  No loss on Cancel, no new entry on no-op, one entry on confirm, and
  exact Undo/Redo including redo branches and synchronous cache writes.
- Preserve no-op/referential identity conventions and unaffected objects.
  Keep selection/target state transient, not persisted.

### 3. Measured engraving and interaction geometry

- Design measured flat/natural geometry in the authoritative placement/
  layout pipeline. Place at owner's B staff coordinate under effective
  clef, before entire neume, after the preceding boundary's divisions
  and clefs. Different registers can share the prefix, ordered by first
  affected constituent; one sign for repeated same-register B.
- Include all sign ink and clearances in advances, system bounds, hit/focus
  targets, line wrapping, responsive overflow, and combined lyric/music
  spacing; preserve lyric alignment to the actual neume. Account for
  adjacent note modifiers, clefs, divisions, ledger lines, custodes and
  system-start clefs. Do not apply unrelated vertical-tick screen hints
  or unmeasured renderer-only decoration.
- Keep a prefix and its owner neume together at wrap. At a new system,
  derived system clef precedes the signs; preserve active accidental
  state across automatic wrapping. A mid-score clef's own wrapping
  behavior remains governed by ADR 0015. No sign stranded at the end
  of a previous system, no duplicate automatically drawn sign at wrap.
  Oversized atomic groups follow existing bounded overflow/progress
  policies rather than infinite rewrap or dropped ink.
- Verify insertion ghosts/preview, score hit and keyboard navigation
  agree with committed layout and existing mode guards. Do not expose
  a false insertion gap between a sign and its owner.
- Keep print and SVG export paths (where supported) consistent with
  canonical ink; no separate pitch or positioning engine.

### 4. Editor UX

- Extend the existing contextual note-properties overlay, not a new
  toolbar mode, permanent top inspector or duplicated state.
  On B show written accidental None / Flat / Natural and a clear
  effective pitch label distinguishing inherited vs written vs default.
  For non-B omit or disable accessibly. Preserve focus, scroll, viewport
  placement, native keyboard interactions, responsive/320px behavior,
  and existing Form/Mora/Episema controls.
- In a B–C–B Torculus and B–A–B Porrectus, either B exposes the same
  single written sign; both effective pitches reflect it. For a B with
  only an earlier inherited flat, None does not cancel the inheritance;
  choosing Natural explicitly authors a cancellation.
- Give authored glyphs real selectable/focusable hit targets and
  accessible labels. Select the glyph directly and edit kind or delete
  it without selecting/removing the owning note; support keyboard Delete,
  appropriate focus after removal, and normal Undo/Redo. Distinguish
  authored glyph selection from note selection and derived signs.
- Implement the targeted destructive-clef warning from ADR 0021 using
  the existing pending/confirmation UX. Show number of written
  accidentals to remove and explain that the chosen clef change makes
  their owners non-B. Do not warn for ordinary edits that lose none.
  Keep the current selected mode unchanged on Cancel.

### 5. Strict native v5, recovery and tests

- Version 5 writes require `accidentals` even if empty, with strict
  exact authored entity keys and types. v1, finalized v2, v3 and v4
  must remain exact original readers; migrate to an empty in-memory
  collection without injecting fields into the original source.
  Reject a v5-only field in a v1–v4 envelope, and missing/null/invalid
  v5 collection, invalid anchors/ownership/register/IDs, duplicates,
  extra keys and unsafe arithmetic. Keep established native format,
  limits, withdrawn draft-v2 classification and recovery behavior.
- Update legacy fixture expectations for the normalized in-memory
  shape, not the original legacy JSON. Preserve genuine v1/v2/v3/v4
  coverage using immutable fixture data. Preserve Pater Noster v4 and
  its five vertical episemata; loading an example through the native
  reader is not a reason to rewrite its source file. Adjust any tests
  conflating raw envelope version, decoded model and current save
  version. Update future-version rejection probes to v6.
- Audit the browser cache, all New/Import/Export/Load example/history
  flows and version-dependent browser drivers. Untouched old caches
  hydrate without writes; next committed action writes v5 once.
  Maintain original-byte recovery, 1 MiB protection, conflicts,
  blocked writes and confirmed replacement. No new storage key or
  backend, and no relaxation of prior versions' exact validators.

## Verification and acceptance

Add focused pure tests covering these concrete cases as well as the full
regression suite. Verify actual results, not just expected outcomes.

| Case | Expected |
| --- | --- |
| C3 relative degree -1 and +6; C/F clefs on each staff line | Identify B correctly, including negative degree and different registers |
| B-flat before B, then B within same word, then next word | First two flat, next word natural |
| Same syllable across multiple neumes / continuation syllable | State persists |
| Any of minima/minor/maior/finalis, including minima within word | All register states reset before the next neume |
| Flat then natural inside word; redundant natural and repeated flat at later boundary | Explicit signs retained, correct derived states; no generated natural at reset |
| Two B registers in one scope | Independent flats/naturals; division and word reset both |
| No lyrics / missing anchor; automatic wrap / clef change alone | No artificial reset; correct effective clef and placement |
| B–C–B Torculus and B–A–B Porrectus | One sign; both matching B constituents affected; either B edits same entity |
| B second/third in other compound | Sign before whole neume; first non-B unaffected |
| Wide neume with two B registers | Two independently positioned signs; deterministic prefix order |
| Delete first vs last B in repeated-B compound | Owner deletion removes sign, other deletion preserves; no retargeting on deletion |
| Delete non-owner middle note, normalize neume, move owner B to other register | Surviving valid sign follows owner; canonicalize where necessary |
| Move owner off B, delete owner neume including last | Remove owned signs, no orphan; inherited notes recomputed |
| Delete glyph or set None on shared written sign | Remove only sign, retain notes; earlier inherited state may still apply |
| Distinct signs converge on same register/neume | Reject ambiguous edit with no semantic/history/cache mutation |
| Keep pitches, initial/explicit insert/update/delete clef | Same full relative chromatic pitches and sign IDs; positions adjust only as necessary |
| Keep note positions; zero vs multiple signs invalidated | Immediate when zero; otherwise exact count, Cancel unchanged, confirm one atomic entry |
| Unaffected passage after later explicit clef | Unchanged note pitches and signs outside affected range |
| Arrow-key clef draft, stale candidate, rejected overflow | No intermediate authored loss/write; warning only at commit; invalid action atomic |
| v5 round trip with mixed authored forms/signs, divisions and clef changes | Exact semantic values and identities; strict malformed-input rejection |
| Legacy v1–v4, incompatible draft v2, cache conflict/failed import | Original compatibility and recovery protected |
| Signed groups near system end / same-word compaction / 320px | Prefix and neume never separate; measured ink/hit bounds, bounded wrap progress |

Add dedicated accidental browser verification in
`docs/verification/b-accidentals/`. Use disposable Chromium/CDP and
Firefox/BiDi profiles against the actual production preview, accounting
for the current Pages/custom-domain build base. Exercise direct and
contextual authoring on a lower system, repeated-B shared controls,
independently selectable glyphs, keyboard deletion, Undo/Redo, pitch and
clef operations including warning/cancel, selection after wrapping,
lyrics and divisions, export/import, cache refresh and older-cache
recovery. Capture representative before/after and reference-comparison
screenshots, including narrow viewport and print where applicable.

Run `npm run format:check`, `npm run lint`, `npm test`,
`npm run build`, and `git diff --check`. Run relevant existing
clef, division, layout, note-property, authored-form, bundled-example,
storage/compatibility and browser drivers with updated expected current
native version. Record actual commands, results, environment, manual
checks not run and any limitations. Foreground screen-reader speech and
other manual checks are not implied by headless automation.

## Exclusions and stop conditions

Do not add sharps, non-B accidentals, clef signatures (including flat in a
clef), within-neume alterations, floating signs, independent manual
positioning, a toolbar placement tool, alternate interpretation settings,
new neume kinds/forms, MIDI/playback/audio, GABC interchange, pagination
or broad renderer redesign. Leave blocked-autosave warning, extreme-pitch
viewport work and manual episema placement overrides separate except
direct regressions caused by Stage 8D. Do not add signs to current bundled
examples automatically.

The cross-octave historical evidence is limited; the register-specific
policy is owner-approved. Do not block the task on finding an unattainable
universal historical rule or implement both modes now. If a credible
reference contradicts the chosen policy, report it with evidence to
the owner rather than changing the agreed behavior silently.

If a material ambiguity, genuinely unrepresentable score, unsafe
candidate arithmetic or architectural conflict with an Accepted ADR
emerges, stop the affected work and return concrete alternatives and
evidence. Ordinary implementation details within ADR 0021 do not require
owner approval. Do not treat this plan as authority to alter other accepted
contracts.

## Documentation and delivery

Update owning guides (domain model, commands/history, layout/rendering,
engraving metrics, editor interactions, persistence, testing and roadmap)
to reflect implemented behavior and native v5; link ADR 0021. Preserve
historical verification records and completed plans as historical evidence.
Update README only where current feature/version/limitation claims change.

Commit implementation on this branch, open a PR against `master`, and
return its URL. Include implementation summary, historical/visual evidence,
verification results and caveats, acceptance items and any deviations.
Keep this plan available through review and mark its final status accurately
at closeout. Do not merge; the owner accepts engraving and interaction
after review and performs the merge.

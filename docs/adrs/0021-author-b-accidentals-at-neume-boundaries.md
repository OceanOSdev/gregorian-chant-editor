# 21. Author B accidentals at neume boundaries with stable note ownership

Date: 2026-11-11
Revised: 2026-11-11

## Status

**Accepted (owner-approved design, 2026-11-11).** Implementation is in PR #72; owner visual
acceptance remains pending Stage 8D review. **Owner-approved placement amendment
(2026-11-11):** PR #72's historical placement gate is resolved by allowing a
stable earlier-note engraving anchor independently of B-note ownership, as
specified below. No existing ADR is superseded.
This extends [ADR 0015](0015-order-clef-changes-at-score-boundaries.md) with
derived accidental ordering and a narrowly scoped destructive-clef confirmation,
and [ADR 0016](0016-persist-versioned-semantic-chant-documents.md) with native v5.
ADR 0007's shared geometry contract remains Accepted; this decision is also
consistent with the still-Proposed ADR 0006 separation of notation from playback.

## Context

Gregorian square notation in the initial Roman/Solesmes scope uses written
B-flats and B-naturals. A sign is placed before a neume or note group, not
necessarily immediately adjacent to the affected constituent; its influence
can extend over subsequent notes and syllables. The sign itself is authored
notation, while its musical effect is derived. A natural may be deliberately
written even when no flat is active.

Reference evidence for the initial scope:

- [Liber Usualis, 1961, introductory notation rules](https://gregobase.selapa.net/sources/3/17.png);
  the word/barline/natural cancellation rule is also explained in
  Lura F. Heckenlively, _The Fundamentals of Gregorian Chant_, and
  _An Applied Course in Gregorian Chant_, pp. 77–78. The latter includes
  a quarter-bar within a word as a cancellation example.
- [Beata gens, Graduale Romanum (1961)](https://gregobase.selapa.net/chant.php?id=1044):
  the verse _Verbo Domini_ has a flat and subsequent explicit natural within
  _Domini_. This supports authoring cancellations independently of a word reset.
  The [printed p. 366 scan](https://gregobase.selapa.net/sources/2/408.png) also
  places a flat above the terminal F diamond on _o-_ of _omnis_, before a
  quilismatic G–A group and a later B virga. PR #72 retained the scan crop,
  exact GABC (`{ix}F0'gwh!iv`) and an actual Gregorio comparison in
  [the placement-gate evidence](../verification/b-accidentals/README.md).
  This disproves owner-neume-only placement, not register-specific scope.
- [Benedicta et venerabilis](https://gregobase.selapa.net/chant.php?id=392),
  [printed Graduale Romanum (1961), p. [76]](https://gregobase.selapa.net/sources/2/802.png):
  on _ma-_ of _mater_, a flat occurs between groups on a single syllable.
  This does not require an accidental inserted inside a connected contour.
- [Laetatus sum, Alleluia](https://gregobase.selapa.net/chant.php?id=292),
  [Graduale Romanum (1974), p. 19](https://gregobase.selapa.net/sources/4/18.png):
  the GABC sequence `ixiji` under C4 places one flat before a B–C–B
  Torculus; both Bs are flattened.
- [Ecce virgo, Communion](https://gregobase.selapa.net/chant.php?id=1144),
  [Gregorian Missal (1990), p. 184](https://gregobase.selapa.net/sources/16/183.png):
  _bi_ of _vocábitur_ is transcribed `ixihi` under C4, one flat before a
  B–A–B Porrectus. Both Bs are flattened.
- [Benedicta es tu, Graduale](https://gregobase.selapa.net/chant.php?id=713):
  the transcription illustrates the flat before a group whose first note
  is not B and the staff-relative location of flats under different clefs.
  GABC is corroborating transcription evidence, not proof of every printed
  placement. The specific scanned page was not independently verified in
  the design discussion.
- [Gregorio GABC reference](https://gregorio-project.github.io/gabc/details.html)
  is a reference for separate alteration signs, not an interchange mandate.

Medieval gamut theory distinguishes B registers (historically the lowest B
was normally natural, with higher B-flat available). Solesmes manuals permit
flats in either register. The design investigation did not establish a
conclusive Roman/Solesmes printed example resolving cross-octave inheritance
within one uninterrupted scope. Some modern parsers use pitch-class-wide
state instead. Register-specific inheritance is therefore an explicitly
chosen editorial policy, informed by history, not a claim of a universal
historical rule. Other chant traditions, including Dominican editions, can
have different cancellation rules.

## Decision

### Authored entity, owner and placement

- Add a distinct semantic `accidentals` collection. Each entity is
  conceptually `{ id, kind: 'flat' | 'natural', ownerNoteId, placement? }`.
  Optional placement is exactly `{ kind: 'above-note', noteId: string }`.
  Omission means conventional before-owner-neume placement. The ID is
  globally unique, and the owner references an existing stable-ID note
  that is B under its effective clef. The placement note is an engraving
  anchor, never the musical owner. Do not store duplicated pitch/register,
  staff position, neume anchor, inferred accidental or graphic coordinates.
  No accidental becomes a note modifier or neume kind.
- By default emit the glyph immediately **before the owner's containing
  neume**, after all divisions and explicit clefs at that boundary. It can
  precede a neume whose first constituent is not B or occur between neumes
  attached to the same syllable. Default placement and the owner neume
  remain an inseparable group for wrapping and insertion.
- Explicit above-note placement attaches the glyph horizontally to a stable
  note in an earlier neume, at the B register's staff coordinate under the
  effective clef at that placement note, not at an arbitrary vertical offset
  from its head. It takes effect immediately before the placement note in
  semantic order. It is not a new structural insertion slot, a split of the
  anchor neume or freehand placement. The sign and the placement note's
  containing neume stay together at wrapping; the owner may be on another
  system. Do not group the entire span between anchor and owner.
- Validate explicit placement in the final document: anchor and owner must
  exist, the anchor must be in an earlier neume, and the owner must be the
  first matching B in that register from the anchor onward. No intervening
  word reset, division or written sign for that register may interrupt the
  span. Clef changes alone and automatic wrapping are allowed. A word reset
  at the anchor neume's beginning occurs before the anchored sign.
  Reject ineligible explicit placement requests. Never interpret a sign
  above F as altering F. This narrow feature does not permit altering
  matching B constituents differently within a connected neume.
- One sign per B register per neume is supported. All matching B
  constituents in that neume share the same written sign, and the
  earliest matching note in semantic order is the canonical owner.
  Selecting either B of a repeated-pitch Torculus/Porrectus edits the
  same sign. Different B registers within a wide neume may have separate
  signs; their derived order is by first affected constituent, not array
  iteration or horizontal pixel positions.
- Preserve independently authored redundant signs at different boundaries,
  including explicit naturals in natural state. No inferred natural is
  drawn at a reset. No floating or trailing sign without an owner.
  Repeated signs for the same register at the same neume boundary and
  distinct alterations between matching B constituents of one neume are
  outside the initial representable vocabulary.
- Retain the existing ordered neume/division/clef collections and ADR
  0015's exact mixed-event ordering and boundary operations. Extend the
  single authoritative derived musical traversal with the accidental
  default prefixes and signs immediately before their explicit placement
  notes; no persisted unified stream or second independent ordering system.
  Structural boundary resolution may operate on the underlying
  neume/division/clef order. Derive simultaneous sign order by owner order,
  not incidental array or pixel order. Existing insertions cannot target the
  gap between a default sign and its owner neume or split an explicitly
  anchored sign from its placement neume.

### Effective pitch

- Use the existing relative diatonic degree, `staffPosition + clefOffset(clef)`,
  with C = 0 and F = 3 at their clef reference positions (ADR 0014).
  B is degree congruent to 6 modulo 7, including negative degrees.
  Use safe arithmetic and explicit normalized modulo; never introduce
  absolute concert-pitch or MIDI fields. An authored sign changes pitch
  interpretation, not the stored staff position or neume contour.
- Walk musical order once, using effective clefs and existing lyric anchors.
  Start natural. Reset all active register-specific flats at a new word
  (`boundaryBefore: 'word'` at the anchored syllable's first neume)
  and at every authored division (minima, minor, maior, finalis).
  A continuation syllable or another neume of the same syllable does not
  reset state. For an untexted passage, absence of a lyric anchor is not
  an invented word boundary. Word reset occurs before the sign at the
  new word's first neume. Clef changes alone, repeated system clefs,
  custodes, and automatic wrapping do not reset state.
- A flat sets the affected register's state; a natural clears it.
  Apply a default prefix before interpreting every constituent of the owner
  neume, or apply an explicit sign immediately before its placement note.
  Subsequent B notes in that register inherit the state until reset or
  another sign. Other pitches and other B registers are unchanged.
  Represent written presence and effective alteration separately; an
  unwritten B may be flat and a redundant written natural remains visible.
- Isolate the scope-key calculation and transition logic in a pure
  semantic resolver so a later pitch-class-wide interpretation can reuse
  the same authored entities. Ship register-specific behavior only; do
  not add a settings UI, document policy field, or generalized policy
  framework now. If future interpretation is selectable, consider a
  document-level versioned convention rather than a global preference.
  Playback remains deferred.

### Authoring, mutation and history

- Use the existing contextual note properties in Select mode. For a B,
  show written None / Flat / Natural for its neume/register (including a
  sign owned there but placed earlier), and effective pitch including
  inherited state. For non-B, omit or disable
  the control accessibly. None removes a sign owned by that neume/register,
  including an explicitly earlier placement, not a sign owned elsewhere
  whose effect is inherited. A change of kind
  retains the sign ID; no-op edits retain source identity. Explicit
  redundant signs can be authored deliberately.
- A glyph is independently selectable/focusable, including native
  keyboard selection and deletion. Its explicit deletion removes only
  that entity; notes remain. Show an accessible identity and editable
  kind or equivalent direct action, with ordinary Delete/Undo behavior.
  Normal note-centric authoring creates default placement. Selecting the
  glyph exposes an action to choose an eligible earlier note and an action
  to restore default placement. Preview/highlight eligible targets, support
  keyboard targeting and Escape cancellation, and commit a successful
  placement as one history entry. Retain sign ID, owner and kind. No
  placement toolbar or free dragging; invalid targets leave state unchanged.
- Deleting the owning note deletes its sign; deleting a merely affected
  or inheriting note does not. Deleting an owning neume removes its
  signs, with no reanchoring to the next neume or score end. Surviving
  owners follow their stable IDs through supported normalization and
  structural edits. If another surviving note becomes the earlier
  matching B due to an edit, normalize the surviving sign to the
  canonical first matching owner; first evaluate loss of the original
  owner so deletion never transfers its sign automatically. Deleting only
  the placement note or its neume retains the sign and restores default
  placement.
- After any ordinary semantic edit, revalidate surviving explicit placements
  against final order, effective register and scope. If an anchor is lost,
  moved after the owner, or separated by a new word/division reset,
  intervening matching B or same-register sign, clear the optional placement
  and retain the owner, kind and ID. Apply this repair also if canonicalization
  or pitch editing invalidates the span. Moving an anchor vertically retains
  it when still valid. Give accessible feedback when a sign returns to default;
  repair and initiating edit share one history entry. Evaluate owner loss
  first, then canonicalization and placement validity; never transfer ownership
  because of deletion. Resolve invalid placements deterministically, rechecking
  after repairs as needed. Do not repair malformed imported native documents.
- An ordinary pitch edit moving an owner to a non-B removes its sign;
  moving to another B register preserves it and derives the new
  position/state. Any resulting removal or ownership normalization is
  part of the same edit and exact history snapshot. Do not silently
  merge two distinct authored signs if a compound edit would put them
  at the same neume/register: reject that ambiguous edit with an
  accessible explanation and allow explicit removal/retry.
- Insertion/removal/movement of other notes, lyric edits, divisions and
  clefs may change inherited effects; do not materialize additional
  authored signs to compensate. The clef-preservation guarantee below must
  be met without inventing signs. All successful edits preserve unrelated entity identities,
  follow existing commands/history/autosave, and can be undone/redone
  atomically. Pending-workflow guards apply.

### Clef changes

- Initial clef edits retain ADR 0014/0015's automatic Keep pitches behavior.
  Explicit clef insertion, staged editing/Apply and deletion retain ADR
  0015's effective-range comparison and current pitch-mode workflow.
- Keep pitches must preserve the effective chromatic pitch of every
  surviving note, in addition to relative diatonic pitch. Transform note
  positions and derive signs' staff coordinates from unchanged B registers
  using the clef at each written location; preserve sign IDs, kinds and
  valid placement anchors. Do not let strict accidental
  validation of an intermediate, untransposed clef candidate prevent
  a valid preservation transform. Validate the final candidate.
- Keep noteheads retains staff positions and reinterprets pitches.
  Retain signs whose owners remain B (following the new register);
  remove signs whose owners cease to be B. Before any such removal,
  show a targeted confirmation counting **written accidentals**, flats
  and naturals alike, explaining that the clef operation will remove
  them. Revalidate surviving explicit placements against final pitches and
  restore default when invalidated; this is not deletion of a sign.
  Cancel leaves the committed document, history, redo branch and
  cache unchanged; confirm commits the final clef edit and removals
  together, once. Only the affected effective-clef region is considered.
- This is the sole qualification of ADR 0015's no-second-prompt rule:
  one-click insertion and normal Apply are still immediate when no
  written signs would be removed. A destructive insertion is preflighted
  at the selected boundary before committing. Existing-clef arrow keys
  continue adjusting the transient draft; the warning occurs at Apply,
  not at every arrow. For deletion, integrate the loss warning with
  the existing conditional pitch-mode confirmation rather than adding
  redundant dialogs. Do not introduce a generic preservation prompt,
  change mode implicitly or apply partial edits. Undo/redo never asks
  again; stale candidates and competing semantic edits are guarded.

### Persistence and engraving

- Write strict native **v5**, requiring the new collection (empty when no
  signs). Exact v1, finalized v2, v3 and v4 readers retain their original
  field whitelists and derive an empty in-memory collection on decode.
  No invented signs, rewritten IDs or hydration writes. Reject invalid
  kinds, keys, IDs, duplicate/conflicting signs, invalid/noncanonical
  owners or non-B owners under the final effective clef, invalid/extra
  placement fields (including null), missing or ineligible anchors and
  interrupted placement-to-owner spans. Validate ID
  uniqueness across all semantic entities. Preserve withdrawn draft-v2
  recovery, 1 MiB limit, original source recovery, cache key, conflict
  protection and synchronous committed writes under ADR 0016.
- Derive measured traditional square-notation flat/natural glyph geometry,
  anchor and hit/focus bounds in the authoritative layout pipeline.
  Respect staff lines, ledger needs, preceding ink, clefs/divisions,
  neume connectors and all existing note forms/modifiers, lyrics and
  custodes. Default prefixes consume real width and all placement ink contributes to wrapping,
  same-word compaction, overflow and print. Do not use unmeasured
  renderer-only decorations, change the semantic contour, or change
  the lyric's neume anchor. For an above-note sign derive horizontal
  alignment from the placement note's measured ink and vertical alignment
  from the owner's register under the placement clef. Measure its ink, hit
  region, clearance and any required advance in the same layout pass.
  Keep it with its placement neume at wrap, not the later owner. On
  continuation systems use the effective clef at the written location.
  Do not silently shift a sign to a different anchor to resolve collisions;
  use evidence-supported measured geometry or return to the owner if a
  faithful, legible result is not achievable.
- Preserve the exact bundled Pater Noster v4 source and all other
  authored example files. Add separate dedicated accidental specimens.

## Consequences

### Positive

- One written sign can represent all historically affected matching
  constituents and inherited B notes without duplicating notation.
- Owner-relative placement, explicit deletion and stable identities
  make the sign predictable through note and clef editing.
- The same authored data can support a future alternate scope policy
  without re-encoding the signs.
- Existing notation, score ordering, geometry and versioned recovery
  boundaries remain authoritative.

### Negative

- All semantic mutations, validation and native decoding must account
  for the new collection; clef transformations require preflight before
  final validation.
- Register-specific inheritance is a chosen initial policy; the historical
  cross-octave ambiguity is not resolved by this implementation.
- Deleting a canonical owner can change the effective pitches of surviving
  dependent notes; this is intentional and undoable.
- The initial vocabulary cannot represent a floating accidental, distinct
  same-register alterations between matching constituents, or consecutive
  same-register signs at one boundary. Collect reference evidence and return to the owner
  if a real score requires them.
- Excludes signatures, sharps, non-B alterations, freehand placement, alternative
  scope settings, playback, GABC interchange and new neume forms.

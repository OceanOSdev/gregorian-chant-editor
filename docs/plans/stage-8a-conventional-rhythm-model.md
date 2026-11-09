# Proposal: conventional rhythmic modifiers for Stage 8A

PR #64, 2026-11-09. **Approved by the owner for implementation.** The owner
approved the presence-plus-pattern model, exact table and draft-v2 finalization
with original-source recovery. [Accepted ADR 0018](../adrs/0018-conventional-mora-patterns.md)
now supersedes ADR 0017. The proposal below preserves the approved rationale;
[implementation verification](../verification/note-modifiers/conventional/README.md)
records actual results separately.

## Recommendation

Replace an arbitrary dot count with **presence of one ordinary mora on each
affected note**, constrained to a small supported set of conventional patterns.
A compound double sign represents **two distinct affected notes**, not two
moras on one note. Derive that sign from the final pair's marked notes; do not
store a second, competing ownership representation or introduce sign IDs.

For the minimal revision, keep the existing literal `mora: 1` as the presence
flag and omission as off; remove `2` from the proposed canonical domain.
Conceptually this is boolean. Keeping the literal avoids an unnecessary encoding
change for already meaningful draft-v2 single-mora data. It is not a duration,
multiplier or an expandable numeric count. `episema?: true` remains independent.

## Evidence: notation, software capability and editor scope are different

The [printed instruction and actual Gregorio probes](../verification/note-modifiers/rhythm-model/README.md)
distinguish the ordinary one-note dot from a compound double sign. The selected
reference profile is modern Solesmes-style square notation, not a claim about
all manuscripts or every rhythmic school. No playback timing is proposed.

Gregorio's general GABC guide permits periods on notes and doubled periods.
Its writer, however, gives the double syntax a specific compound interpretation:
the affected current and preceding notes in ordinary final-position use.
It also accepts singleton doubles and earlier-note signs as permissive
fallbacks. Successful compilation does not prove a conventional interpretation
for every combination. Its internal glyph grouping need not equal our semantic
neume grouping; Climacus, for example, is painted from several glyphs.

The existing model gets **stable note ownership, single-mora presence and
independent episema** right. It goes too far in treating `2` as a second mora
on that same note and in promising arbitrary combinations on all constituents.
The demonstrated equal-pitch Porrectus aliases expose that mismatch. An initial
mora on a three-note group is not universally forbidden in chant; this proposal
defers such source-specific cases rather than inventing notation for them.

## Initial supported patterns — an explicit product boundary

Indexes below are musical tuple order, not horizontal or vertical order.

| Neume     | Allow mora on                            | Defer in this profile                           |
| --------- | ---------------------------------------- | ----------------------------------------------- |
| Punctum   | Sole note, or none                       | Any single-note double sign                     |
| Podatus   | First/lower, second/upper, both, or none | Two dots assigned to either individual note     |
| Clivis    | First/upper, second/lower, both, or none | Two dots assigned to either individual note     |
| Scandicus | Final note, final pair, or none          | First-only, middle-only, first+third, all three |
| Torculus  | Final note, final pair, or none          | First-only, middle-only, first+third, all three |
| Climacus  | Final note, final pair, or none          | First-only, middle-only, first+third, all three |
| Porrectus | Final note, final pair, or none          | First-only, middle-only, first+third, all three |

This is intentionally narrower than Gregorio's input language. Middle-only
moras on some three-note shapes are representable there, but do not need to be
promised by this milestone. Deferring them also avoids relying on small optical
offsets to distinguish a middle-line mora from a final-space mora in an
adjacent Scandicus. Broader support should require a sourced, unambiguous
rendering rule for each new pattern, not another arbitrary count.

Horizontal episema stays available on individual notes under the existing
automatic placement contract, including an initial note whose mora is not
supported. An episema is **not** an automatic substitute for a mora: commands,
imports and migration must never exchange them silently. Approved contours,
pitches and lyric anchors remain unchanged.

## Concrete authoring and rendering examples

| Author's choice                         | Canonical note data                | Finished notation                                                          |
| --------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| Dotted Punctum `g.`                     | Sole note has `mora: 1`            | One ordinary dot                                                           |
| Dotted lower Podatus `f.g`              | First note has `mora: 1`           | One dot associated with lower note, with conventional line/space placement |
| Podatus final pair `fg..`               | Both distinct notes have `mora: 1` | Conventional double sign affecting both notes                              |
| Clivis final pair `hf..`                | Both distinct notes have `mora: 1` | Conventional compound double sign                                          |
| Porrectus final mora `hfh.`             | Only note 3 has `mora: 1`          | One conventional trailing dot                                              |
| Porrectus final pair `hfh..`            | Notes 2 and 3 each have `mora: 1`  | Two conventional dots for the low endpoint and upper terminal              |
| Equal-outer-pitch Porrectus first-only  | Not authorable under this profile  | No invented alternative glyph, offset code or ownership string             |
| Double on Punctum or one Porrectus note | Not authorable                     | Never interpreted as extra augmentation of that one note                   |

GABC here is a reference example, not a new interchange adapter. The literal
GABC `..` is shorthand to compare with the final-pair choice; it is not copied
onto one note's count in our document.

The pair's geometry must be derived **as a pair**, rather than blindly painting
one identical dot recipe per flag. This matters for adjacent line/space
positions and for compound shapes. It may differ from Gregorio's rendering of
two separately authored `.` signs while retaining the same two affected notes.
An internal derived result could identify `single(noteId)` versus
`auctumDuplex([penultimateId, finalId])`; it is not another persisted object.
Shared measured ink remains authoritative for bounds, advances and wrapping.
A narrow conventional-rule audit of Podatus and the other supported pairs is
part of implementation, not just the existing Porrectus exception.

## Alternatives considered

1. **Recommended: note-level presence plus validated patterns.** Keeps affected
   stable IDs authoritative, makes the common pair unambiguous, and naturally
   preserves surviving marks through deletion. Pair intent is an atomic command
   affecting two notes; engraving derives the conventional double form.
2. **Explicit neume-owned sign object.** A union such as single-with-note-ID or
   duplex-with-two-note-IDs is defensible if authored sign identity must later
   differ from affected-note meaning. Today it adds references, pair validation
   and deletion rewriting without an established need to distinguish those
   equivalent intentions. Do not also retain note flags as another authority.
3. **Neume-relative ending enum.** None/final/final-pair is concise, but needs a
   first-note exception for two-note kinds and careful deletion handling to
   avoid retargeting a sign onto a previously unmarked survivor. It gives up
   useful existing note ownership for little benefit here.

If a future edition needs two independently drawn single signs to remain
semantically distinct from one conventional double sign on the same pair,
revisit alternative 2 with evidence. This proposal canonicalizes the affected
notes and does not preserve arbitrary GABC spelling as semantic meaning.

## Editor and command behavior

Use explicit contextual **Mora scope** choices: Punctum None/Sole note;
two-note kinds None/First/Second/Both; three-note kinds None/Final note/Final two.
The group is named for the owning neume, independently of the selected-note
episema control. Remove “Double dot on selected note.” Choosing Final two writes
both flags in one history/autosave action; choosing Final note removes the
penultimate flag explicitly as part of that named scope choice. No hidden edit
is triggered merely by selecting another note.

Keep keyboard pitch editing, selection IDs, stable control location, lyric
workflows and normal history guards. No new palette tool or score label is
needed. Disabled/unavailable choices should explain the supported profile in
editor controls, not place a warning glyph into the chant. A shared pure
pattern validator must govern commands, native loading and UI availability.
Rejected intents return exact document identity and do not autosave.

For example, deleting note 3 from a marked Porrectus final pair preserves the
mora on surviving note 2 when the kind normalizes to a two-note neume. Deleting
note 2 preserves note 3's mora; deleting note 1 leaves the pair intact on the
same two IDs. Never infer a new pair from whichever notes happen to remain.
Pitch and whole-neume moves preserve flags and IDs. Unsupported normalization
continues to reject atomically under the current contour rules.

For a source needing an excluded early-note mora, explain that it is outside
this profile. A different authored grouping might be appropriate, but **do not
automatically split a neume or change its rhythmic mark**. The author must decide
that grouping from the source. A future split command preserving note IDs is a
separate feature; it is not required to implement this restricted profile.

## ADR and native-v2 decision required before implementation

ADR 0017 decision 1's arbitrary one/two-per-note promise and its all-constituent
scope need explicit replacement. Its stable-ID, immutable-command, derived
geometry, episema, v1-compatibility and no-playback decisions remain useful.
After approval, preferably write a superseding ADR that records this narrower
model and compatibility policy, linking the historical accepted decision. Do
not silently edit its accepted meaning during implementation. Update the
owning guides, Stage 8A plan and acceptance tests in the same approved change.

**Recommended pre-merge policy:** finalize the still-unmerged v2 using the
existing `mora: 1` presence spelling and the approved pattern validator. Declare
the arbitrary-count v2 from earlier PR commits a withdrawn **development draft**,
with an explicit legacy-reader/recovery path. This is a deliberate compatibility
restriction, **not a claim of complete backward compatibility with every draft-v2
score**. Unmerged does not mean no one exported files or has valuable autosaves.
The owner must explicitly approve this draft-finalization policy.

- V1 files/autosaves still decode exactly with no marks and all original IDs.
- Draft-v2 documents already satisfying the new profile load without changing
  note values or identities. Export continues writing v2 with literal `1` only.
- Validate known draft-v2 input against its old strict shape first. If it contains
  `mora: 2` or excluded combinations, return **resolution required**, identifying
  affected notes; do not call valid legacy JSON corrupt or adopt it as a valid
  new canonical document. Unknown fields/future versions remain rejected.
- Never map `2` automatically to `1`, to a final pair, or to a duration. Never
  move a first-note mora to the last note or silently discard it. Its original
  authorial intent cannot be inferred from the number alone.
- Import leaves the active score unchanged until a valid replacement is explicitly
  accepted. Protected cached bytes remain untouched and automatic saving stays
  blocked. Preserve/download the **original saved bytes**, not merely Export of
  the fallback example; a minimal raw-source recovery action may be needed.
- Resolution can explicitly choose a supported scope, revise grouping, or keep
  the source for a compatible earlier build. No conversion assistant or bulk
  replacement should be assumed authorized by this proposal.
- Retain the existing single cache key and byte-conflict/replacement safeguards.
  No new key may abandon old v1/v2 bytes. No startup rewrite is allowed.

If the owner wants full compatibility with the earlier PR's v2 contract as a
stable obligation, use **v3**, retaining exact v2 decoding into a legacy form and
requiring the same explicit resolution for incompatible states. A version bump
alone cannot resolve what old `mora: 2` was intended to mean. The recommended
note model does not depend on which of these two release policies is chosen.

## Implementation acceptance after owner approval

Verify every allowed pattern for all seven kinds over line/space, adjacent/wide
intervals and episema coexistence. Assert that distinct allowed affected-note
sets do not collapse to the same visible notation; confirm conventional pair
placement against source examples. Reject disallowed values/patterns in commands
and native input without mutation, history entries or destructive cache writes.
Cover movement, all deletion-normalization paths, atomic scope undo/redo, v1 and
supported-v2 round trips, and unsupported draft recovery with byte preservation.
Run standard automated checks and production Chromium/Firefox verification,
including selected-note versus neume-scope labels, stable placement at 320px,
focus/history and native file/cache behavior. Preserve the approved silhouettes.

**Owner approval recorded:** the presence-plus-pattern model, supported table
and draft-v2 finalization were approved. A/B/C remain rejected historical material.
The verification below concerns the earlier investigation only.

## Investigation verification

Compiled and visually inspected 35 actual Gregorio reference inputs; the
retained output inspector passed all 35 cases. The existing modifier-command,
Porrectus-layout and native-persistence tests passed (4 files, 71 tests).
Repository formatting and `git diff --check` passed. These checks validate the
research artifacts and unchanged implementation, not the proposed model.
Application Chromium/Firefox checks were not rerun for this documentation-only
change; browser acceptance of any future implementation remains required above.

# Plan: Stage 9C — intra-syllable grouping and engraving

Branch: `design/stage-9c-intra-syllable-grouping`
Target: `master`
Base: `eb3dd67` (PR #81 merged after Stage 9B-3).
Status: bounded design/research complete (2026-11-14); owner Gates A–D and
Proposed ADR 0026 pending. No implementation is authorized by this plan.

Deliverable: [reference and decision record](../verification/intra-syllable-grouping/README.md),
including actual print crops and matched reference inputs/renderings, and
[Proposed ADR 0026](../adrs/0026-derived-intra-syllable-spacing.md).
Recommendation: retain anchor-derived membership/native v9, close independent
engraving with conservative barriers, and existing editing operations. Stop
for owner review; implementation checkpoints require a separate approval.

## Goal and current baseline

Make melismatic chant legible and authorable by distinguishing membership
in a syllable from the visual separation or connection of its constituent
neumes. A primary repertoire target is Kyrie XI (Orbis Factor), but this
stage need not deliver the complete score or unsupported kinds.

Read AGENTS.md, [AI workflow](../ai-workflow.md),
[domain model](../domain-model.md), [commands](../commands-and-history.md),
[interactions](../editor-interactions.md), [layout](../layout-and-rendering.md),
[persistence](../persistence.md), and the relevant actual code. Start with
accepted ADRs 0002–0004, 0007–0013, 0015–0016, 0018–0025 as relevant;
particularly ADR 0008 (anchor membership), 0010 (whole-neume wrapping),
0011 (word composition), 0013 (division exception), 0021 (accidentals)
and 0025 (left ink origin).

Important baseline correction: the model ALREADY represents multiple
independent neumes on one syllable. `startsAtNeumeId` is a unique,
ordered anchor; `findSyllableForNeume` derives membership until the next
anchor or document end. Before the first anchor there is lyricless music.
There is no explicit lyricless tail. Do not describe this as a missing
membership model. ADR 0008 intentionally rejected redundant ownership.
Music insertion does not move anchors; deleting an anchored neume removes
its syllable atomically, even if its former span contains other neumes;
normalization retains stable anchors. Lyrics mode can skip neumes and
reassign anchors without changing music. Inspect the actual implementation
and identify usability gaps rather than assuming new commands are needed.

Ordinary inter-neume gap is 33 layout units; ADR 0011's compact gap
policy is for successive same-word syllable anchors, not melismatic
neumes. ADR 0013 expressly permits divisions within melismas without
creating lyric boundaries. Clef, division, accidental and lyric events
retain independent semantic ownership. Current wrapping keeps each neume
whole, not whole syllables; continuation hyphens are between actual
syllables, not automatically inside a melisma.

## Research deliverable (bounded, not a new notation encyclopedia)

Reuse existing [et/lux investigation](../verification/word-composition/et-lux-review.md)
and [auditione investigation](../verification/word-composition/auditione-review.md).
The et(hh) record already establishes independent repeated puncta under
one lyric, first-note vowel alignment and normalized center separation
about 1.46 head widths in the reference versus 3.75 in the editor.
Verify the existing evidence and current supported transcription; do
not generalize this one measurement to all pairs. Distinguish two
ordinary puncta from Bistropha/Tristropha or other authored forms.

Inspect actual Roman/Solesmes print examples, including:

- the Requiem gradual (GregoBase id 1261), et(hh) and the longer
  perpetua melisma, and an ordinary word-spacing control;
- Kyrie XI Orbis Factor (GregoBase id 2982; Liber Usualis p. 46),
  at least two representative multi-neume syllables, preferably one
  long melisma and one shorter case; note the exact edition/page,
  syllable, pitch sequence, group decomposition and unsupported shapes;
- one relevant printed melisma with a division inside it or a
  cross-system continuation, if a suitable case is located.

Primary starting references:

- [Requiem gradual, GregoBase](https://gregobase.selapa.net/chant.php?id=1261)
- [Kyrie XI, GregoBase](https://gregobase.selapa.net/chant.php?id=2982)
- [Liber Usualis scan](https://archive.ccwatershed.org/media/pdfs/18/11/29/00-45-28_0.pdf)
- [Gregorio GABC](https://gregorio-project.github.io/gabc/)
- [Gregorio grouping structure](https://gregorio-project.github.io/structure.html)
- [Gregorio graphical alignment](https://gregorio-project.github.io/graphy.html)

Compare matched printed crops and, where useful, Gregorio renderings
with GABC inputs; distinguish explicit separation, default parser
partition, forced joins and actual printed connections. GABC is an
encoding/reference, not automatically our semantic model. Separate
musical contour, syllable membership, spacing, ligature/fusion,
notation-specific grouping and editorial typography. Record relative
ink gaps (normalized to head width or staff spacing), alignment and
relevant pitch/mark context where measurable; avoid copying a single
absolute gap or treating all source line justification as a universal
rule. Document source/version, page/location, actual vs inferred
reading, and gaps. A small representative corpus is enough; do not
transcribe the entire Kyrie or exhaustively search all chant books.

## Owner gates and recommendations to return

### A. Semantic scope and native compatibility

Compare three approaches:

1. Retain anchor-derived syllable membership and derive contextual
   spacing between adjacent independent neumes; no new persistent
   fields (preferred initial hypothesis).
2. Retain anchors but add explicit stable boundary/grouping intent
   only if sourced distinctions cannot be recovered from the current
   model and users need to author them. Specify exact semantics,
   invariants, deletion/insertion and stale-anchor handling, and
   strict version migration if proposed.
3. Replace membership with explicit collections/ownership. Explain
   what concrete requirement cannot be met by the anchor model,
   costs of redundancy and how independent music entry survives;
   do not recommend this merely because grouping is the feature name.

Recommend the smallest useful scope. In particular, do not turn every
melisma into a giant tuple, relax existing neume invariants or merge
two puncta into a repeated-note kind merely because they are adjacent.
Do not introduce native v10 unless an approved persisted semantic
distinction actually requires it. If a layout-only change is sufficient,
preserve v9 and exact v1–v8 reading/recovery. If schema changes are
proposed, specify strict historical decoding and no silent source
rewrites or autosave cache key changes.

### B. Engraving, spacing and wrapping

Propose a general contextual spacing policy with an evidence-supported
initial metric range and rules for eligible boundaries. Explicitly
distinguish:

- two independent neumes within the same derived syllable;
- successive distinct syllables of the same word (existing compaction);
- new word and lyricless music (ordinary rule);
- intervening division, explicit clef, accidental prefix or separate
  placement anchor, and system boundary;
- close but separate ink vs genuine joins or other grouping distinctions.

Prefer an initial milestone of close-but-independent neumes, unless
actual examples demonstrate a necessary narrower join operation.
Do not presume that every same-syllable pair joins or that any specific
GABC grouping control should be persisted. If fusion is needed, propose
a separately gated design with precise eligibility, graphical ownership
and stable semantic identities, and say whether it is necessary for
the initial milestone. No general fusion engine in this research phase.

Retain kind-specific lyric anchors and vowel/manual alignment (the et
reference supports first-note alignment, not centering the span).
Preserve each independent neume as a wrap unit, permit long melismas
to span systems, and specify how continuation across lines appears
without fabricating syllables/hyphens. Preserve combined ink/lyric
clearance, exact-fit/oversized progress, custodes, all modifier and
accidental bounds, font fallback and hit/selection ownership at tight
gaps. Address how existing word continuation after a melisma is
handled without changing linguistic boundaries. Identify what would
qualify ADRs 0010/0011/0013; no implicit amendments.

### C. Editing and history

Walk through concrete editing examples on an ordered score, including
music-first entry, existing lyric-first/continuous-entry skip workflow,
inserting before/inside/after a span, adding a new syllable anchor to
split it, moving an anchor, deleting a non-anchor and an anchored
neume, deleting a lyric, and undo/redo. Show the exact affected IDs
and resulting spans. Distinguish already supported actions from new
interaction needs; do not invent a reorder feature without a
requirement.

Preserve the existing anchored-neume deletion contract unless a
specific owner-approved change is justified. Consider explicit,
non-destructive anchor reassignment before deletion or a distinct
operation if melisma editing warrants it; never silently migrate
the lyric or change existing Delete behavior. Preserve independent
note/neume selection, one-click entry and I/T/L, draft safeguards,
focus, stable IDs, divisions/clefs and written accidental ownership
and scope. No group-wide pitch move, new selection hierarchy or
manual grouping UI unless justified and separately approved.

### D. Phasing, acceptance and ADRs

Recommend a minimal first implementation checkpoint based on the
above findings. If anchor-derived layout suffices, do NOT invent a
domain/persistence rewrite merely to fill a phase. Separate semantic
changes (if any), layout/engraving and UI additions (if any) into
small handoffs with committed checkpoints. Specify the order and
compatibility boundaries; recommend whether these should be separate
PRs or commits on one implementation branch.

Return a concrete verification plan: independent membership/spacing
oracle, reference fixtures (exact supported vs approximated), measured
ink/text and sign clearance, system wrapping/long spans, no internal
hyphen, divisions/clefs/accidentals, old word/lyricless behavior,
pointer ownership and 1440px/320px both browsers, insertion/deletion/
history/roundtrip as applicable. Keep the 14 existing kinds and
historical evidence intact. Identify affected existing drivers; a new
driver only if needed. Comprehensive matrix only at integrated
acceptance, preferably owner-run; no repeated full runs.

Prepare Proposed ADR(s) starting at 0026 (confirm numbering) identifying
which accepted contracts would be narrowly qualified or extended, and
the evidence/alternatives. Do not mark Accepted, amend accepted ADRs
or update the owning guides as if a decision were made until the owner
approves the relevant gates. If a hypothesis is disproven, report it.

## Exclusions and delivery

Research-only: no production/domain/test/runner/CI changes, no new
application dependencies, no new native version, no implementation
of joins, liquescence, oriscus/salicus/pressus, other new neumes,
ledger lines, GABC interchange, playback, or complete Kyrie XI
acceptance. No unrelated fixes. Keep known headless/Firefox
intermittency and extreme-pitch limitations separate.

Commit a concise reference and decision record under
`docs/verification/intra-syllable-grouping/` with selected actual
reference crops, source identifiers and reproducible reference inputs
as useful. Update this plan's status and ADR log with Proposed
decision(s). Open a DRAFT PR targeting master. Return a concise
gate-by-gate recommendation, examples/evidence, scope and unresolved
questions. Formatting/diff and applicable link checks only for the
docs changes; reference-rendering work is evidence, not application
verification. No repository test suite, full browser matrix,
benchmark or production implementation. Do not merge.

Stop for owner review after the bounded design deliverable. Subsequent
implementation plan/checkpoints will be approved separately.

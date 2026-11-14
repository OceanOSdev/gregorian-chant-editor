# Plan: Stage 9B-2 — Extended Scandicus and Climacus

Branch: `feature/stage-9b2-extended-scandicus-climacus`  
Target: `master`

Status: active handoff. Stage 9B-1 (PR #75) is merged at `a2111bf`.

## Goal and scope

Extend the existing Scandicus and Climacus families to four and five notes
in the Roman/Solesmes modern square-notation profile. Retain the ordinary
three-note figures, including existing authored quilismatic Scandicus,
exactly as before. Reuse Stage 9B-1's bounded tuple, exact entry variant,
family menu, insertion allocator and shared geometry precedents.

Read AGENTS.md, the current owning guides, ADRs 0004, 0007, 0008, 0010,
0011, 0013–0016, 0018–0023, and the completed Stage 9B-1 plan/verification.
A plan is not evidence of completed implementation or verification.

## Reference investigation and gates

- [Mocquereau, A Study of Gregorian Musical Rhythm](https://media.churchmusicassociation.org/pdf/mocq-web.pdf),
  printed p. 152, Fig. 32–34: the text explicitly allows Scandicus and
  Climacus of four, five or more notes. Fig. 34 is the primary starting
  reference for the longer ascending and descending silhouettes.
- [Liber Usualis 1961](https://propria.org/wp-content/uploads/2019/10/liber-usualis-1961.pdf),
  introductory notation table (verify printed page) and actual chant
  specimens; [Sister Demetria, Basic Gregorian Chant and Sight Reading](https://media.musicasacra.com/books/basicgregorianchant_1960.pdf),
  relevant lessons/examples on longer ascending/descending groups.
- [Gregorio GABC reference](https://gregorio-project.github.io/gabc/) and
  [inclinatum orientation](https://gregorio-project.github.io/tips/inclinatum.html).
  Compare actual renderings of both counts, adjacent steps, skips and mixed
  intervals. GABC may partition an ascent into separate glyphs; do not treat
  parser acceptance as evidence of a single conventional printed construction.
- Locate actual printed repertoire examples of both lengths and directions
  where possible. Record edition, page, text, exact pitches, signs and
  grouping. Check the Kyrie XI, Requiem Gradual and other target repertoire
  only for genuine matches; do not claim any full chant is supported.

Inspect scans, not just extracted descriptions. The handoff has established
the historical existence of longer figures, not a verified four/five-note
Scandicus join recipe. For ascending figures investigate how the first notes
are grouped and the terminal pes/virga is formed, including interval-dependent
alternatives. Do not simply concatenate existing three-note Scandicus glyphs,
repeat all connectors, impose a terminal virga on all patterns, or invent
notehead shapes. If multiple source-supported alternatives exist, propose
one initial deterministic profile with rationale and matched images. Seek
owner decision before implementing disputed geometry; continue the independent
Climacus and other unambiguous work. The default profile must not imply a
salicus/oriscus, quilisma, liquescent or new rhythmic interpretation.

Mora gate: independently investigate none, final and final-two for each
new length/direction. Document direct printed evidence vs analogy vs
Gregorio rendering; compare actual sign ownership and geometry. Preserve
all existing three-note patterns. Provisional none-only for longer groups
is acceptable for independent implementation; it is not final approval and
must be explicitly recorded as pending. Propose the narrow supported matrix
and request owner acceptance before enabling unresolved patterns or merging.
No arbitrary earlier-note mora, duration model or speculative sign placement.
Do not halt unrelated implementation while evidence is being gathered.

## Domain and architecture

Use the existing semantic kinds `scandicus` and `climacus`, each with
a bounded union of exactly three-, four- and five-note tuples. No persisted
count, variant, generic grouping flag or arbitrary-length array. The first
kind strictly ascends; the second strictly descends. Use a typed bounded
constructor that rejects other lengths (no padding/truncation/unsafe cast).
Share a helper/type where appropriate without generalizing unrelated kinds.

Record a new ADR (next available number, currently 0024) narrowly extending
ADRs 0004 and 0023 to these two families. Preserve the fixed tuples of all
other kinds and the existing four/five Pes subpunctis family. The owner
agreed to start the previously proposed bounded-family approach. Document
the exact scope and review process; if implementation requires a materially
different contract, stop the affected work with evidence and options.
Do not change unrelated accepted behavior under cover of this extension.

Maintain distinct stable note IDs in musical order, one neume ID and one
lyric anchor boundary. Runtime validates length, contour, note forms and
mora pattern, even for malformed callers. Audit all existing three-note
assumptions for these two kinds: native readers, command tuple rebuilding
(move-note, move-neume, update-note-form, update-note-modifiers), clef
transforms, normalization, entry-pitch/preview types, semantic/entry mapping,
note labels, render and geometry dispatch, sign placement, score selection,
history, counts and exhaustive switches. Preserve existing public callers
where practical and all established unrelated behavior.

## Toolbar and graphical entry

Use NeumeFamilyMenu for both Scandicus and Climacus. Primary always arms
the ordinary three-note figure, dropdown offers the ordinary figure plus
four- and five-note variants. Use clear labels, e.g. Scandicus (4 notes)
and Scandicus (5 notes), Climacus (4 notes) and Climacus (5 notes), with
historical aliases in documentation when appropriate (not separate semantic
kinds). Derive display names/count descriptions from actual cardinality;
do not call a five-note group a three-note figure. Keep ordinary labels
unchanged. Choose consistent entry discriminants (e.g. scandicus-4/-5,
climacus-4/-5) and update exhaustive entry mappings and user-facing names.

Suggested entry contours relative to clicked first pitch p: ascending
[p,p+1,p+2,p+3] or [p,p+1,p+2,p+3,p+4]; descending mirrors these offsets.
Ordinary three-note templates are unchanged. One click places the complete
group; retain exact armed variant for repeated placement, I recall, T
family focus and contextual boundary Insert actions. No modal or new drag
gesture. Shared five-note ID allocator must cover every path, including
before/after clefs/divisions and no-selection insertion; no IDs generated
by reducer. Existing authored quilisma on ordinary Scandicus is unaffected;
selecting the primary resets to ordinary default shape per established
split-family interaction. No authorable quilisma on longer Scandicus in
this milestone (see forms below).

Preserve PR #74/#75 menu lifecycle: one roving toolbar Tab stop; arrows
browse, Enter/Space open/select, Up/Down/Home/End menu navigation,
Escape returns chevron focus, Tab/Shift+Tab leave normally; opening/arming
alone doesn't edit a clean score. Primary closes menu and retains focus;
dismissal-only score click consumes click and restores chevron focus;
outside controls keep native focus. Only one menu open across all four
families, including switching by pointer and keyboard, no stale focus or
accidental insertion. Retain accessible names/checked/expanded states
and visible exact active variant, including at 320px. Test viewport edge
alignment and wrapping; menus may overlay controls as existing behavior,
but must remain dismissible and fully reachable. Do not redesign toolbar.

## Engraving and modifiers

- Climacus: preserve existing three-note virga and tail exactly; extend
  `descendingDiamondCenters` and `buildDiamondTail` usage to all remaining
  positions. The existing helper already supports multiple centers. Compare
  old vs new three-note output including hits, anchors, ink, advances and
  signs; reuse the previous 4,000-case baseline method where useful.
  Longer tails follow supported interval-sensitive spacing and separate
  pointer ownership; no new connectors or duplicate virga.
- Scandicus: keep ordinary three-note geometry and authored three-note
  quilisma byte-identical across representative adjacent/skipped pitches,
  line/space and signs. Implement only reference-supported four/five-note
  constructions; reuse original head/shaft/pes primitives as appropriate.
  Do not infer joins from strictly rising pitches alone. Preserve semantic
  order, one lyric anchor at the first note, complete measured bounds and
  individually selectable constituent regions even when ink is connected.
  Avoid hardcoding an unsupported join rule; see reference gate above.
- Geometry drives score ink, hit regions, selection, ghost, palette icon,
  ledger/accidental layout, signs, lyrics and wrapping. Whole group stays
  together under existing wrapping contract; no new global spacing policy.
  Audit vertical-obstacle partitions: an extended Scandicus's actual
  joined/disconnected shapes determine shafts, not a generic assumption
  that every rising pair joins. Preserve existing recipes for old counts.
- Independent horizontal/vertical episemata on every constituent. Verify
  all authored signs are emitted once, locally owned, clear of staff and
  other ink, included in bounds/advance, and never cause render failure
  across representative contours including all sign combinations. Do not
  add authorable Virga/Inclinatum/Quilisma contexts for longer groups.
  Existing `allowedNoteForms(kind,index)` presently permits quilisma on
  Scandicus index 1, and authored geometry builds only three notes. Make
  eligibility cardinality-aware across validation, command, context UI,
  native decoding and geometry to prevent a four/five-note Scandicus with
  an authored quilisma being accepted then silently rendered as three.
  Preserve ordinary Podatus/Scandicus form policies and existing legacy
  reads. Default Climacus virga/diamonds are derived, not authored flags.
- Mora: `moraChoices(kind)` presently grants both final and final-two for
  every Scandicus/Climacus. Make scope choices cardinality-aware across
  command, UI, resolver and decoder; `moraIndexes(scope,length)` already
  computes affected indices. Keep 3-note, Pes subpunctis and all other
  matrices unchanged. Enable only owner-approved sourced patterns for the
  longer counts. Preserve note ownership rather than relocating marks
  to the new final position on deletion. Update ADR 0018/0019 as needed
  with precise count-aware policy and the new ADR.

## Editing, normalization, accidentals

Individual pitch moves must retain strict direction and all valid
modifiers/forms; whole-neume movement transposes every constituent,
preserving IDs and intervals. Preserve clef transformation and accidental
contracts. Reject invalid edits atomically and announce meaningful reasons.

Deletion of any constituent of a longer monotonic group preserves stable
neume ID, order, surviving notes/IDs, valid marks/forms, structural and
lyric anchors. Five to four and four to three retain family; three to
two uses the existing Podatus/Clivis normalization, without changing
established three-note behavior. For longer groups, check resulting
form/mora eligibility, reject invalid surviving marks rather than
drop, transfer or reinterpret them. If the marked note is removed,
remove its mark; if an earlier note is removed, preserve the mark on
its surviving owner. If final-two is later approved, explicitly test
deleting either marked note and whether the remaining subset is valid.
No implicit contour conversion on pitch movement.

**Additional normalization gate (ADR 0023):** that Accepted ADR explicitly
rejects deletion from Pes subtripunctis if four strictly descending notes
remain, because extended Climacus did not exist. Now that a four-note
Climacus will exist, the recommended narrow amendment is to normalize
such a surviving contour to four-note Climacus, preserving identity and
all valid authored marks/anchors. This includes deletion of the initial
note, and deletion of the apex when the surviving pitches strictly
descend. A retained final-note mora must be legal under the approved
four-note Climacus matrix; otherwise reject rather than discard it.
Equal adjacent pitches remain rejected. This is a proposed change to an
accepted contract, not already owner-approved; record the evidence and
request explicit acceptance (together with the modifier gate). Keep the
old rejection until approved; do not stop independent extension work.
Do not broaden other existing normalization rules, including equal
outer-note Torculus/Porrectus cases.

Keep ADR 0021 register-specific B signs, canonical owner, placement anchors,
owner deletion, reconciliation and destructive clef confirmation behavior.
Test signs on later constituents and after normalization; do not introduce
new accidental semantics.

## Persistence

Propose strict native v8. Because the existing kinds have broader
cardinality in v8, explicitly enforce exact v1–v7 three-note
Scandicus/Climacus decoding before applying the new runtime validators.
Earlier versions must reject a four/five-note instance even though
the kind name is old. Preserve all other old whitelists and v7 Pes
subpunctis behavior. Native v8 validates 3/4/5 cardinality, contour,
count-aware form/mora policy, IDs, and fields. New saves/exports use v8;
older builds cannot read v8, even old-kind-only documents. No hydration
rewrite, cache key change, legacy draft-v2 recovery changes, original-source
loss, silent truncation, or weakened cross-tab protections. Update owning
docs and all current/future version test fixtures and drivers.

## Verification and acceptance

- Pure tests: independent contour/cardinality oracle for both families
  and all lengths over bounded representative pitch ranges; malformed
  inputs; exact counts and IDs at each boundary; movement and deletion
  for every index; invalid edit/history preservation; identity and lyric
  anchors; modifiers/forms and all mora masks; legacy v1–v7 exact length
  rejection, native v8 round trips, cache/source protection. Explicitly
  test rejecting authored quilisma in 4/5 but accepting old 3-note forms.
  Preserve old three-note tests, including accepted modifier and form
  behavior. If approved, test Pes-to-Climacus deletion across first/apex/
  tail cases, marked/unmarked ownership and undo/redo; adjust ADR 0023.
- Geometry: old three-note baseline equivalence with ordinary/quilismatic
  forms; both longer counts, adjacent/skip/mixed intervals, line/space,
  extreme supported pitches, head and hit ownership, all signs and B
  placements, lyric anchor, ghost/commit parity and wrapping. Exhaustive
  horizontal/vertical episema x allowed mora patterns for representative
  4/5 contours (all masks, not sampled; state exact tested ranges and counts).
  Ensure no missing ink, clipped/unreachable note, unexpected exceptions,
  or sign ownership conflicts. Capture matched printed/Gregorio/editor
  images for each length and direction including marked variants; distinguish
  qualitative comparisons from measured numerical claims.
- New real-browser verification driver in headless Chromium and Firefox,
  production preview at 1440px and 320px. Exercise all four family menus,
  exact active/remembered variant and primary reset, menu dismissal/focus,
  pointer and keyboard selection, one-click repeat, I/T, contextual
  insertion before/after clefs/divisions, selection/pitch/group moves,
  normalization, modifiers, undo/redo, v8 export/import/refresh and
  old-version rejection; check actual hit targets and narrow wrapping.
  Include marked normalization where approved and old ordinary quilisma
  behavior. Capture useful screenshots.
- Run Stage 9A and 9B-1 browser drivers, accidentals (both), bundled
  examples, local persistence, note forms/modifiers, vertical episemata
  (both), and applicable clefs, mid-score-clefs and divisions. Run
  format:check, lint, npm test, build and relevant docs/testing.md checks.
  Report actual outcomes, failures, and not-run checks with reasons.
  Existing lyric-anchors/lyric-move failures remain separate maintenance;
  don't fix opportunistically. Stop own temporary browser/server processes
  when done; don't kill unrelated owner processes.
- The implementing agent should perform objective verification rather
  than leaving routine manual checks to the owner. Distinguish headless
  automation, foreground interaction, actual screen-reader testing and
  typographic measurement. Owner acceptance may rely on automated and
  qualitative evidence as in prior milestones; do not claim it in advance.

## Exclusions and delivery

No arbitrary lengths, other compound directions or subpunctis families,
salicus/oriscus/pressus, expanded authored forms, liquescence, intra-syllable
grouping/fusion, GABC interchange, liturgical annotations, playback, full
Kyrie acceptance, global engraving overhaul or unrelated refactor.

Implement on the handoff branch, commit and push, open PR against master.
Keep PR draft if geometry, mora or normalization gates remain unresolved;
continue independent work where possible. Record proposed decisions and
evidence, exact test results, limitations, and a concise owner checklist.
Do not mark ADRs accepted without the relevant owner approval, silently
override accepted ADRs, or merge. Retain the plan through review and
closeout.

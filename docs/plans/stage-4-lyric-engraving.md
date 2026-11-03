# Plan: Stage 4 lyric-aware engraving (completed verification milestone)

Status: **4A merged in PR #43; 4B merged in PR #44; 4C merged in PR #45;
Stage 4D verification complete with disclosed gaps; PR #46 merged**.
Original 4A branch: `feat/stage-4a-vowel-alignment` (merged).
Completed 4B branch: `feat/stage-4b-lyric-aware-spacing`
Target: `master`
4B original baseline: `fe25b80c78dec513bce5e9b0a647c647a7bb05bb`

The 4A and 4B instructions below are historical; both stages are merged.
Stage 4C merged in [PR #45](https://github.com/OceanOSdev/gregorian-chant-editor/pull/45),
following the [4C handoff](stage-4c-word-composition.md) and
[Accepted ADR 0011](../adrs/0011-word-aware-chant-engraving.md).
[Accepted ADR 0010](../adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md)
continues to govern combined music/lyric layout, narrowly qualified by ADR 0011.
The completed verification handoff is [Stage 4D](stage-4d-acceptance.md).
The [verification report](../verification/stage-4d/README.md) records the
qualitative owner manual result, screen-reader checks Not run and the uncaptured
detailed 320px usability signoff. Completion does not imply every scenario passed. The preceding stage instructions below
are historical and should not be reimplemented.

**Language-design gate resolved (2026-11-01):** The owner approved a required,
document-level lyric engraving language preference. New chants use Latin by
default, with an explicit unspecified option and conservative fallbacks. This
authorizes a narrowly scoped semantic-model extension in 4A; do not stop again
to seek approval merely to introduce this field. The details below supersede
the earlier instruction to stop and ask whether a language field is needed.

## Problem and user-visible goal

The current editor places each whole lyric syllable centered on its neume
anchor, then wraps the already-spaced music without considering lyrics.
This can collide, spread words apart, and cannot reproduce traditional chant
engraving where nearby syllables of the same word visually join while distant
ones use hyphens. The owner wants naturally readable words such as _Kyrie
eleison_, including mixed joined and hyphenated syllables such as _auditione_
in the referenced Requiem gradual (https://gregobase.selapa.net/chant.php?id=1261).

**Guiding principle:** Music determines alignment; lyrics influence minimum
spacing; hyphens appear as needed to preserve a word's readability.

Stage 4 intentionally expands the older "minimal engraving / music-only
wrapping" proposal in the retired `docs/plans/lyric-system-redesign.md`
(available through Git history). That earlier section describes the prior plan,
not the implemented Stage 4 outcome.
The implementation must reconcile this change explicitly in the owning docs.

## Source contracts and accepted decisions

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`,
`docs/domain-model.md`, `docs/layout-and-rendering.md`,
`docs/editor-interactions.md`, `docs/testing.md`, and
`docs/adrs/0002-separate-semantic-and-derived-state.md`,
`docs/adrs/0003-use-stable-semantic-identities.md`,
`docs/adrs/0005-derive-wrapping-from-rendered-geometry.md`,
`docs/adrs/0007-share-derived-neume-engraving-geometry.md`, and
`docs/adrs/0008-anchor-lyrics-to-neumes.md`.

Current seams of interest:

- `LyricSyllable`: stable `id`, `text`, `startsAtNeumeId`,
  `boundaryBefore`; no independent word entities.
- `ChantDocument` currently has no language setting. Stage 4A is authorized
  to add one required document-wide `lyricLanguage` field, as specified
  below, and update fixtures and command/history boundaries accordingly.
- `layoutChant` derives whole-neume systems using music-only
  `placeNeumeSequence`, then places whole-string SVG lyric text at
  kind-specific `lyricAnchorX` values.
- `ScoreSvg` renders one focusable lyric control per syllable.
- The session reducer owns Lyrics mode, semantic selection, keyboard focus
  requests, draft recovery and history; Stage 3 reassigns lyric anchors by ID.

**ADR history (resolved in Stage 4B):** Stage 4B changed the original
music-only wrapping premise of ADR 0005. The owner accepted its replacement,
ADR 0010, following PR #44 implementation review. Preserve the remaining
invariants: whole-neume breaks, exact-fit semantics, guaranteed progress for
oversized items, stable IDs, derived system ownership, and preview/commit
agreement.

## Approved document language design for 4A

Use a required semantic field on `ChantDocument`, not session-only state:

```ts
type LyricLanguage = 'la' | 'en' | 'el' | 'und';

interface ChantDocument {
  // Existing title, clef, syllables and neumes...
  lyricLanguage: LyricLanguage;
}
```

- `la` = Latin, `en` = English, `el` = Greek, `und` = explicitly
  unspecified/undetermined. These are **engraving rules**, not restrictions
  on which text a user may enter. Do not infer a language from Latin-script
  text, the score title, current locale, or unrelated app settings.
- Newly initialized Gregorian chant documents (including the built-in example
  and any explicit new-document factory) default visibly to `la`.
  Allow the user to select `und` deliberately. If a legacy or untyped
  document lacks a valid value at a runtime boundary, normalize/handle it
  conservatively as `und` rather than silently claiming Latin. TypeScript
  sources and tests should populate the required field explicitly. The app
  has no persisted format or schema migration requirement today.
- Provide a small, clearly labeled **Lyric language** document-level control
  with options Latin, English, Greek, and Unspecified. It is independent of
  choosing, selecting, editing or reassigning a syllable. Changing the
  language is an immutable semantic document edit, recorded as **one**
  history action; unchanged choice returns the exact original document.
  Undo/redo restores the language and derived alignment; preserve stable
  IDs, drafts/selection/focus and existing safety policies. The setting
  never edits text, syllable boundaries, or anchors.
- Automatic segment alignment uses only the selected language's rules.
  Latin supports the agreed Latin acceptance examples, including `y` in
  `Ky`, `au`, `æ`, and consonantal `u` in `qui`. Greek supports a
  conservative Greek-script vowel/accent case, including combining marks.
  English may use conservative, unambiguous cases but **must** fall back
  to whole-syllable centering where spelling/pronunciation makes a nucleus
  uncertain. `und` always centers the whole syllable automatically.
  Unsupported or incompatible scripts and unrecognized cases also fall
  back to whole-syllable centering. Do not add language detection,
  pronunciation dictionaries or full grapheme-to-phoneme inference.
- The user-authored **per-syllable alignment segment override** always takes
  precedence over the language default, including `und`. Resetting the
  override uses the document's current automatic language rule. A mixed
  language chant can use explicit overrides where necessary; do not add
  per-syllable language fields, extra word entities or session-specific
  language settings in Stage 4A.
- Keep the choice stable and visible; the language control and manual segment
  controls must be keyboard-operable and accessible. If a dirty lyric draft
  is active when the language changes, respect existing draft/history safety
  policy rather than discarding the draft, changing its target, or silently
  committing it. Preserve the difference between semantic selection and
  browser keyboard focus.
- This is an approved domain addition, **not** permission to revise lyric
  ownership, music insertion, or ADR 0008's anchoring contract. Update the
  owning domain/commands/rendering/testing guides and explicitly evaluate
  whether a focused new ADR is warranted; do not rewrite an accepted ADR
  by implication.

## Agreed engraving direction (all of Stage 4)

1. **Vowel-nucleus alignment.** Align the center of the appropriate vowel or
   vowel group of a syllable to the existing kind-specific musical lyric anchor,
   not the entire syllable's midpoint. Handle Latin examples (`Ky`, `ri`,
   `e`, `lé`, `son`, diphthong `au`, consonantal `u` in `qui`,
   ligature `æ`), Unicode accents, Greek script, and English using the
   **explicit document `lyricLanguage`** rules above, not a universal
   first-vowel or script-based language guess. When uncertain, or when
   `lyricLanguage === 'und'`, fall back predictably to whole-syllable
   centering.
2. **Optional manual alignment.** Allow a user to choose a contiguous
   grapheme-safe part of the syllable whose center aligns to the neume, or
   reset to automatic. This is an authored editorial preference, not an x/y
   pixel displacement and not a syllable-to-neume reassignment. Keep the normal
   editing path simple; manual controls are discoverable but optional.
3. **Lyric-aware horizontal layout.** Musical geometry is the baseline;
   syllable text and word gaps impose additional minimum clearances.
   Do not gratuitously stretch melismatic neumes under a single syllable.
   Wrapping must account for the same combined geometry used by rendering.
4. **Conditional hyphens.** Syllables within a word may read as one continuous
   string when close enough. Where musical alignment visibly separates them,
   generate a hyphen, never persisted as lyric text. A single large neume can
   create separation; neume count alone is not a criterion. Distinct words
   receive word space, not hyphens.
5. **Across-system continuation.** A word continuing on the next system gets
   an outgoing hyphen on the preceding system. Ensure bounds and adequate
   clearance; decide/report a defensible overflow fallback without clipping or
   infinite reflow. No incoming repeated hyphens or extenders by default.
6. **Editing invariants.** Text stays separate syllable entities with stable
   IDs, no new semantic word entities or inferred ownership caches. Preserve
   keyboard focus vs semantic selection independence, click/keyboard actions,
   draft safeguards, history granularity, insertion resolvers and SVG hit
   testing.

## Milestones and review gates

### 4A — Text measurement, vowel alignment, and manual overrides (merged)

**Completed in PR #43.** The following details are retained as historical scope/acceptance criteria, not instructions to repeat the milestone.

- Investigate the current SVG font, text baselines, `lyricAnchorX`, and
  `layoutChant` call sites. Add a small explicit font-metric / measurement
  boundary suitable for pure TypeScript engraving tests: browser DOM/SVG
  measurement (when available) stays in an adapter, never in semantic commands.
  Keep typography consistent with the rendered SVG; handle font readiness,
  Unicode graphemes and missing measurements deterministically.
- Derive each syllable's automatic alignment segment, returning an explicit
  measured offset / bounding data for positioning it under the **existing**
  musical anchor. Prefer conservative, testable language-specific rules with
  a safe whole-string fallback to brittle pretending to understand every
  Latin-script language. Do not add broad automatic language guessing or
  syllabification. **The explicit document-level language preference is
  approved and required**, per the language design above; do not treat that
  decision as an unresolved stop condition. Stop only if implementation
  uncovers a genuinely new material conflict outside that agreement.
- Implement the required `lyricLanguage` semantic field, document control,
  immutable update command, history/undo behavior, `und` fallback, and
  language-specific/fallback cases from the approved design above. Update
  the built-in example, all TypeScript fixtures and construction paths to
  specify their language rather than depending on silent inference.
- Support an optional explicit segment override using stable, Unicode-safe
  indexing (grapheme boundaries, not naïve UTF-16 offsets). Ensure ranges are
  validated; deleting/editing text must never leave an invalid or accidentally
  shifted override. Preserve or reset the override by a documented rule, with
  undo/redo and clear user feedback. Choose a compact semantic representation
  and pure command(s) that integrate with existing document history; store no
  pixel coordinates. A manual override must not alter `startsAtNeumeId`.
- Add an accessible **Alignment: Automatic / Manual** affordance in the
  existing lyric edit flow, including a clear Reset to automatic operation.
  Avoid unexpected movement of keyboard focus or silent retargeting of a
  selected-vs-focused syllable. Manual selection of a vowel group must work
  without requiring pointer input.
- Render one interactive SVG lyric control per syllable; preserve selection,
  focus, editing, accessible names and normal pointer targets. The text
  should align by its selected nucleus even though spacing and wrapping
  still follow the **existing music-only policy for 4A**. Document that
  temporary collisions are a known pending 4B limitation, not a 4A failure.
- Update applicable owning guides/ADR(s), tests and user-facing limitations.
  Do not implement gap policies, hyphens, lyric-driven wrapping or Stage 4B
  until 4A has been reviewed and merged.

**4A acceptance tests:** explicitly Latin document gives automatic centers
for `Ky`, `ri`, `e`, `lé`, `son`, `au`, `qui`, and `æ`; explicit Greek
document handles at least one polytonic Greek / combining-mark case; explicit
English document handles a conservative case and one ambiguous example with
whole-syllable fallback; explicit `und` always whole-syllable-centers, and
missing/malformed legacy language data also safely falls back instead of being
assumed Latin; choosing the language via keyboard/accessibility UI works;
new document default is visibly Latin; language changes are one semantic
history transaction with no-op identity, exact undo/redo and no change to
neumes, lyrics, anchor IDs, drafts or keyboard focus;
manual single/multi-grapheme override and reset; invalid/changed-text override
safety; Unicode-safe measurement and alignment; no music/neume movement,
reflow or semantic anchor changes from alignment alone; selection vs focus
and edit-target regression; atomic history and exact undo/redo. Verify in
both multi-system and narrow browser cases.

### 4B — Lyric-aware spacing and wrapping (merged in PR #44)

See the [Stage 4B handoff](stage-4b-lyric-aware-spacing.md) and accepted ADR 0010,
which supersedes ADR 0005. The following original outline remains historical context.

After 4A review, agree ADR impact. Design a single pure placement walk that
consumes neume ink geometry plus measured lyric/word requirements and yields
final advances, system partition and anchor positions. Preserve ID-based
placement/reveal, insertion and hypothetical preview consistency, exact fit,
progress for oversize items and no unstable reflow loop. Test lyricless score
parity, short/long words, multiple neumes per syllable, large neume kinds,
narrow systems, a single unbreakably long syllable, and stable undo/redo.
Present a visual before/after and inspect music geometry.

### 4C — Word composition, conditional hyphens and system continuations (merged in PR #45)

Follow the [Stage 4C plan](stage-4c-word-composition.md), including optional
compact spacing for consecutive same-word syllables, while safeguarding neume
ink and interaction bounds. The contextual compaction exception to ADR 0010
was originally recorded in Proposed ADR 0011, now Accepted; no other accepted
ADR was silently changed.
The original hyphen principles remain: derive from semantic word boundaries,
measured gaps and system partitions; no decorative focus/hit targets and no
persisted punctuation. Stage 4D stays separate.

### 4D — Cross-browser verification (complete with disclosed gaps)

See the [Stage 4D verification report](../verification/stage-4d/README.md) for
actual results and remaining owner checks. Follow the
[dedicated Stage 4D acceptance plan](stage-4d-acceptance.md),
which audits existing tests, verifies real Chromium and Firefox behavior,
and adds a foreground Firefox keyboard/accessibility signoff. Fix verified
regressions; do not reopen accepted editorial typography decisions merely
because the reference engraves a word differently. At final owner acceptance,
close out retained historical plans according to `docs/ai-workflow.md`.

## Scope exclusions

Do not add GABC import/export, musical audio, external font frameworks,
general-purpose international syllabification, word entities, a second
persistent association model, drag-to-offset coordinates, persistence,
pagination, or new neume types. Do not embark on broad spacing or glyph
redesign unrelated to the requested lyric behavior.

## Verification and delivery for 4A

- Run `npm run format:check`, `npm run lint`, `npm test`, and
  `npm run build`. Perform real browser interaction checks for the new UI,
  including actual keyboard navigation and selection/focus independence.
  Record Firefox and screen-reader checks as unverified unless run.
- Provide screenshots or small recordings for actual vowel-alignment changes,
  compare with a whole-string-centered baseline, and document any measurement
  or font limitation. Keep generated browser diagnostics out of Git.
- Implement only 4A on **`feat/stage-4a-vowel-alignment`**, commit, open a PR against
  `master`, and report actual verification and caveats. Do not merge.
  Keep this Stage 4 plan available through 4B–4D, updating its milestone
  statuses as the owner accepts each phase. If a material ADR/domain/language
  conflict **beyond the approved document language field** emerges, stop and
  report concrete alternatives before diverging.

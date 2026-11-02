# Plan: Stage 4 lyric-aware engraving (begin with 4A)

Branch: `feat/stage-4a-vowel-alignment`
Target: `master`
Baseline: `4c511a88e12296baefe29d79ff55ad65b4a91a71` (Stage 3 merged)
Initial implementation scope: **4A only**. 4B–4D below document the direction,
not authorization to implement them in this PR.

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
wrapping" proposal in `docs/plans/lyric-system-redesign.md`. That earlier
section describes the prior plan, not the newly agreed Stage 4 outcome.
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

**Do not silently override an accepted ADR.** In particular, 4B changes the
premise of ADR 0005 by allowing measured lyric requirements to influence neume
advance and system wrapping. Before 4B implementation, propose a deliberate
ADR amendment or replacement following `docs/adrs/README.md`; retain the
existing accepted decision until the owner accepts the change. Preserve the
important remaining invariants: whole-neume breaks, exact-fit semantics,
guaranteed progress for oversized items, stable IDs, derived system ownership,
and preview/commit agreement.

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

### 4A — Text measurement, vowel alignment, and manual overrides

**Implement this milestone on this branch and stop.**

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

### 4B — Lyric-aware spacing and wrapping (future branch / PR)

After 4A review, agree ADR impact. Design a single pure placement walk that
consumes neume ink geometry plus measured lyric/word requirements and yields
final advances, system partition and anchor positions. Preserve ID-based
placement/reveal, insertion and hypothetical preview consistency, exact fit,
progress for oversize items and no unstable reflow loop. Test lyricless score
parity, short/long words, multiple neumes per syllable, large neume kinds,
narrow systems, a single unbreakably long syllable, and stable undo/redo.
Present a visual before/after and inspect music geometry.

### 4C — Conditional hyphens and system continuations (future branch / PR)

Derive displayed marks from `boundaryBefore`, actual rendered text edges and
system partitions. Test contiguous same-word syllables without hyphens,
spaced syllables with hyphens, different-word gaps, one or multiple intervening
neumes, and outgoing end-of-system continuation. Avoid a hard-coded
"one hyphen per continuation" rule, clipping, or persisted punctuation.
Verify interaction overlays do not include decorative marks in lyric hit areas.

### 4D — Cross-browser visual/accessibility acceptance (future branch / PR)

Inspect _Kyrie eleison_, the mixed-join-and-hyphen _auditione_ example from
the GregoBase Requiem gradual, same-word and separate-word cases, 320px
viewport, multi-system breaks, editing/focus and real pointer behavior.
Use actual Chromium browser checks and foreground Firefox/manual assistive
technology checks where possible; distinguish what was and was not run.
Review pure tests, generated SVG and screenshots, typography, responsive
clipping, performance, accessibility and interaction regressions. Update
owning docs and clean up completed temporary plans at final merge.

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

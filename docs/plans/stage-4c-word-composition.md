# Plan: Stage 4C — word composition, conditional hyphens, system continuations

Branch: `feat/stage-4c-word-composition`
Target: `master`
Baseline: `8672a1ee8dc7a505cb7761f675aa33a0febf3d61` (PR #44 merged)
Status: **implemented for owner review** for Stage 4C only; see the
[verification record](../verification/word-composition/README.md). ADR 0011
remains Proposed, ADR 0010 remains Accepted, and Stage 4D is deferred.

## User-visible goal

Stage 4A aligned vowel nuclei to neume anchors. Stage 4B measured lyric ink,
prevented collisions, expanded gaps when necessary, and wrapped complete neumes
using both music and lyric geometry. But musical minimum spacing still makes
consecutive same-word syllables read as scattered fragments, even where their
notation could be safely closer. Hyphens are absent even when musical spacing
cannot be compacted.

Target behavior:

- In a score with semantic boundaries `Al` / `le` / `lu` / `ia` (one word)
  and `ah` (next word), two intervening unanchored neumes between `Al`
  and `le` can make a hyphen necessary, but nearby `le`, `lu`, `ia`
  should visually read as `leluia` **if the notation permits**. The separate
  `ah` retains a word gap; never join it to `ia`.
- For the traditional mixed-joining example, examine _auditione_ in
  https://gregobase.selapa.net/chant.php?id=1261. Use the reference to
  inform proportions, not as a license to alter our semantic or neume rules.
- If a word's next syllable begins on a different system, display an outgoing
  hyphen on the previous system. Do not display a hyphen at a real word end.

Guiding principle: **music determines vowel alignment, lyrics influence
spacing, and hyphens communicate when music prevents word continuity**.

## Read first

- `AGENTS.md` and `docs/ai-workflow.md`
- `docs/architecture.md`, `docs/domain-model.md`,
  `docs/layout-and-rendering.md`, `docs/editor-interactions.md`,
  `docs/testing.md`, `docs/roadmap.md`
- accepted ADRs 0002, 0003, 0007, 0008, 0009 and **0010**, plus
  [Proposed ADR 0011](../adrs/0011-word-aware-chant-engraving.md)
- [original Stage 4 direction](stage-4-lyric-engraving.md) and
  [Stage 4B handoff](stage-4b-lyric-aware-spacing.md) for context.

Stage 4B's `placeNeumeSequence` in
`src/editor/layout/layout-chant.ts` starts each new neume at the
previous `bounds.x + advanceX`, where the shared neume-geometry builder
currently uses `interNeumeInkGap = 33`. It only shifts **right** for
measured lyric collision or a separate-word minimum. It cannot make
adjacent short syllables look joined. `ScoreSvg` renders separately
focusable/editable syllable text and a pointer-inert selection background.
Stage 4B's `getBBox()` + advance union, font readiness, scrollable
oversized canvas, measured pointer/reducer snapshot, and focus recovery
are hard-won contracts; preserve them.

## ADR boundary and review gate

[ADR 0010](../adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md)
is **Accepted**. It explicitly forbids shrinking musical minimum spacing.
The owner has separately agreed to investigate natural joining of
same-word syllables in Stage 4C. The attached **Proposed ADR 0011**
documents a _narrow, contextual exception_ to ADR 0010's fixed minimum:
only at eligible consecutive neumes starting consecutive syllables of
the **same semantic word**, when neume ink, note hit testing, typography,
and click/keyboard interaction are all preserved.

Codex is authorized to **prototype and implement this narrowly scoped
policy on this isolated branch**, against Proposed ADR 0011, not to
silently change the universal neume ink gap. Owner visual review and
explicit acceptance are required before merging. Do not mark ADR 0011
Accepted or modify the Accepted status/history of ADR 0010 yourself.
If a safe readable `leluia` cannot be achieved under these constraints,
stop and report a visual comparison and concrete alternatives; do **not**
force neume collisions, render fake joined text divorced from its musical
anchors, or change the document model without approval.

## Stage 4C decisions

### 1. Semantic word relationships

- Derive word relationships solely from ordered `LyricSyllable` data:
  `boundaryBefore: 'word' | 'continuation'` and
  `startsAtNeumeId`. A space is always a real word boundary in the
  supported lyric languages; never infer word boundaries from accidental
  rendered gaps, vowel rules or neume count.
- No new semantic word entities, persisted hyphens, spacing values,
  line ownership, or special inserted text. The glyphs of the source
  syllables remain separate interactive controls with stable IDs.
- Unanchored intervening neumes inherit the current syllable's melisma,
  not a phantom word boundary. A wide neume or long melisma can force
  separation; neume _count alone_ must never trigger a hyphen.

### 2. Compact eligible same-word syllables

- Investigate a context-specific **minimum permitted gap** between
  consecutive neumes each beginning a syllable of the same word, with no
  intervening unanchored neumes. Measure the syllables' real occupied
  text bounds and their vowel-to-neume offsets from Stage 4A/4B.
- Prefer near-contiguous word typography, but only if musical ink and
  distinct neume/note interaction regions remain readable and
  unambiguous. Never change a neume's inner contour, note order,
  vertical pitch, lyric anchor definition or semantic association.
  Do not globally reduce `interNeumeInkGap` or compress melismas,
  lyricless music, or different-word boundaries.
- The resulting advance is bounded by actual rendered geometry and a
  deliberate, testable interaction separation policy. Inspect the
  existing padded `hitBounds`, neume selection and pointer targets;
  allowing overlapping interactive boxes without a deterministic
  ownership policy is not acceptable.
- Even adjacent syllables may be too wide/too short in the chosen
  typography to look joined given safe ink separation. In that case
  preserve correct music and let the hyphen policy communicate the
  continuing word. **Do not promise unconditional `leluia` joining.**
- No changes to the music-only geometry/wrapping baseline or empty
  document layout. When measurements are missing, invalid, loading or
  incomplete, use the existing conservative music-only fallback and
  reflow once valid.

### 3. Conditional hyphens

- After positioning music and lyrics, derive the join/separate decision
  from **actual measured lyric edges** and safe musical placement:
  near-contiguous same-word syllables have no hyphen; if significant
  separation remains, render a small hyphen between them. Different
  words never get a hyphen; normal word gaps remain.
- Define and document a deterministic, font-relative criterion for
  what counts as a readable join versus a separation; test at font
  changes/zoom rather than using neume count. Avoid gratuitous hyphens
  or artificially widening a near-joined word just to fit one.
- Hyphen length/ink extents must be measured using the current font
  and derived in layout. If a hyphen is needed but the available gap
  is insufficient, reserve only the additional space required in
  the **same** deterministic placement/wrapping process. No
  post-render SVG translation or overlapping decorations.
- Prevent feedback loops: spacing affects separation, which can affect
  hyphen decisions, which can affect spacing. Choose and document a
  deterministic bounded decision/reflow method that cannot oscillate,
  infinitely wrap, or produce an unreviewed unstable layout.
- Render hyphens in a pointer-inert, `aria-hidden` decoration layer.
  Do not change the accessible syllable text, cursor navigation,
  focus order, semantic history or selection highlight. If a hyphen
  lies close to a selectable syllable, it must not steal its click.

### 4. Outgoing system-break hyphens

- When **consecutive semantic syllables of the same word** appear on
  different systems, show an **outgoing continuation hyphen on the
  preceding system**, even if ordinary same-system hyphenation would
  not have been needed. Do not add a hyphen at a true word boundary.
- Reserve enough measured room at the end of the previous system,
  including the hyphen and reasonable margin, in the wrapping
  calculation. A hyphen must not be cut off, overlap musical ink, or
  trigger a non-terminating reflow cycle. No redundant incoming
  hyphen on the next system.
- Distinguish a word actually continuing to a _new syllable_ on the
  next system from a single syllable's melisma extending over a
  system break without any new lyric; do not invent a syllable
  boundary. The outgoing mark is derived, not stored.
- Preserve existing full-text scroll overflow for single unbreakable
  oversized syllables. Keep ordinary 720-unit wrapping bounds
  independent of exceptional derived canvas dimensions.

### 5. Architecture and interaction safety

- Use the existing derived layout pipeline; do not build a separate
  renderer-side authority for word grouping, x positions, or wrapping.
  It may need explicit derived hyphen/word decoration geometry and a
  small contextual neume-advance policy. Those are layout outputs,
  not `ChantDocument` fields.
- All committed SVG, note/lyric hit testing, graphical insertion and
  caret/ghost positioning must consume the **same measured layout**
  snapshot. Preserve ID-based focus restoration after reflow and
  selection vs keyboard focus independence.
- Keep accepted grapheme-safe manual vowel overrides, text editing,
  native Tab behavior, draft Save/Discard/Cancel, undo/redo,
  line reflow, selection background behind text, font invalidation
  and recovery. Font-dependent changes must not become history edits.
- Explicitly inspect whether compact neume spacing can break
  meaningful pointer target areas; adjust derived hit regions
  contextually if needed, with separate tests for all seven kinds.

## Suggested incremental implementation checkpoints

Treat these as checkpoints within **one 4C PR**; finish both before
requesting merge, unless a material conflict requires owner approval.

**4C.1: Same-word composition.** Implement and browser-test context-sensitive
compact spacing with safe geometry/hit targets. Show `Al ... leluia ah`
against 4B master; demonstrate a case where full joining is impossible
without overlapping neumes. Do not add punctuation just to make this
checkpoint pass.

**4C.2: Measured conditional hyphens.** Derive decorative hyphens from
semantic same-word continuations and final measured geometry, reserve
space deterministically when required. Verify natural joining vs true
separation, wide neumes, melismas, and unaffected separate words.

**4C.3: System continuations.** Add outgoing line-end marks and stable
reservation/reflow. Test breaks at different positions, long melismas,
near-edge hyphens, and pathological oversized text.

**4C.4: Visual/interaction regression.** Run real browser tests and
review screenshot comparisons. Update owning docs and ADR guidance;
leave Stage 4D's broad final acceptance for a separate handoff.

## Acceptance cases

1. **Alleluia:** consecutive same-word `le`, `lu`, `ia` look
   continuous when safely possible, while `Al` separated by intervening
   music gets appropriate continuation and a separate `ah` keeps a gap.
   Explain if any unjoined segment is forced by musical geometry.
2. **Kyrie eleison:** no unwanted hyphens, correct word separation,
   vowel alignment untouched, and no added crowding.
3. **Auditione:** use the referenced mixed joined/hyphenated exemplar
   for editorial inspection. State any deliberately different styling.
4. **Long or wide neumes and melismas:** preserve music, use hyphen
   when a real same-word gap remains, no extra hyphens merely for
   count or an unanchored neume; no false word breaks.
5. **System transition:** outgoing hyphen only for genuine
   same-word _next syllable_ across systems, present and legible;
   no clipping and no incoming duplicate.
6. **Missing glyph measurements / font reload:** provisional
   deterministic music-only fallback with no fake measurements,
   stable transition and consistent click/selection.
7. **Interaction parity:** all seven neume types, compact boundaries,
   pointer targets, graphical insertion, word editing, keyboard
   focus/selection, history, local scroll, 320px and alternate fonts.
8. **Invariants:** no changed semantic IDs/text or persisted marks,
   zero change to lyricless layout, no infinite/oscillating reflow,
   exact-fit and oversized progress preserved. No glyph-ink
   intersection; neither hyphens nor decorative highlights
   obstruct selection or focus.

## Verification / PR delivery

- Run `npm run format:check`, `npm run lint`,
  `npm test`, `npm run build`, and `git diff --check`.
  Use pure unit tests at the ownership seam and actual Chromium
  browser interaction tests; perform Firefox checks where possible
  and clearly label what was not verified.
- Provide before/after **visible editor** screenshots for
  `Al ... leluia ah`, `Kyrie eleison`, a conditional-hyphen
  case, and an outgoing system-break case. Do not claim
  visual correctness from numeric tests alone.
- Record the decisions on hyphen threshold, graphical minimum
  separation, hit-target partitioning, deterministic reflow,
  and pathological overflow in the owning documentation.
- Keep [ADR 0011](../adrs/0011-word-aware-chant-engraving.md)
  **Proposed** while implementing on the isolated branch;
  ADR 0010 stays Accepted. The owner must review and accept
  the proposed contextual exception before merging.
- **One logical commit per logical change, not one per file.**
  Use grouped commits for coherent documentation updates.
  The owner may squash the PR on merge.
- Implement on this branch, open a PR against `master`,
  include test/browser results, screenshots, caveats and
  remaining 4D work; **do not merge or begin Stage 4D**.

## Stop conditions

Stop and present evidence and alternative designs if safe joining would
require overlapping neume ink / ambiguous pointer ownership, breaking
vowel-to-musical-anchor alignment, silently changing accepted global
engraving geometry, adding semantic word entities or stored hyphen
characters, an unbounded hyphen/reflow cycle, or a material difference
from Proposed ADR 0011. Do not stop merely because the contextual
compaction is a _proposed_ change to ADR 0010: the isolated Stage 4C
experiment is explicitly authorized by this handoff, subject to owner
acceptance before merge.

## PR #45 corpus review iteration

Owner-requested follow-up: exercise Alleluia, Gregario, Miserere, Gloria,
Kyrie eleison, Dominus, Sanctus and Deo with explicit editorial syllables and
word boundaries. Use consecutive puncta, multiple unanchored neumes, wider
multi-note neumes, outgoing system continuations and consecutive words.
Correctness is checked through relative geometry/metadata/interaction invariants;
compact visual comparisons provide engraving review evidence, never pixel goldens.
The join policy must not leave unmarked continuation gaps as large as real word
spaces. Keep shared musical constructions unchanged and ADR 0011 Proposed.
See the [corpus record](../verification/word-composition/corpus-review.md) for
actual measurements, the general policy refinement and remaining review limits.

## Auditione acceptance investigation and giga-review follow-up

The owner requested a reference-like `au / di / ti / ó / ne` specimen and an
unaccented control, with neume assignments verified against GregoBase. Add the
specimens and report geometry/alignment/hyphen-policy differences before changing
the general engraving design; no auditione-specific rule or threshold tuning is
authorized. Continue repairing the giga-review findings on the same PR. See the
[investigation](../verification/word-composition/auditione-review.md). ADR 0011
remains Proposed and the branch stays unmerged.

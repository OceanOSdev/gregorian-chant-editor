# Plan: Stage 9A — Bistropha and Tristropha

Branch: `feature/stage-9a-repeated-note-neumes`
Target: `master`

## Goal and scope

Expand ChantPad's existing modern square-notation profile with named,
same-pitch two- and three-note neumes (Bistropha, also called Distropha,
and Tristropha). Keep the palette compact through a Punctum split button
and preserve the established one-click placement interaction.
This is the first neume-vocabulary expansion after Stage 8D, not a rewrite
of the domain model or a general melisma-spacing change.

## References and governing contracts

Read AGENTS.md, docs/domain-model.md, docs/editor-interactions.md,
docs/layout-and-rendering.md, docs/commands-and-history.md, docs/persistence.md,
docs/testing.md and the ADR log. In particular, respect ADRs 0003 (stable
identity), 0004 (explicit kinds and ordered tuples), 0007 (derived geometry),
0008 (lyric anchors), 0011/0013 (compaction and division boundary rules),
0016 (persistence), 0018 (conventional mora patterns), 0019 (authored forms
vs contour), 0020 (vertical episema), and 0021 (B accidentals).

Historical starting references:

- [Basic Gregorian Chant and Sight Reading (1960), printed pp. 69–71](https://media.churchmusicassociation.org/books/basicgregorianchant_1960.pdf#page=70):
  lessons 29–30 and Liber examples show distropha and tristropha with
  repeated square heads in the Vatican edition, and distinguish earlier
  special stropha shapes and bivirga/trivirga. Printed p. 70 illustrates
  a distropha between clives and a three-square tristropha; p. 71 has
  examples with surrounding neumes and ictus.
- [LilyPond Gregorian chant notation reference](https://lilypond.org/doc/v2.24/Documentation/notation/typesetting-gregorian-chant):
  its distinct stropha-based Bistropha and Tristropha demonstrate why
  historical forms should not be assumed to be interchangeable.
- [Gregorio GABC reference](https://gregorio-project.github.io/gabc/):
  useful independent cross-check of the modern engraving profile and
  repeated-note semantics. GABC interchange is out of scope.

Collect representative printed examples and, where useful, corresponding
GABC/rendered comparisons before settling dimensions and modifier patterns.
Record exact sources, edition/page or chant identifiers, and which conventions
are implemented. Use original SVG geometry, not copied font outlines.
Do not infer historical articulation or rhythmic performance from glyphs.

## Agreed UX: Punctum family split button

- Replace the existing Punctum palette slot with a split control; no separate
  permanent Bistropha or Tristropha buttons. The primary button's label and
  icon remain ordinary Punctum, and its action ALWAYS selects ordinary
  Punctum, regardless of which variant was most recently used.
- The separate chevron opens a compact menu with Punctum, Bistropha,
  Tristropha, recognizable square-note icons, and text labels. Choosing an
  option arms that exact tool and closes the menu, without inserting music.
  Opening/dismissing alone does not alter active or remembered tool,
  document, history, or autosave. No confirmation popup or drag.
- Show the exact active variant visibly and accessibly (e.g. selected menu
  item plus active-family indicator and current-tool/placement name).
  Make the main button's ordinary Punctum action unambiguous even when a
  different variant is active. Do not misrepresent ordinary Punctum as
  pressed when the active kind is Bistropha or Tristropha.
- Click a valid staff position/boundary once to insert the entire chosen
  neume, with every constituent at the snapped pitch. Stay armed for
  subsequent placements, just as for existing neume tools. Shared placement
  resolution, local caret/ghost, lyric membership and division/clef slots
  apply. Main Punctum click switches back directly; Select/Escape exit as
  before. Opening the menu must not commit an unintended score edit.
- Preserve contextual Insert and I for the exact remembered variant; T
  focuses its family control without reactivating ordinary Punctum.
  Remember the variant independently of palette focus and Select/Escape,
  consistent with existing transient remembered-tool semantics.
- Preserve existing roving-toolbar navigation and a single toolbar Tab
  entry; make both split actions reachable with keyboard (e.g. focus
  navigation to the arrow plus Enter/Space, or a documented direct menu
  shortcut). Menu has appropriate accessible names, expanded/selection
  state, keyboard item navigation, Escape dismissal and predictable focus
  restoration. Escape dismissing the menu must not accidentally exit
  placement or trigger document shortcuts. Tab can leave, no focus trap;
  pointer dismissal and responsive wrapping must work. Ensure existing
  focus restoration and keyboard-help guidance account for variants.
  Exact DOM/ARIA implementation is Codex's choice within these outcomes.

## Semantic and engraving direction

- Add two explicit fixed-cardinality neume kinds (canonical identifiers
  bistropha and tristropha; use one spelling consistently), with ordered
  tuples of two/three distinct stable-ID notes. All constituent staff
  positions are equal. One neume ID and one ordinary lyric-anchor boundary,
  not two/three independent Puncta, and not a punctum with mora/duration.
  This extends ADR 0004's established design rather than generalizing the
  union to arbitrary pitch arrays.
- For this modern square-notation profile, derive repeated square heads
  from the kind, using existing Punctum primitives and compact measured
  horizontal spacing. No connecting stem/line between heads, no authored
  stropha field required simply to encode this group. Preserve semantic
  group identity for future interchange; historical special stropha
  silhouettes, bivirga/trivirga, pressus, oriscus and alternate glyph
  profiles are separate work. If evidence shows that a distinct authored
  form is essential for the selected profile, report the alternatives
  before changing the model.
- Each note remains separately selectable and accessible; whole-group
  selection works normally. One-note movement that breaks equality rejects
  (no implicit kind conversion, silent group movement, or history change);
  whole-neume movement moves all notes by the same step.
- Deleting any constituent from Tristropha normalizes to Bistropha;
  deleting either Bistropha constituent normalizes to Punctum. Preserve
  the original neume ID, surviving note IDs/order, attached syllable,
  division/clef anchors, and valid surviving modifiers. Whole-neume and
  final-note deletion follow current policy. Do not silently discard,
  transfer or reinterpret a surviving explicit mark if normalization would
  be invalid; reject and explain instead. No automatic merging of adjacent
  independent Puncta. Do not change existing equal-outer-note deletion
  behavior of Torculus/Porrectus as an incidental side effect.
- Maintain existing authored-form constraints and expand validators
  explicitly; no arbitrary Virga/Inclinatum/Quilisma overrides on these
  groups. Horizontal and vertical episema support follows the existing
  stable-note contracts, with measured geometry and explicit tests.
  Mora is a separate rhythmic sign, not how repeated notes are encoded.
  Establish a sourced, unambiguous allowed mora-pattern matrix for the two
  new kinds under ADR 0018; do not assume every two/three-note pattern
  transfers. If references do not settle the pattern or placement,
  stop that part and propose a conservative scope (including none-only
  if warranted) for owner review before implementing a new rule. Existing
  patterns and note forms must remain unchanged. Check whether authored
  accidentals can distinguish effective pitches within a written-unison
  group; preserve ADR 0021 and report a concrete conflict before introducing
  any new accidental restriction or silent reinterpretation.
- Use shared measured geometry for committed rendering, palette icons
  (where applicable), ghost, advance, hit/selection contours, rhythmic
  modifiers, accidentals, lyric alignment/clearance and system wrapping.
  Keep entire neumes together under the existing wrap policy. Do not globally
  compress intra-syllable spacing, add generic grouping flags, or alter
  existing neume metrics. Verify repeated heads remain distinguishable
  at typical editor zoom and narrow viewports.

## Persistence and compatibility

New semantic kinds require a new native version (proposed v6). Keep exact
v1–v5 readers with their original allowed kinds and all previous strict
validation/recovery protections, including withdrawn draft-v2 handling.
Older versions carrying the new kinds must reject, not silently accept them
using the expanded current validator. New saves/exports write v6; retain
the existing cache key, original-source recovery, cross-tab guards, and
no startup rewrite. Round-trip all IDs, kinds, notes, marks, anchors and
clef/division/accidental data; reject malformed tuple counts, unequal
pitches, duplicate IDs, invalid forms/marks, unknown fields and versions.

Update relevant owning guides/roadmap, schema and ADR log as required.
ADR 0004's explicit-kind pattern remains; document the new kinds and
unison rules, new form/mora scope and version contract. If any Accepted
ADR requires substantive amendment or replacement beyond this stated
extension, follow the ADR process and obtain owner review before
implementing a conflicting behavior.

## Verification and acceptance

Add focused pure tests for both contours, validation, insertion and
graphical placement on multiple systems, independent IDs, selection,
normalization of each constituent, note-movement rejection, group
movement, history/no-ops, lyric anchors/slot ordering, clef preservation,
existing accidentals, modifier behavior, measured geometry and wrapping.
Include no-regression coverage for all prior kinds and persistence
versions; test v6 and malformed files/cache handling. Cover the distinction
between a dotted Punctum, separate equal-pitch Puncta and a Bistropha.

Extend the real-browser driver or create a focused reusable driver under
docs/verification/ for Chromium and Firefox: verify split-button primary
always resets to Punctum, arrow/menu alone changes nothing, exact tool
activation/ghost/one-click placement/repeated placement, pointer and
keyboard dismissals, keyboard menu navigation and focus, I/T remembered
behavior, selection, editing/deletion and undo/redo, responsive layout,
native round trip and localStorage reload. Record actual browser checks
and manual owner acceptance items separately. Capture representative
engraving comparisons against the sourced examples (line and space,
both group lengths, adjacent neumes, relevant supported signs).
No claim of foreground accessibility or historical fidelity beyond the
checks actually performed.

Run npm run format:check, npm run lint, npm test, npm run build and
applicable browser checks following docs/testing.md. Report results,
not-run checks, deviations and any remaining review items.

## Exclusions

No generic variable-length neumes, extended scandicus/climacus,
salicus/oriscus/pressus, special historical stropha glyph, liquescence,
automatic repeat merging, cross-neume grouping/spacing overhaul,
liturgical annotations, GABC import/export, playback, or unrelated
toolbar redesign. Stage 9B and later work remain separate.

## Delivery

Implement on this branch, commit, and open a PR against master. If a
historical/ADR gate is unresolved, commit the evidence and proposed
options, open a draft PR, and stop the affected implementation.
Do not merge. Preserve this plan during review, then follow the owner's
closeout decision. Return PR URL, verification results and focused manual
acceptance checklist.

## Owner clarification (2026-11-12)

The historical mora gate is resolved: approve none-only mora for Bistropha and
Tristropha as an initial authoring-scope restriction, not a claim of historical
prohibition. Preserve all existing mora policies, make kind dispatch exhaustive,
reject every new-kind nonempty pattern in commands/native decoding, and explain
unavailable mora authoring contextually. Expanded mora requires a future sourced
investigation and owner review. Proceed with the remaining milestone and update
existing PR #74; do not merge. See ADR 0022 for the durable extension.

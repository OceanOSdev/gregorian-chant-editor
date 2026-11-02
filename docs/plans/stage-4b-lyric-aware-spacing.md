# Plan: Stage 4B — lyric-aware horizontal spacing and system wrapping

Branch: `feat/stage-4b-lyric-aware-spacing`
Target: `master`
Baseline: `fe25b80c78dec513bce5e9b0a647c647a7bb05bb`
Status: **implemented on the isolated branch; owner/ADR review pending** for 4B only; Stage 4A merged in PR #43,
4C hyphenation and 4D acceptance are **not** authorized on this branch.

**Overflow design gate resolved for this implementation handoff:**
Use **horizontal scrolling for an unbreakably oversized lyric** rather than
clipping, truncating, shrinking, rejecting or splitting the syllable.
This is an explicit 4B presentation policy, documented below and in Proposed
ADR 0010. Codex may implement it without a further stop solely over the
previously identified fixed-width/viewBox conflict. The owner will review
this behavior and the Proposed ADR before merging.

## Problem and desired user result

Stage 4A (PR #43, now on master) gives each lyric an explicit document
language, optional grapheme-safe manual nucleus alignment, matching SVG font
measurements and an `alignment.offset`. However, `layoutChant` still wraps
music with `placeNeumeSequence` before attaching text; a long syllable or
adjacent words can collide or overhang, and a lyric edit cannot affect
wrapping. Stage 4B makes **measured lyrics participate in horizontal
placement and system wrapping**, while retaining the current engraved
neumes and edit UX.

Our agreed visual principle: _music determines the alignment; lyrics
influence minimum spacing; hyphens appear where needed to preserve the
readability of a word_. Use `Kyrie eleison` and, eventually in 4C,
the mixed joined/separated `auditione` reference from
https://gregobase.selapa.net/chant.php?id=1261.

**Important:** 4B deliberately does not generate any hyphens or
cross-system continuation marks. A musical gap can therefore leave a
same-word syllable visually detached until Stage 4C. Do not “fix” that
by distorting neume gaps or slipping in partial hyphenation.

## Resolved overflow policy: scrollable oversized score

Most chants continue using the existing 720-layout-unit score and responsive
SVG scaling. Horizontal scrolling is an **exceptional fallback** when a single,
unbreakable syllable (or the necessary first anchored unit) cannot fit in an
otherwise empty normal system while preserving font size, text advance,
the Stage 4A vowel/segment-to-neume alignment, musical minimum clearances and
the normal usable staff width. Do not use scrolling as a substitute for normal
lyric-driven wrapping or increased between-neume spacing.

- **Try normal spacing and wrapping first.** Never widen the ordinary
  720-unit score merely to keep more neumes or syllables on a system.
  Preserve current whole-neume break semantics and the standard musical
  placement bounds for all normal items.
- **Oversize cannot be split.** For a truly unplaceable item, place it once
  on its own system (at least the oversized item; do not force other neumes
  into the extra horizontal space), ensuring forward progress.
  **Expand the derived horizontal SVG content canvas** only as far as
  necessary to contain the complete measured lyric and any related ink, with
  modest padding. Account for **both left and right overhangs** of a
  nucleus-aligned string; an expanded viewBox may require an x origin less
  than zero rather than assuming all text starts at x=0. Preserve the real
  neume's original lyric anchor relationship and its established contours.
- **Scroll rather than scale-to-fit.** Render the exceptional expanded SVG
  at a sufficient intrinsic CSS width to preserve the normal-size lyric and
  music instead of squeezing an arbitrarily wide viewBox back into the
  normal score container. Use a local, keyboard-usable, horizontally scrollable
  **score viewport**, not document/page-level horizontal overflow. Keep
  editor controls outside the horizontal scroller and usable at narrow
  viewport widths. Existing ordinary scores should retain their
  responsive scaling. The full text must be reachable by scrolling, not
  merely present outside a clipped element.
- **Keep logical wrapping bounds separate from content-canvas bounds.**
  The exceptional wider canvas is for displaying a single oversized item,
  **not** a new infinite-width line for placing all subsequent neumes.
  Subsequent items still use the normal system width and wrapping decisions,
  including the existing oversized-item progress rule. Multiple systems
  can share an expanded overall viewBox; ordinary systems must not
  expand their musical spacing as a side effect.
- **Keep pointer and focus coordinates consistent.** Any derived
  negative viewBox x origin, horizontal scrolling, dynamic CSS dimensions
  or viewport width changes must be accounted for by the existing
  SVG-coordinate conversion, graphical placement bounds, scroll-to-focus,
  selection/hit testing and caret positioning. Verify a usable insertion
  and focus path on subsequent systems while an oversized score is scrolled.
- **When font metrics are unavailable**, retain the provisional 720-unit
  music-only layout and recompute when valid measurement arrives. Never
  invent character widths to force overflow. Extremely long finite measured
  text may cause a very wide local scroll surface but must not cause
  unbounded reflow iterations. No new semantic field or persisted width.
- **Graceful visual distinction.** The fixed 720-unit **normal system
  placement policy** remains; the exceptional SVG viewBox/content canvas
  is derived and may be wider. Preserve current engraving typography.
  Do not introduce global scaling, line breaks inside syllables,
  ellipses, text-length validation, a parallel full-text panel, or
  hyphens as workarounds.

This is a reviewable Stage 4B presentation decision, **not** acceptance of
Proposed ADR 0010 or a revision to ADR 0005 on master.

## Architecture decision / review gate

A deliberately **Proposed** [ADR 0010](../adrs/0010-derive-wrapping-from-music-and-lyric-geometry.md)
records the combined-geometry replacement for
[accepted ADR 0005](../adrs/0005-derive-wrapping-from-rendered-geometry.md).
Read `docs/adrs/README.md` and the full ADR 0010.

The owner authorized the Stage 4B _direction_ and this separate
implementation experiment; **Codex may implement on this branch against
the explicit Proposed ADR**. Do not silently mark ADR 0010 Accepted or
ADR 0005 Superseded. Before merge, the owner will inspect the actual
engraving and explicitly accept/reject the replacement. On acceptance,
update both ADR statuses and reciprocal links and the owning guides
in the PR before merging. If implementing 4B requires a materially
different architecture than ADR 0010, **stop and report options** instead
of changing the proposal unilaterally. The Proposed status alone is
_not_ a reason to stop before starting the approved 4B experiment.

Read `AGENTS.md`, `docs/ai-workflow.md`,
`docs/architecture.md`, `docs/layout-and-rendering.md`,
`docs/editor-interactions.md`, `docs/domain-model.md`,
`docs/testing.md`, relevant existing ADRs (especially 0002, 0005,
0007, 0008, 0009) and the retained
[overall Stage 4 plan](stage-4-lyric-engraving.md). The prior
`lyric-system-redesign.md` minimal-engraving notes are superseded.

## Agreed boundaries and design intent

1. **One coherent derived layout.** Place complete neumes in semantic
   order using their existing shared musical ink geometry and
   `advanceX` as lower bounds. Consider the Stage 4A measured text width,
   grapheme-alignment offset and word-boundary metadata **within the same
   horizontal placement/wrapping decision**. Do not lay out music and then
   independently apply a renderer-level lyric spacing correction. Reuse the
   current `NeumeGeometry` and musical `lyricAnchorX`; never alter the
   internal neume ink contour to obtain text clearance.

2. **Only increase space where needed.** Maintain music's current
   inter-neume baseline (33-unit ink gap for ordinary separate neumes).
   Enlarge a relevant between-neume advance only to avoid collision of
   distinct lyrics or to enforce an actual word gap, not to artificially
   “join” syllables. Same-word continuation syllables may abut without a
   space if their musical anchors permit; they must not overlap. Distinct
   words require readable word separation, derived from the matching lyric
   font (or a documented deterministic minimum when no space metric is
   available). Keep intervening melismatic neumes as tightly grouped as
   their _musical_ geometry allows: no arbitrary extra spread among
   unanchored neumes merely because a syllable is long. A single large
   neume or multiple neumes may keep syllables far apart, which is
   acceptable until 4C.

3. **Measure before committing geometry.** The existing
   `src/editor/layout/lyric-text-metrics.ts` exposes advance bounds
   and vowel-alignment offsets, and
   `src/editor/rendering/use-lyric-measurement.ts` is the browser
   adapter. Keep DOM/font loading out of semantic commands and pure
   placement. Avoid duplicated font metric logic; one measurement
   snapshot drives the displayed SVG and interaction geometry. If
   metrics are missing, malformed or fonts are not ready, use a
   deterministic music-only fallback rather than speculative spacing
   or zero-width arithmetic. Reflow when good measurements arrive.
   Prevent unnecessary repeated DOM work, animation loops, or
   oscillating placement when metrics stabilize.

4. **Wrapping uses combined visible extents.** A candidate must fit
   both neume ink bounds and relevant measured lyric extents/word
   clearances in the usable system width. Enforce exact-fit behavior
   (equality stays on the system), whole-neume wrapping, forward
   progress on a single oversized item, no ghost empty systems, and
   stable global `startNeumeIndex`. Handle a new system's first
   syllable's **left bearing** as well as the last syllable's **right
   bearing**; no silent clipping of otherwise placeable lyrics.
   Apply the **resolved scrollable oversized-score policy above** for
   unbreakable syllables that cannot fit an otherwise empty normal
   system. This explicitly permits a _derived exceptional viewBox/canvas
   width and x origin_ while retaining normal 720-unit wrapping bounds.
   Do not re-escalate that previously identified fixed-width conflict.
   Escalate only genuinely new material constraints not resolved here.

5. **Maintain the real pointer/preview contract.** Currently
   `ChantEditor` passes measured metrics to `layoutChant`, but
   `editor-session.ts` recomputes `layoutChant(document)` (without
   metrics) when resolving a graphical placement. After 4B, those
   can disagree on _system membership and boundary positions_.
   Resolve this explicitly: click -> correct current whole-neume
   insertion index in the **displayed measured layout** -> commit on
   the reducer's current semantic document without retargeting a
   different neume. Keep stable IDs, focus restoration, selected
   target, per-system caret, pointer hit region and local ghost
   consistent. The current preview deliberately does **not**
   simulate entire hypothetical reflow; do not add that as a 4B
   requirement. Music-only `wrapNeumes` / unwrapped helpers may
   remain as clearly named music-only utilities for current clients,
   but document which entry point is authoritative for a score
   with lyrics.

6. **Semantics and history unchanged.** No new language, syllable,
   word, metric, pixel or system fields in the semantic document;
   `boundaryBefore`, `startsAtNeumeId` and the 4A override
   continue to determine lyric meaning/alignment. On text,
   word-boundary, language or alignment edits, re-derive spacing and
   wrapping without creating extra history entries. Preserve the
   existing Save / Discard / Cancel draft safeguards, stable IDs,
   native Tab focus and semantic-selection independence, and
   correct click/keyboard insertion across systems.

7. **4C seam only.** Expose or cheaply derive each rendered lyric's
   actual left/right text advance bounds, word relationship,
   musical anchor and system boundary from the 4B result so
   conditional hyphens and outgoing system-break hyphens can be
   added in 4C. Do not pre-reserve arbitrary hyphen lengths,
   render hyphens, select a hyphen-placement threshold, or
   redesign syllable ownership in 4B.

## Suggested implementation route (not a mandate)

- Model each anchored syllable's measured left/right extent relative
  to its neume's `lyricAnchorX`; treat the manually selected nucleus
  exactly like an automatic nucleus for spacing.
- In a single pure placement walk, position each neume at no less
  than the existing musical minimum, and when an incoming neume
  starts a new syllable, add only the offset required to keep its
  lyric extent clear of the previous same-system lyric and any
  distinct-word gap. Track the relevant last lyric's right edge,
  not merely the last neume's edge; in-between melismatic neumes
  remain music-spaced. Test both next candidate's neume bounds
  and its resulting lyric bounds against the right boundary before
  accepting it.
- On wrap, reset the same-system text-clearance state; preserve
  semantic boundary and lyric IDs. Keep single-item/long-syllable
  overflow handling deterministic and one-pass where possible.
- Thread the same measurement context through any interaction
  path that otherwise independently computes score layout.
  Review all `layoutChant` call sites and derived helper names for
  stale layout hazards.

These suggestions express design intent, not instructions to create
a parallel second layout engine. Prefer a small pure refactor over
duplicating layout and wrap logic.

## Acceptance criteria (automated + visual)

**Geometry and correctness**

- A lyricless document's _complete_ geometry, layout height,
  system counts and break indexes match the pre-4B music-only
  baseline (including all seven supported neume types).
- Under measured lyrics, words/syllables never collide on the
  same system when their extents can fit; separate words have an
  actual gap; same-word syllables have no forced word space.
- Existing musical ink gaps are never compressed, neume internal
  geometry and individual note ownership remain unchanged,
  manual overrides and language changes correctly affect
  measured lyric extents, and trailing melismas do not acquire
  artificial extra spacing.
- Short/long syllables, adjacent new words, nearby same-word
  syllables, one or multiple unanchored melisma neumes,
  Clivis/Porrectus/Climacus and other wide/compact neumes,
  and text beginning/ending near usable staff bounds are covered.
- Exact fit, one-neume overflow, very long unbreakable lyric,
  overlong initial lyric, no-lyrics/empty documents, 320px CSS
  viewport and missing/invalid/pending metrics all have
  deterministic safe outcomes. Neither 0/NaN nor a repeated
  unplaceable candidate causes an infinite loop.
- An exceptional oversized syllable extending **left of x=0**, **right
  of x=720**, and both directions is fully reachable in the locally
  scrollable score at its original lyric size. The canvas and
  viewBox origin are derived and measured. Normal-score width,
  ordinary score scaling and music-only wrapping are unchanged.
  The page itself has no unintended horizontal overflow at 320px.
  Verify actual native horizontal scroll (including keyboard use),
  focus/reveal, pointer-to-SVG coordinates and placement on another
  system after horizontal scrolling.
- Editing a lyric, changing a word boundary, editing vowel
  alignment, or changing the document language can reflow
  systems _without changing the semantic document beyond that
  user action_, and undo/redo restores the derived placement.
- The current musical placement cursor and local ghost remain
  correctly hit-tested before/after lyric-induced reflow;
  no stale music-only reducer layout silently changes the
  insertion boundary, pitch or destination system. Verify
  actual pointer selection, whole-neume insertion, focus and
  semantic-selection vs keyboard-focus independence.

**Visual and accessibility acceptance**

- Compare before/after browser screenshots for `Kyrie
eleison`, a collision example with a long word, a word
  boundary, and a multi-system layout. Confirm the letters'
  vowel nuclei remain aligned to the musical neumes.
- Inspect results with multiple fonts/font fallback, multiple
  neume kinds, a 320px viewport, and layout recomputation
  after a font becomes available. Mark Firefox and screen-reader
  checks unverified unless actually performed.
- Preserve stable SVG lyric controls and accessible names;
  purely derived text spacing must not make text selection,
  clicking, deletion, tab focus, or draft editing unusable.
- Do not claim final `auditione` editorial appearance or
  cross-system word hyphens until 4C. Explain in the PR what
  still looks separated without hyphens.

**Verification and documentation**

- `npm run format:check`, `npm run lint`, `npm test`,
  `npm run build` and `git diff --check` must be run and
  accurately reported. Execute relevant **actual browser**
  checks for placement, focus and reflow; do not treat pure
  geometry tests as proof of pointer correctness.
- Update the actual owning layout, interaction and testing
  guides and roadmap/limitations in the implementation PR.
  Keep ADR 0010 explicitly Proposed and ADR 0005 Accepted
  until the owner's architectural acceptance review.
  Retain the multi-stage plan, updating milestone status.
  Keep test screenshots out of source control unless the
  project's verification policy specifically calls for a
  retained reference artifact.

## Scope exclusions

No semantic word entities, GABC import/export, persistent
coordinates, explicit/manual system breaks, pagination,
justification of a whole line to staff-end, music playback,
new fonts/dependencies without strong reason, automatic
syllabification, changes to established neume silhouettes,
full hypothetical ghost reflow, hyphenation or outgoing
system-break marks (4C), or general cross-browser/
screen-reader acceptance work beyond affected 4B regressions
(4D).

## Stop conditions and handoff completion

Codex should implement the **agreed** 4B approach without
requesting a second approval for the already recorded lyric-aware
layout experiment. Stop and explain evidence/options if the
architecture requires semantic metric/word state, changing
accepted neume engraving, an **additional** unresolved overflow
constraint beyond the explicit scrollable-canvas policy, or a
genuinely different wrapping model than the Proposed ADR. The
fixed-720-unit canvas overflow question itself is **resolved**
for implementation; do not stop on it again.

On this branch, run verification, commit implementation,
and open a PR targeting `master`, **do not merge**. Report
actual test/browser results, before/after screenshots,
limitations and explicit architectural deviations. The owner
reviews the proposed ADR and screenshots and decides whether
to accept the ADR replacement before merging. Stage 4C
starts in a separate subsequent handoff.

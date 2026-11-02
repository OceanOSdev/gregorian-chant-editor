# Stage 4C implementation review

For the latest auditione comparison and review repairs, see the
[auditione investigation](auditione-review.md).

For the PR #45 corpus iteration and refined joining policy, see the
[corpus review](corpus-review.md). The four-case screenshots and numeric results
below record the **initial** iteration (0.4-em threshold, before geometric text
rendering); they are retained as historical evidence, not current expectations.

Implemented on `feat/stage-4c-word-composition`, based on `22058f5` (handoff)
and `8672a1e` (merged Stage 4B). This is evidence for owner review, not Stage 4D
acceptance. ADR 0011 remains **Proposed** and ADR 0010 remains **Accepted**.

## Policy and visual findings

The [layout guide](../../layout-and-rendering.md#stage-4c-branch-experiment-word-composition)
owns the exact contextual minimum, pointer ownership, measured threshold,
reservation, fallback and oversized behavior. No semantic document or history
format changed. All seven shared musical constructions remain unchanged.

`Al / le / lu / ia` with two unanchored neumes after `Al` produces `Al - leluia`:
the final three syllables have approximately two-unit painted gaps in both
browsers. The next word `ah` retains ordinary musical spacing. Wide Porrectus
music prevents `le / lu` joining and produces a second measured hyphen.
`Kyrie eleison` has no hyphens in these fixtures: the short `ri / e` gap remains
because of musical/vowel anchors. Separate lyric controls do not share kerning.
The 0.4-em threshold deliberately avoids widening that small gap for punctuation.

The [GregoBase reference](https://gregobase.selapa.net/chant.php?id=1261),
Graduale Romanum 1961, p. 95*, was inspected from its source scan. Its
`audi-ti-óne` mixes joined and hyphenated syllables. This implementation follows
the mixed-joining principle, with our existing Georgia stack, project neume
geometry and one centered short hyphen rather than reproducing the scan's
engraving or adding its other notation features.

The outgoing case has one mark after the first system's music, no incoming
mark, and `leluia ah` on the second system. For a longer melisma, the mark belongs
to the source lyric's system; intermediate music-only systems do not repeat it.
The bounded forward reservation can wrap earlier than an optimizing lookahead
policy. Oversized text and its mark remain available through local scrolling.

## Selected visible-editor screenshots

These eight PNGs are deliberate review evidence requested by the handoff, not
regenerated test baselines. Routine runs still write all diagnostics to fresh
system temporary directories and never overwrite these specimens. Baselines
were captured before implementation from the Stage 4B behavior on this branch;
after images use the final 0.4-em policy. Both use the real StrictMode editor,
Chromium, a 1440 × 1100 viewport, and the same semantic fixtures.

| Case                            | Before                                  | After                                 |
| ------------------------------- | --------------------------------------- | ------------------------------------- |
| `Al ... leluia ah`              | [Before](review/before-alleluia.png)    | [After](review/after-alleluia.png)    |
| `Kyrie eleison`                 | [Before](review/before-kyrie.png)       | [After](review/after-kyrie.png)       |
| Wide neume / conditional hyphen | [Before](review/before-conditional.png) | [After](review/after-conditional.png) |
| Outgoing system continuation    | [Before](review/before-outgoing.png)    | [After](review/after-outgoing.png)    |

## Verification performed

- `npm run format:check`, `npm run lint`, `npm test` (43 files, 697 tests),
  `npm run build`, and `git diff --check` passed.
- `word-composition/browser-check.mjs` passed with Chromium CDP and Firefox
  BiDi. It asserts measured hyphen clearance, one outgoing mark within the staff
  end, no unwanted Kyrie marks, and native pointer selection for every
  constituent note of compact pairs of all seven kinds at desktop and 320px.
- `lyric-spacing/browser-check.mjs` passed: measured/painted clearance,
  selection backgrounds, 150% CSS zoom, native text edits and history,
  pointer/caret insertion on later systems, all seven kinds, font substitution
  and reload, focused-ID restoration, both canvas overhangs, local scrolling
  and scrolled insertion at 320px. Its word-boundary case now uses the second
  lyric on a system because a first lyric's boundary need not move geometry.
- `vowel-alignment/browser-check.mjs` passed with displayed musical anchors in
  place of obsolete fixed 45-unit steps. It verifies native manual ranges,
  language/text edits, focus/selection independence, drafts, undo/redo,
  combining graphemes and narrow/multi-system behavior. Complete-neume reflow
  may change coordinates; contours/pitches remain fixed and undo restores music.
- `continuous-lyrics/browser-check.mjs` passed: native keyboard/draft/editing,
  focused versus selected deletion, Tab/Shift+Tab independence, atomic history,
  cursor behavior, occupied anchors and narrow input/overflow checks.
- `lyric-spacing/selection-cue-firefox.mjs` passed on a fresh headless Firefox
  profile: native pointer selection, painted SVG clearance and selection cues
  at desktop, 320px and 150% CSS zoom. Firefox reported no foreground document
  focus; foreground keyboard and spoken screen-reader acceptance are not claimed.

Initial browser reruns encountered Vite's stale module cache after in-place
source writes; restarting Vite resolved fixture startup. The initial Stage 4A
fixed-coordinate assertion was adapted to its actual alignment contract.
A fractional Chromium glyph overlap at 320px motivated the measured same-word
precision clearance; the final painted-clearance checks pass in both browsers.

Reproduce with Vite on port 5173, Chromium on debugging port 9230, and Firefox
on port 9234 using a fresh existing profile. Run browser drivers sequentially.
`CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session` selects Firefox for the Stage 4C
driver. `CHANT_BASELINE=1` captures baseline images without Stage 4C assertions.
Generated Chromium images are in `/tmp/chant-word-composition-jjruVW`; Firefox
images are in `/tmp/chant-word-composition-BGjuTG` for this run.

Owner visual approval of the compact music, residual short gaps, outgoing style
and Proposed ADR 0011 remains required. Stage 4D, foreground assistive-technology
acceptance, more notation vocabularies and publication-quality engraving remain
deferred. No merge was performed.

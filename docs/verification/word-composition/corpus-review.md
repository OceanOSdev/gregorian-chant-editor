# PR #45 corpus engraving review

This iteration tests a general measured-spacing policy across eight entries and
five arrangements (40 documents), rather than treating Alleluia or screenshot
coordinates as the acceptance oracle. ADR 0011 remains **Proposed**; ADR 0010 is
**Accepted**. The earlier four-case record is historical evidence.

## Corpus and editorial metadata

| Entry         | Syllables in each semantic word | Consecutive-punctum result in Chromium                                      |
| ------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Alleluia      | Al/le/lu/ia                     | All three boundaries join                                                   |
| Gregario      | gre/gar/io                      | Both boundaries join                                                        |
| Miserere      | mi/se/re/re                     | All three boundaries join                                                   |
| Gloria        | Glo/ri/a                        | Glo/ri joins; ri/a needs a hyphen                                           |
| Kyrie eleison | Ky/ri/e + e/lei/son             | Ky/ri and eleison join; ri/e needs a hyphen; real word space before eleison |
| Dominus       | Do/mi/nus                       | Both boundaries join                                                        |
| Sanctus       | Sanc/tus                        | Joins                                                                       |
| Deo           | De/o                            | Needs a hyphen                                                              |

`corpus.ts` declares these editorial word arrays explicitly. The first syllable
of **every** word has `boundaryBefore: 'word'`; all later syllables of that word
have `'continuation'`. The inspector independently compares the document metadata
with those arrays and validates anchors/order. A deliberately corrupted boundary
before eleison is rejected despite being otherwise valid domain metadata.

Every entry has consecutive puncta, three unanchored neumes after its first
syllable, adjacent multi-note neumes, a genuine outgoing system continuation,
and an appended distinct word. Kyrie eleison already contains two words; its
appended-word fixture additionally checks another real boundary. Wide fixtures
cycle through all six multi-note kinds; punctum fixtures cover the seventh kind.
Breaks come from ordinary music geometry, without saved system breaks or widths.

## What the measurements changed

The earlier 0.4-em join threshold exceeded the quarter-em real-word minimum.
Actual Chromium metrics found unmarked word-space-sized gaps in 10 of 40
arrangements, including Gloria, Kyrie and wide Gregario. The initial synthetic
matrix independently exposed the same rule failure in 19 of 120 metric profiles.

The refined rule treats only **0.1-em occupied-edge gaps** as joined, using the
union of measured text advance and guarded glyph ink. Larger unavoidable gaps
get a measured hyphen. Safe compaction still uses the existing two-unit musical
ink minimum and midpoint pointer ownership. Mark reservation adds only the
missing width plus its two margins, without an additional join-clearance pad.
No spelling, word name, syllable count or neume count affects this decision.

For example, the closest safe ri/a and ri/e boundaries have occupied gaps around
5.3 units in the Chromium font; De/o has about 3.4. None fits the near-contiguous
join criterion without changing musical geometry or vowel alignment. The rule
therefore communicates continuation with a hyphen. By contrast, the joined
corpus boundaries reach a one-unit occupied gap (about two units between actual
painted glyphs, including the measurement guards). These are observations for
review, not golden coordinates.

Firefox at 320px also exposed hinted glyph bounds extending beyond unscaled
hidden measurements: the initial Al/le example overlapped by about one score
unit. Both hidden and visible lyric/hyphen text now use `geometricPrecision`,
keeping measured and rendered extents consistent across responsive sizes. This
avoids viewport-dependent spacing or a new resize/reflow cycle. Musical ink,
anchors, target partitions, semantic identity and history are unchanged.

The [layout guide](../../layout-and-rendering.md#stage-4c-word-composition)
owns the precise policy; these results do not amend acceptance of ADR 0011.

## Compact visual comparison

- [All eight entries with consecutive puncta](review/corpus-words.png)
- [Melismas, wide neumes, system breaks and explicit word boundaries](review/corpus-arrangements.png)

The sheets contain actual SVG cloned from the real mounted editor. A tight
viewBox crop removes editor chrome and the off-crop clef; inactive focus cues and
transparent hit targets are omitted. Musical and lyric positions within each
score remain untouched. Cards show syllable metadata and measured gap categories;
they are static review evidence, with no pass/fail image-difference operation.
The arrangement sheet samples Alleluia, Gregario, Gloria and Deo; automated
checks cover all eight entries in every arrangement.

The wide fixtures demonstrate both a joined syllable pair under multi-note
music and separation that a wider contour makes unavoidable. Melismas get marks
from measured separation, never just their neume count. Each split word has one
outgoing mark and no incoming duplicate. Distinct words keep their own space.
Reviewers should judge the amount of compaction, residual typography between
separate controls, and the visual length/placement of generated hyphens.

## Verification results

All 40 documents passed in each final browser configuration:

| Browser  | Measurement context   | Joins | Internal hyphens | Outgoing marks | Real word boundaries |
| -------- | --------------------- | ----- | ---------------- | -------------- | -------------------- |
| Chromium | Default font, desktop | 64    | 34               | 8              | 13                   |
| Chromium | Default font, 320px   | 64    | 34               | 8              | 13                   |
| Chromium | DejaVu Sans, 320px    | 70    | 28               | 8              | 13                   |
| Firefox  | Default font, desktop | 63    | 35               | 8              | 13                   |
| Firefox  | Default font, 320px   | 63    | 35               | 8              | 13                   |
| Firefox  | DejaVu Sans, 320px    | 70    | 28               | 8              | 13                   |

These counts describe this run. They are **not asserted baselines**: font changes
can legitimately change a boundary's classification while preserving all rules.
The JSON diagnostics record advances, painted edges, occupied gaps, closest safe
adjacent placement, explicit metadata and system ownership for each boundary.

Automated invariants cover:

- Correct text/word metadata and stable semantic order, with no document mutation.
- Identical neume contours, pitches, note targets and musical/vowel anchors;
  non-overlapping neume ink and unambiguous neighboring target ownership.
- Non-overlapping occupied and actual painted lyric bounds; sufficient distinct
  word spacing; no unmarked word-space-sized continuation gaps.
- Joining whenever the safe geometry permits it, rather than introducing an
  unnecessary gap or hyphen. Required marks reserve only missing clearance.
- Mark ownership and lyric clearance, measured outgoing bounds, deterministic
  whole-neume wrapping, and pointer-inert/aria-hidden decorations.

`npm run format:check`, `npm run lint`, `npm test` (44 files, 818 tests),
`npm run build`, and `git diff --check` passed. The corpus adds 120 synthetic
metric/arrangement checks and one negative metadata case. Browser corpus checks
inspect actual `getBBox()` and advances separately from pure layout assertions.
The existing native pointer driver passed for all constituents of all seven
compact neume pairs at desktop/320px in Chromium and Firefox. Existing Chromium
spacing and vowel-alignment drivers passed, including font reload, selection vs
focus, undo/redo, graphical insertion, scrolling and narrow layouts.

Reproduce using the [testing guide](../../testing.md#pr-45-corpus-verification).
The final Chromium diagnostic directories are `uHROM7`, `GgyUE9`, `gSYQW3` under
`/tmp/chant-word-composition-`; Firefox uses `48Ra4S`, `uFpEXt`, `D3rglR` there.
Routine diagnostics stay temporary; the two selected PNGs are intentional review
evidence and are never rewritten by running a test.

Foreground Firefox keyboard focus and spoken screen-reader acceptance remain
unverified. Separate lyric controls do not share kerning, and some fonts cannot
join every short vowel without violating safe music spacing. Visual acceptance
and ADR 0011 approval remain with the owner; the PR remains unmerged.

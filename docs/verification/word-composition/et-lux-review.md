# Et lux perpetua: repeated puncta and lyric ownership

PR #45 investigation. ADR 0011 remains **Proposed** and ADR 0010 **Accepted**.
No production layout, neume type, anchoring, interaction or spacing policy changed.

## Source and supported reconstruction

The [GregoBase Requiem](https://gregobase.selapa.net/chant.php?id=1261)
[GABC](https://gregobase.selapa.net/download.php?elem=1&format=gabc&id=1261)
contains `et(hh) lux(h) per(h)pé(hg/hi!jvHGhhg)(,)(i_[oh:h]hivHF')tu(f)a(fhF'Efhhf//hvvGF'hee[ll:1]d.0)`
under C clef 3. Parentheses associate music with one syllable; lowercase `h`
is an ordinary punctum pitch. Thus `et(hh)` is **one syllable with two successive
same-pitch puncta**, not two syllables, a bivirga (`hvv`) or a distropha (`hss`).
See the official [GABC syntax](https://gregorio-project.github.io/gabc/index.html).
The generated reference SVG also paints the pair as two separate identical
one-note glyphs. Its source scan and generated SVG were visually inspected.

`et-lux.ts` supplies a focused et/lux fragment, a full supported transcription,
and a forced system-break control between the two et notes. Both puncta have
staff position 5; only the first starts the et syllable. The second inherits its
ownership through the existing derived syllable span. Boundaries before et,
lux and per are `word`; before pé, tu and a they are `continuation`.

The full phrase preserves every pitch and lyric assignment, including the
untexted second music group belonging to pé. Longer compounds are decomposed
into valid punctum, podatus, clivis and climacus shapes. This approximates
compound connections, virga/repetition shapes and grouping; rhythmic signs,
episemata, bars, source line layout and justification are not represented.
The et pair itself requires no unsupported neume. The full phrase is a supported
pitch reconstruction, not a facsimile of all its glyphs.

## Alignment and spacing diagnosis

Measurements from the actual generated reference SVG, in its point coordinates:

| Reference feature         | Horizontal position |
| ------------------------- | ------------------: |
| First punctum ink center  |             159.440 |
| Second punctum ink center |             165.720 |
| Pair midpoint             |             162.580 |
| e ink center              |             159.422 |
| Complete et ink center    |             161.460 |

The **e aligns with the first note**, within 0.018 pt; it does not align with the
pair midpoint. The t extends right, and the pair is compact, making the whole
word look closer to centered underneath both notes. This agrees with Gregorio's
[first-note alignment rules](https://gregorio-project.github.io/graphy.html)
for a syllable beginning with a one-note glyph. A rule for a two-note glyph
must not be applied simply because a syllable contains two one-note glyphs.

In our actual Chromium fragment, the two anchors are 230 and 275 score units;
the measured e advance center is 230, complete-text center 232.773 and pair
midpoint 252.5. Separate font/scale units should not be compared directly.
Normalized by notehead ink width, the reference center separation is about
**1.46 widths**, versus our **3.75 widths** (12-unit head plus the accepted
33-unit inter-neume ink gap). This is the material visual difference.

**Classification:** no duplicate-lyric, ownership, hyphenation or vowel-anchor
bug was found. Stage 4C compacts successive same-word syllable anchors, not
unanchored music within a syllable. Its conditional-hyphen policy correctly
creates no boundary or mark inside et, nor a syllable hyphen at the et/lux word
boundary. The full phrase still has legitimate perpetua continuation marks.

Matching the tighter pair would require a separate general engraving decision
about intra-syllable/repeated-puncta spacing or explicit musical grouping. An
explicit compound type is another option only if its musical semantics warrant
one; two equal notes alone do not require it. Centering lyrics over the entire
syllable span would change the accepted anchor contract, affect longer melismas,
and would not match the measured first-note alignment here. These alternatives
are documented for review, not implemented. No global threshold was tuned.

## Regression evidence

- `et-lux.test.ts` checks valid shapes/anchors, shared semantic ownership,
  one rendered et, first-note vowel alignment, ordinary musical clearance,
  no fabricated hyphen in the et region, the split-span control, all source
  pitch sequences and every boundaryBefore value.
- Final checks passed: `npm run format:check`, `npm run lint`, `npm test`
  (46 files, 847 tests), `npm run build` and `git diff --check`.
- The shared corpus now has 47 documents, exercised under three synthetic
  text-metric profiles. Tests use relative geometry and semantic assertions.
- Actual Chromium at 1440px and Firefox at 320px each passed all 47 corpus
  cases, including actual text extents, single et rendering, equal note pitches
  relative to their staffs, first-note e alignment and no internal et mark.
- [Chromium comparison](review/et-lux-chromium.png) and
  [Firefox narrow comparison](review/et-lux-firefox-320.png) show the fragment,
  full supported phrase and split-span control. These are review evidence,
  not golden-image pass/fail tests. The small full-phrase overview deliberately
  exposes the extra wrapping caused by supported compound decomposition.

No production interaction path changed. Foreground keyboard/screen-reader
acceptance is not claimed by these headless rendering checks. PR #45 stays
open for review; no Stage 4D work or merge is included.

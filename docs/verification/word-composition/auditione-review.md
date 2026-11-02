# Auditione: reference assignment and spacing diagnosis

PR #45 investigation; ADR 0011 remains **Proposed**. No special-case spacing,
global threshold change, musical contour change or new editorial field is made.

## Reference reconstruction

The [GregoBase Requiem gradual](https://gregobase.selapa.net/chant.php?id=1261)
links the Graduale Romanum 1961 p. 95* scan and its GABC transcription. The
[transcription](https://gregobase.selapa.net/download.php?elem=1&format=gabc&id=1261)
contains `(c3)` and `au(h)di(h)ti(h)ó(h)ne(hi)` at this word. The scan was
visually inspected; the GABC supplies the precise semantic assignments. Its mixed typography reads
`audi-ti-óne`.

All five syllables are distinct semantic entities. The four `h` notes are
same-pitch puncta. The final `hi` is an adjacent ascending podatus, assigned
entirely to `ne`. There is no intervening unanchored neume or melisma in this
word. Under C clef 3, these notes occupy staff-relative positions 5 and 6.
Every shape and interval in the word is supported, so no approximate neume is
needed. The surrounding chant, page justification, historical font and other
notation outside the word are not reproduced.

`auditione.ts` supplies four explicit specimens with identical stable anchor
ordering and boundaries (`word` before au, then four `continuation` values):

1. Reference assignment: au / di / ti / ó / ne; four puncta and a podatus.
2. Unaccented control: au / di / ti / o / ne; identical musical assignment.
3. Punctum control: accented text; replace only the final podatus with a punctum.
4. Whole-syllable centering control: accented reference music with explicit
   unspecified-language alignment, to isolate the contribution of vowel alignment.

These join the 40 existing corpus arrangements as four additional documents.
They are included in both synthetic invariant tests and actual-browser checks.

## Measured comparison

The default-font reference specimen produces **`auditi-óne`** in both browsers:

| Boundary | Closest safe occupied gap, Chromium | Firefox | Current decision | Reference appearance |
| -------- | ----------------------------------- | ------- | ---------------- | -------------------- |
| au / di  | 1.00                                | 1.00    | Join             | Join                 |
| di / ti  | 1.44                                | 1.89    | Join             | Hyphen               |
| ti / ó   | 4.79                                | 5.22    | Hyphen           | Hyphen               |
| ó / ne   | 1.00                                | 1.00    | Join             | Join                 |

Values are score units from actual browser font measurements, including the
advance/guarded-ink union. They are observations, not fixed-position test or
image goldens. The unchanged join limit is 0.1 em (2 units at this font size).
The final hyphen gap includes the measured glyph and clearance; it is larger
than the minimum safe gap in this table because a mark must fit there.

[Reference assignment and three controls](review/auditione.png) shows actual
editor SVG with measured boundary classifications. Separate interactive syllables
remain separate controls; no fake combined word is painted over the music.

Removing the accent does not change any boundary decision in these runs.
Changing the final podatus to a punctum also leaves the decisions unchanged:
its lyric anchor remains the first note, and it is downstream of the disputed
di/ti boundary. Whole-syllable centering changes the numerical gaps but still
joins di/ti and hyphenates ti/ó in the default fonts. Latin alignment already
recognizes the au diphthong, the i nuclei of di and ti, and the accented ó.

With DejaVu Sans at 320px, the reference/unaccented/punctum controls retain the
same join pattern; whole-syllable centering can remove the ti/ó mark in that
alternate font. Alignment and font metrics do influence gaps, but neither
explains the disputed di/ti join as an implementation error.

The difference is therefore **not an incorrect syllable boundary, lost accent,
unsupported neume assignment, or broken vowel alignment**. Our conditional
compaction policy deliberately closes di/ti to a safe near-contiguous gap and
then suppresses a hyphen. The reference uses different engraving proportions
and spacing conventions. The scan and GABC do not specify a unique transferable
numeric gap policy for our font and project glyphs.

## Decision boundary

Under the current rules, joining di/ti is correct behavior. Requiring a hyphen
there despite a safe join would be an **engraving/editorial policy decision**,
not a repair to the association or accent code. Concrete general alternatives
for a later reviewed design are:

- Revisit the contextual musical minimum or typography/proportion policy across
  the entire corpus. That changes general engraving output and must be judged
  with all cases, not tuned to auditione or implemented as a threshold exception.
- Introduce an explicit editorial continuation preference at a syllable boundary.
  An authored preference would require domain/command/history/UI design and an
  ADR review; literal hyphens in semantic text would still be inappropriate.
- Retain the present geometry-driven joining and document this acceptable
  stylistic difference from the historical reference.

No alternative above is implemented or presumed accepted. Vowel anchors,
semantic boundaries and global thresholds are left unchanged.

## Giga-review repairs in the same PR iteration

- Selection, placement-context and lyric-move rectangle decorations are clipped
  to the same derived ownership intervals as compact pointer padding. Captions
  remain outside those rectangle clips. This clips painted strokes as well as
  fills, including at responsive scales.
- A first source lyric now checks its combined outgoing reservation. If the
  measured unit fits by using available left room, music and lyric move together
  by only the missing amount. Internal geometry and vowel anchors are preserved.
  If the combined unit cannot fit, isolated oversized progress remains bounded.
- Corpus browser checks require actual DOM marks for each separated continuation,
  with correct source system/outgoing flag and no unexplained extra marks.
  Negative unit cases prove missing, wrong-system, wrong-flag and extra marks
  fail. An empty DOM mark list can no longer pass vacuously.
- One encompassing finally closes the Firefox session and WebSocket on normal,
  corpus and setup-failure paths. A deliberately denied navigation was followed
  immediately by a successful fresh Firefox run to verify session release.
- `HyphenLayout` is a named, required system collection, and the remaining
  stale “hyphens deferred” sentence in the layout guide is removed.

Automated checks and browser evidence are recorded after the final verification
run in the PR. The native pointer driver exercises all seven neume kinds at
both desktop and 320px, Shift-selection of whole compact neumes, clipped
placement/move rectangles, and a first source lyric that fits alone but needs
additional outgoing reservation. No architecture or editorial-policy acceptance
is implied, and no merge is performed.

## Final verification for this iteration

- `npm run format:check`, `npm run lint`, `npm test` (45 files, 834 tests),
  `npm run build`, and `git diff --check` passed.
- Both browsers passed the native all-seven-kind, desktop/320px whole-selection,
  placement/move clipping, and near-edge first-source mark checks. The punctum
  pair uses le/lu so its un-clipped outline genuinely crosses its neighbor;
  [selected ownership screenshot](review/compact-whole-selection.png).
- All 44 corpus/control cases passed with actual rendered-mark assertions in
  Chromium at desktop/default font and 320px/DejaVu Sans, and Firefox at
  320px/default font. A Chromium default-font 320px corpus run also passed.
- Chromium's existing lyric-spacing and vowel-alignment browser drivers passed,
  including actual text geometry, font reload, history, selection/focus,
  scrolling and pointer/caret insertion. These are separate from unit tests.
- Firefox setup deliberately failed with a denied-port navigation; a fresh
  successful session immediately afterward confirmed failure-path cleanup.

Selected evidence is retained; generated JSON/HTML and other screenshots remain
in system temporary storage. Visual and architectural acceptance still belong
to the owner. Foreground Firefox keyboard and spoken screen-reader acceptance
remain outside this verification.

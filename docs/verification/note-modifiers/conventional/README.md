# Conventional rhythmic modifiers — PR #64

Status: Completed (owner-accepted 2026-11-09). The owner accepted the
implementation and engraving results in PR #64. Merge remains an owner action.

Owner-approved implementation of [ADR 0018](../../../adrs/0018-conventional-mora-patterns.md),
which supersedes ADR 0017. The [approved proposal](../../../plans/stage-8a-conventional-rhythm-model.md)
records the chosen profile. Earlier arbitrary-count and editorial-proposal
screenshots are historical, not the current product.

## Implemented behavior

Mora is presence (`mora: 1`), never an arbitrary count. Punctum offers None/Sole
note; Podatus and Clivis None/First note/Second note/Both notes; the four
three-note kinds None/Final note/Final two notes. Pair scope edits affect two
stable note IDs atomically; independent selected-note episema remains available.
Selection/deselection and note switching leave the score position unchanged.
Shared geometry derives paired dots together; pitches, approved silhouettes,
lyric anchors, wrapping and note identities retain their existing contracts.

Native v1 remains supported and compatible v2 loads normally. Incompatible
strict draft-v2 values/patterns require resolution without conversion. Cache
saving stays blocked; **Download original cached source** preserves its exact
captured string. Failed imports retain their original File bytes for download.
These actions are separate from **Export**, which exports the current score.
Existing explicit replacement, conflict and pending-workflow guards remain.
There is no automatic converter or grouping feature.

## Actual comparison evidence

- [Editor versus Gregorio](editor-vs-gregorio.png): actual captured editor SVG
  composed beside independently compiled Gregorio output, with matching
  pitches/affected notes and named test lyrics. No proposed glyphs are inserted.
- [Editor Chromium desktop](editor-chromium.png),
  [Firefox 320px, transposed line/space cases](editor-firefox-320.png).
- [All seven kinds with pairs and episemata](pairs-and-episema-firefox.png).
- [Incompatible-cache recovery in Firefox](recovery-firefox.png).
- [Actual Gregorio sheet](gregorio-comparison.png), [GABC](cases.gabc),
  [TeX wrapper](comparison.tex), [native fixture](editor-cases.chant.json).

Representative cases cover Podatus lower/final singles and adjacent/wide pairs;
Clivis first/final singles and adjacent/wide pairs; Torculus final single and
adjacent/wide pairs; Porrectus final single and adjacent/wide pairs with equal
outer pitches. `c/e/g/i` map to semantic staff positions `0/2/4/6`. The browser
driver also transposes this complete sheet one step and exercises all seven
kinds with independent episemata. Test lyrics such as PodPair are fixture labels,
not an added editorial notation convention.

The [primary-source investigation](../rhythm-model/README.md) links the printed
instructions, pinned Gregorio writer and TeX macros. The implementation follows
qualitative placement rules: a pair uses two affected pitches; an adjacent
lower-line dot goes below, other line dots above. Lower Podatus singles have
the adjacent-ascent exception; Clivis first singles shift towards their upper
head; final Torculus/Climacus line singles go below. A pair reserves one compact
trailing column. TeX's justified glue can separate its two dots horizontally;
our fixed-spacing engraver does not reproduce that justification behavior or
copy font-specific offsets. Different font contours, optical gaps and automatic
system breaks are intentional; this is not a pixel-identical font comparison.

Gregorio 6.0.0 / GregorioTeX 6.0.0 / Greciliae generated the reference. The pinned
source was inspected separately, not asserted to be the binary's exact revision.
No historical scan is reproduced here.

## Reproduction

Run the production build/preview and the note-modifier browser driver as in
[the testing guide](../../../testing.md). Its output directory includes
`rendered-score.json`, captured from the real editor for the comparison fixture.
Then, using an isolated Chromium debugging endpoint:

```sh
node docs/verification/note-modifiers/conventional/render-comparison.mjs /tmp/DRIVER-OUTPUT/rendered-score.json
```

`CHANT_CHROMIUM_URL` can override `http://127.0.0.1:9230/json`. The compositor
captures a separate tab, closes it afterwards, and writes `editor-vs-gregorio.png`.
It checks that the complete comparison fits its viewport.

For the reference, copy GABC/TeX into a temporary directory, run `gregorio -o
cases.gtex cases.gabc`, compile `comparison.tex` twice with LuaLaTeX and
GregorioTeX available, then render/crop the first page with:

```sh
pdftoppm -scale-to 1900 -x 0 -y 0 -W 912 -H 1100 -png -singlefile comparison.pdf gregorio-comparison
```

## Verification and limits

The command/layout/persistence suites cover all allowed/disallowed mora sets,
no-op/invalid identity, atomic history, surviving-note marks, v1/v2 round trips,
strict legacy syntax and original-source recovery. The engraving matrix covers
intervals 1/2/3/5/12 with multiple line/space transpositions and simultaneous
all-note episemata, complete measured ink, unchanged heads/anchors, distinct
allowed dot signatures and pair alignment.

The real production app passed the updated modifier driver in Chromium/CDP and
Firefox/BiDi at 1440px and 320px. Checks include contextual options, all note
switches, selection/deselection stability, separate episemata, paired undo/redo
at both widths, native pitch/focus/Tab, persistence round trips, measured SVG
containment, exact original-source download payloads and blocked cache writes.
The existing local-persistence regression driver also passed in both browsers.
Browser input uses native pointer/keyboard actions; select/file changes use DOM
events. Blob contents are inspected at the download boundary; OS save dialogs,
OS dropdown operation, spoken screen-reader output and foreground zoom are not
claimed. Owner acceptance of the implementation and engraving was recorded on
2026-11-09; it does not imply that these separate foreground checks were run.

Local final gates passed: `npm run format:check`, `npm run lint` (no warnings),
`npm test` (69 files / 1,360 tests), `npm run build`, and `git diff --check`.
The focused native recovery suite also passed after tightening its malformed-ID
assertion (21 tests). No dependencies or additional test environment were added.
Local Node was v24.12.0; the repository declares v24.18.0. Hosted CI uses the
declared version and is a separate post-push result.

The local-persistence driver was run from an unchanged temporary copy with only
its local ports redirected from 9230/4173 to isolated 9236/4175. The modifier
driver used its explicit environment overrides. No personal browser profile or
user document was used. The final paired/single evidence was visually inspected;
the owner subsequently accepted the implementation and engraving on 2026-11-09.
OS/browser foreground checks remain unclaimed, and merge remains pending.

## Documentation closeout

The retained Stage 8A plan and roadmap record completion and owner acceptance
on 2026-11-09. ADR 0018 remains Accepted and ADR 0017 remains Superseded.
The closeout changes documentation only; formatting and diff checks passed.
Implementation tests and browser results above belong to the implementation
verification and were not rerun for this closeout.

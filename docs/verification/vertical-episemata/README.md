# Stage 8C — vertical episemata: completed and owner-accepted

Latest review: [tick-only screen phase alignment, native-size comparisons and print proof](rasterization.md).
The earlier clearance-only comparison below did not resolve optical weight; it is
retained as historical investigation.

**Completed (owner-accepted 2026-11-10).** The owner explicitly accepted the
final engraving, consolidated contextual note-editing UX and
[ADR 0020](../../adrs/0020-vertical-episema-presence-and-derived-placement.md),
including its narrow vertical-tick screen rasterization qualification to ADR 0007.
ADR 0007 remains Accepted; no ADR is superseded. PR #67 remains unmerged for
the owner to merge after CI.

The records below preserve the 2026-11-09 implementation verification and earlier
PR states. Owner visual acceptance is separate from automated evidence and does
not assert that any previously unperformed foreground/manual check was run.
The [final rasterization record](rasterization.md) records 78 files / 1,568 tests
and both-browser comparisons; original counts below describe the initial slice.
Manual orientation overrides, blocked-autosave warning improvements and
extreme-pitch layout issues remain deferred/separate follow-ups.

## Documentation closeout checks (2026-11-10)

This closeout changes Markdown only; implementation, fixtures, screenshots and
numeric reports remain unchanged. Formatting, lint, 78 Vitest files / 1,568 tests,
production build and diff whitespace checks passed again locally. Browser/print
comparisons were not rerun for these documentation edits; their recorded runs
and the owner's explicit final visual acceptance are separate evidence.

The last implementation commit `b0e7d99` passed all four hosted CI jobs
(Format, Lint, Test, Build) in [CI run 165](https://github.com/OceanOSdev/gregorian-chant-editor/actions/runs/42631188274).
The closeout head's hosted status is tracked separately on PR #67; a filtered or
skipped workflow is not a passed run.

## Implementation review history

The [consolidation and rendered weight investigation](consolidation-and-weight.md)
records the current four-field contextual editor, removal of the top duplicate,
and the measured staff-clearance correction. Earlier screenshots/results below
are retained evidence for prior PR states; owner acceptance applies to the final
implementation, not to superseded intermediate designs.

## Traditional notation investigation

Primary sources inspected before selecting the engraving approach:

- [Gregorio rhythmic signs](https://gregorio-project.github.io/gabc/details.html#rhythmic-signs):
  apostrophe authors a note's vertical episema; default side is contextual,
  with explicit `'0`/`'1` below/above overrides. More than one constituent may
  carry a sign. This is a notation reference, not an interchange implementation.
- [Gregorio worked tutorial](https://gregorio-project.github.io/tutorial/tutorial-gabc-01.html):
  note-specific signs and the individual-note “clamor” example.
- [Pater noster (A), Solesmes](https://gregobase.selapa.net/chant.php?id=3326),
  its [GABC source](https://gregobase.selapa.net/download.php?format=gabc&id=3326)
  and [Gregorian Missal (1990), printed p. 41](https://gregobase.selapa.net/sources/16/40.png).
  The printed first staff has a small tick below “ster” while a horizontal
  episema remains above it. The transcription's history includes episema-height
  adjustments. The retained [short scan excerpt](pater-solesmes-excerpt.png)
  is enlarged for inspection, not traced into application ink.

**Pitch mapping correction:** Gregorio's `g` is the middle space, as its tutorial
explicitly explains: editor position 3. GABC `d/f/h/j` map to editor staff lines
0/2/4/6; `h/i` map to 4/5. Earlier Stage 8A comparison captions used a one-step
shift. This sheet corrects the reference inputs; it changes no existing score,
accepted contour, semantic pitch convention or historical evidence file.

Actual Gregorio 6.0.0 / GregorioTeX 6.0.0 / Greciliae output was compiled twice
and visually inspected. The included [GABC](cases.gabc), [generated TeX](cases.gtex)
and [wrapper](comparison.tex) reproduce the [reference image](gregorio-reference.png).
Its generated `GreVEpisema` calls retain affected-note context. Merely accepting
GABC is not treated as proof of a universal traditional convention.

| Specimen                                             | Reference observation and implemented comparison                                                                                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Punctum on line/in space                             | Short separate tick below its own head, clear of staff ink.                                                                                                                                         |
| Horizontal plus vertical; all three signs            | Orthogonal independent strokes; mora stays beside the head. Existing horizontal/mora ink is unchanged.                                                                                              |
| Virga and neutral Inclinatum                         | Tick stays distinct from the queue or diamond. Derived Climacus forms remain unchanged.                                                                                                             |
| Lower/upper/all Podatus; both Clivis members         | Upper stacked notes need above-note fallback when the lower member blocks below. Head/stem context, rather than one whole compound rectangle, controls clearance.                                   |
| Ordinary and quilismatic Scandicus                   | Keep the Accepted ADR 0019 connected quilisma silhouette. Gregorio's separated initial quilisma figure remains a comparison, not a replacement contour. Each authored tick remains distinguishable. |
| Torculus, Climacus and Porrectus                     | Actual compound/ribbon note regions and shafts constrain local ticks; no square heads, extra notes or ownership labels are introduced.                                                              |
| Divisions, clefs, first/last neumes and system edges | Signed/baseline editor fixtures include mixed boundaries and automatic custodes/wrapping; complete sign ink participates in layout.                                                                 |

The evidence supports the proposed presence/derived-placement boundary without
new semantic fields or a significant conflict with an Accepted ADR. It does not
establish pixel-identical Gregorio typography or reproduce every editorial side
choice. Manual Above/Below remains deferred. Project metrics and bounded-search
rules belong in [engraving metrics](../../engraving-metrics.md#vertical-episema-stage-8c).

## Comparative engraving

- [Actual editor, Gregorio and printed Solesmes board](editor-vs-references.png).
- [Signed versus baseline details at the same staff coordinates and 2.5× scale](signed-vs-baseline.png).
- [Owner Pater Noster: printed reference and v3/v4 before/after first system](pater-comparison.png).
- [Chromium signed score](editor-chromium.png), [baseline](baseline-chromium.png),
  [Firefox 320px](editor-firefox-320.png), [dense signs in Firefox](dense-firefox.png)
  and [selected controls at 320px](controls-firefox-320.png).
- [Native v4 comparison specimen](cases-v4.chant.json). The named words are
  test labels, not added notation or editorial ownership codes.

Screenshots are review artifacts, not golden-image tests. The board uses captured
real editor SVG and compiled reference ink. Both sets retain their own ordinary
spacing, line breaks and contours. The baseline removes only vertical flags,
retaining forms, horizontal episemata and morae.

## Actual automated and browser verification

Local final gates passed: `npm run format:check`, `npm run lint`, `npm test`
(**76 files / 1,559 tests**), `npm run build`, and `git diff --check`.
The initial handoff plan and then-Proposed ADR required pre-existing
emphasis-format fixes; the implementation did not change that decision.
ADR 0020 was subsequently accepted on 2026-11-10. No dependency was added.
Local Node was v24.12.0; `.nvmrc` specifies v24.18.0. Hosted CI is separate.

Pure tests cover all seven kinds; authored Virga, Inclinatum and Quilisma;
intervals 1/2/3/5/12; line/space and outside-staff offsets; every supported mora
scope; horizontal signs on/off with all constituents vertically marked; complete
bounds/advance; unchanged prior ink, heads, hit contours and lyric anchors;
stacked-note ownership; shared signed ghost geometry and whole-neume wrapping.
Commands/codec tests cover no-ops, structural sharing, exact history, surviving
IDs after movement/clef/form/deletion, strict v4 and exact legacy readers.

The [targeted production driver](browser-check.mjs) passed in isolated headless
Chromium/CDP and Firefox/BiDi, at 1440px and 320px. It checks:

- contextual On/Off on **every constituent in the comparison matrix**;
  native keyboard SVG selection, native Tab to Vertical episema, stable score
  position, independent signs, no-op, Undo/Redo and pitch movement;
- actual painted-point tick sampling against musical paths, other signs,
  divisions and staff lines, exact authored/tick counts and SVG canvas containment;
- real v1/finalized-v2/owner-v3 hydration without startup writes, synchronous
  v4 changes, export Blob contents, import and immediate refresh;
- adding only one tick to the owner's first horizontally marked note (“ster”),
  preserving the entire remaining document, then recovering on refresh;
- rejected legacy envelopes with the v4 field, malformed v4 imports, incompatible
  draft-v2 cache and simulated external-byte conflicts without replacement.

Retained dense actual-ink measurements: [Chromium](ink-chromium.json),
[Firefox](ink-firefox.json). Existing note-shape, note-modifier, local-persistence
and bundled-example drivers also passed in **both** production browsers.
Their expected current writes were updated to v4; historical native fixtures
were not rewritten.

The established separate actual-build storage investigation also passed in both
browsers: [Chromium report](storage-chromium.json), [Firefox report](storage-firefox.json).
An actual v2 build (`56816a4`) saved a cache, the current v4 build hydrated it
without writes, and the first form edit saved v4. The old build rejected v4
through its recovery UI and preserved the bytes. Two actual app tabs conflicted
in both directions without overwriting; 12 successive immediate-refresh commits
and injected storage failure retained the correct previous successful save.
These form-based stress checks supplement the vertical-specific v4 checks above.

The existing extreme-pitch viewBox issue remains reproducible in v2 and v4;
exact cache pitches/bytes survive and New remains reachable. It was not repaired
or redefined here. The separate blocked-autosave warning follow-up also remains
outside this milestone. localStorage still lacks atomic compare-and-set.

The bundled source is byte-for-byte unchanged, remains version 3, and has SHA-256
`d25b7b79a011e704d34c475d809b1c90c1fb6682f8cb3f922114b620c2aedfbb`.

## Reproduction

Build and serve production preview under `/gregorian-chant-editor/`. Launch only
**disposable profiles**, with Chromium debugging on 9230 and Firefox BiDi on 9231. Never use a personal browser profile: drivers replace test-origin storage.
Run sequentially on each browser's shared tab:

```sh
node docs/verification/vertical-episemata/browser-check.mjs
node docs/verification/note-shapes/browser-check.mjs
node docs/verification/note-modifiers/browser-check.mjs
node docs/verification/local-persistence/browser-check.mjs
node docs/verification/bundled-example/browser-check.mjs
```

Repeat with `CHANT_FIREFOX_URL=ws://127.0.0.1:9231/session` on each command.
`CHANT_CHROMIUM_URL` and `CHANT_PREVIEW_URL` override the CDP discovery endpoint
and preview origin. Drivers emit fresh temporary directories. The targeted
output includes signed/baseline/Pater SVG captures, screenshots and v4 fixture.

Copy GABC/TeX into a temporary directory with GregorioTeX installed, then run:

```sh
gregorio -o cases.gtex cases.gabc
lualatex --interaction=nonstopmode --halt-on-error comparison.tex
lualatex --interaction=nonstopmode --halt-on-error comparison.tex
pdftoppm -scale-to 1800 -png -singlefile comparison.pdf gregorio-reference
convert gregorio-reference.png -trim +repage gregorio-reference-trimmed.png
```

This environment used the already extracted TeX tree via
`TEXMFHOME=/tmp/chant-custos-tex/usr/share/texlive/texmf-dist` and
`TEXMFVAR=/tmp/chant-custos-tex-cache`. Copy the trimmed reference into this
evidence directory to reproduce the board:

```sh
node docs/verification/vertical-episemata/render-comparison.mjs /tmp/OUTPUT/signed-1440.json /tmp/OUTPUT/unsigned-1440.json /tmp/OUTPUT/pater-before.json /tmp/OUTPUT/pater-after.json
```

For actual-build compatibility, reproduce the baseline build/server as described
in [the existing storage investigation](../note-shapes/review-follow-up.md#reproduce-safely).
Run its driver with `CHANT_CURRENT_VERSION=4` plus
`CHANT_CHROMIUM_URL=http://127.0.0.1:9230/json`, or
`CHANT_FIREFOX_URL=ws://127.0.0.1:9231/session`. Use a fresh profile/origin cache
for each run; it intentionally refuses an existing cache. Its read-only server
accepts `?build=v4` for the current build and `?build=v2` for the actual baseline.

## Contextual editing follow-up

The owner approved nearby note marking controls in
[PR #67's review comment](https://github.com/OceanOSdev/gregorian-chant-editor/pull/67#issuecomment-6740210401).
The scope was committed to the plan before implementation. The [follow-up record](contextual-editing.md)
contains its actual lower-score, keyboard, responsive and compatibility results
and screenshots. That historical convenience retained the inspector; the later consolidation
removed it and added Form to the contextual panel, preserving existing commands
and native format. The final UX was owner-accepted on 2026-11-10.

## Owner visual acceptance and remaining manual checks

On 2026-11-10 the owner reported that the final engraving, rasterization and
contextual note-editing UX passed review, explicitly accepted ADR 0020 and
declared Stage 8C owner-accepted. This completes the milestone. The owner will
merge PR #67 after CI; this closeout does not merge it.

Native select/file changes use DOM events; note selection, Tab, pitch arrows and
blank-score clicks use browser input. Export Blob contents are inspected without
an OS save dialog. Foreground keyboard/OS-select behavior, actual browser/OS
zoom, IME and spoken screen-reader output were **not** tested or inferred from
headless checks. Owner acceptance of the final engraving does not establish
exhaustive publication-quality coverage or imply those manual checks were run. Existing palette/ghost
regressions and pure signed-preview parity do not create an authoring tool for
preselecting vertical marks on new notes; selected-note authoring is the scope.

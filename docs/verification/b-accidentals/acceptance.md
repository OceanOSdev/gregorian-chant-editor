# Stage 8D acceptance audit

Audited `bffb5af` and the narrow UI correction described below, for
[PR #72](https://github.com/OceanOSdev/gregorian-chant-editor/pull/72).
All 14 functional acceptance items have meaningful automated coverage and pass.
One concrete UI defect was discovered and corrected; no further application
implementation or architectural changes are necessary for these items.
Subjective visual approval remains the owner's decision. This is real-browser
headless automation, not foreground physical-device or spoken-accessibility testing.

## Coverage and actual results

Sources: [D: accidental domain/command/session tests](../../../src/editor/domain/accidentals.test.ts),
[R: review regressions](../../../src/editor/domain/accidentals-review.test.ts),
[G: measured geometry tests](../../../src/editor/layout/accidental-geometry.test.ts),
[B: existing production browser driver](browser-check.mjs),
[A: focused acceptance/visual driver](acceptance-browser-check.mjs).
Test titles below identify the relevant assertions rather than just naming a suite.

| #   | Acceptance item                                | Automated coverage                                                                                                                                                                                                                                     | Actual result                                                                        |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1   | Author flats/naturals on eligible B            | D “identifies B on every C/F clef line”; B native property authoring/kind changes; A authoring and ordinary signed visual sheet                                                                                                                        | Pass: unit + Chromium/Firefox                                                        |
| 2   | Written, inherited, default pitch indications  | D written-location/provenance and register/reset tests; **new A assertions read the actual property text and None/Flat/Natural field** for all three states                                                                                            | Pass: Chromium/Firefox, including untouched other-register default                   |
| 3   | Natural cancels inherited flat within scope    | D “keeps redundant signs and natural cancels only its register”, word/all-four-division resets; **A verifies inherited flat → written natural → following inherited natural in actual controls**                                                       | Pass: unit + Chromium/Firefox                                                        |
| 4   | Repeated B shares canonical sign               | D “torculus/porrectus shares canonical owner and deletion respects original owner”; B edits either constituent; A counts one glyph per repeated-B group                                                                                                | Pass: unit + Chromium/Firefox                                                        |
| 5   | Independent glyph select/edit/delete           | B glyph Enter/Tab, native kind change and Delete, stable ID and surviving notes; R selected/focused deletion                                                                                                                                           | Pass: unit + Chromium/Firefox                                                        |
| 6   | Earlier-note placement by pointer and keyboard | B actual pointer to F; D/R eligible-target validation; **A Tab/Space opens placement in Chromium, Arrow/Enter chooses a different anchor and commits; Firefox native Tab/Arrow/Enter verifies navigation/commit with the HTML-start limitation below** | Pass, with explicit Firefox transport qualification                                  |
| 7   | Cancel/current anchor leaves history unchanged | D “retargeting the current anchor is a history no-op, and Cancel preserves a redo branch”; R announcement/no-op/invalid/cancel tests; B Escape, same-anchor, exact cache and Undo/Redo; A Beata cancellation                                           | Pass: unit + Chromium/Firefox                                                        |
| 8   | Anchor deletion/invalidation restores default  | D “deleting the anchor restores default” and “repairs resets atomically”; B anchor Delete, inserted division and lyric word boundary, exact undo                                                                                                       | Pass: unit + Chromium/Firefox                                                        |
| 9   | Owner deletion removes sign                    | D repeated-B original-owner loss and surviving matching-B regression; **A deletes owner while later Bs and the other natural survive, then undoes exactly**                                                                                            | Pass: unit + Chromium/Firefox                                                        |
| 10  | Atomic history, refresh, v5 export/import      | D strict v5 round trips and one-entry reset repair; B exact Undo/Redo/refresh and actual Blob export/file-input import; A one-step keyboard-placement history                                                                                          | Pass: unit + Chromium/Firefox                                                        |
| 11  | Clef policies and destructive confirm/Cancel   | D counted loss/cancel/confirm; R actual clef transaction between anchor and owner, chromatic preservation and seven-degree repair; B two-sign loss warning, Cancel, confirm and Keep pitches                                                           | Pass: unit + Chromium/Firefox                                                        |
| 12  | Ink, lyrics, hyphens, wrapping, canvas         | G all-kind/sign matrix, own/prior/later lyric clearance, high default/anchored signs, oversized progress and current-group hyphen regressions; B actual overlap/bounds checks, 320px, cross-system placement and PDF                                   | Pass: full unit suite + Chromium/Firefox; existing 47-case word corpus reused        |
| 13  | Historical specimens                           | D dedicated reference fixture strict round trips; G Beata F/written-clef geometry; B loads/captures Laetatus, Ecce, Benedicta, Beata natural/omnis; A inspects current live Beata; retained printed/Gregorio board                                     | Pass: automated representation; visual comparison below, not facsimile certification |
| 14  | Keyboard focus after delete/placement          | R selected/merely-focused glyph deletion; B actual activeElement after both glyph deletions and Escape; **A verifies focus after a newly committed keyboard placement and cancellation**                                                               | Pass: unit + Chromium/Firefox after UI correction                                    |

Reuse: the established `bffb5af` full gate passed **82 files / 1,699 tests**, and
[CI run 187](https://github.com/OceanOSdev/gregorian-chant-editor/actions/runs/43149960417)
passed Format/Lint/Test/Build. Its Chromium/Firefox Stage 8D and 47-case word
corpus results remain in the [review record](review-revisions.md). The domain,
geometry and persistence implementation was not changed in this audit. The full
local gate was repeated only because the concrete UI defect required a code fix;
its result remains **82 files / 1,699 tests**. No broad historical/browser battery
was repeated just to duplicate those results. After the UI correction, only the
affected B driver was repeated in Chromium/Firefox, both passing at the same
`index-VQtrrR16.js` bundle (outputs `/tmp/chant-b-accidentals-7RE9Yk` and
`/tmp/chant-b-accidentals-igfN7L`). Its ordinary import/export and v1 upgrade cases
ran; the optional actual-v4-build branch was not repeated. Prior actual v2/v4
cross-build recovery evidence is reused because persistence was not changed.

## Gaps closed and defect found

The prior driver did not explicitly assert rendered effective-pitch provenance
or commit a _new_ placement with keyboard input. The focused A driver fills those
gaps, adds an owner-deletion browser check, and captures current application UI.

Its initial regression failed in both browsers: after starting placement, focus
was on **Save draft**, and an unrelated “Resolve lyric draft before history”
dialog was displayed. `ChantEditor` passed placement-active as `pendingHistory`
to `SyllableControls`. The minimal fix passes only the real history state to
that prop and separately makes lyric controls inert while targeting. No domain,
command, history, geometry, v5 or recovery architecture changed. A now asserts
no false dialog, correct target focus and keyboard commit; it also deliberately
creates a genuine dirty-lyric history request, verifying that its Save draft
prompt, focus and Cancel/cache protection still work.

Actual focused outputs: [Chromium result](acceptance/chromium-result.json) and
[Firefox result](acceptance/firefox-result.json), production `index-VQtrrR16.js`,
Chromium 157 and Firefox 146, 1440×1000 CSS pixels. These records identify the
checks and transport qualification. Reproduce with the production preview and:

```sh
node docs/verification/b-accidentals/acceptance-browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9231/session node docs/verification/b-accidentals/acceptance-browser-check.mjs
```

Use disposable profiles; `CHANT_PREVIEW_URL` and `CHANT_CHROMIUM_URL` can override
local endpoints. Setup uses fixture hydration and some DOM control activation;
key navigation/commit uses browser input protocols. In this Firefox/BiDi setup,
default HTML Enter/Space activation also failed on a plain non-React button in a
bounded control probe. Therefore the driver uses DOM activation for the standard
placement-start button there, while asserting native Tab and SVG Arrow/Enter
navigation/commit. Chromium verifies native Tab/Space button activation as well.
This does not establish physical-device HTML-key activation or spoken output.

## Visual acceptance: three primary images

These are screenshots of the actual production application, not drawn mockups.
Both engines were exercised; the retained Chromium images were inspected along
with the Firefox rendering. The synthetic sheet is a supported demonstration,
not a historical transcription.

1. [Normal-width signed chant](acceptance/signed-chant.png): the first two
   puncta show default flat/natural; the next Torculus and Porrectus each have
   one sign for their repeated B. Lyrics and two noninitial-B compounds share
   the same measured layout. [Note-property detail](acceptance/note-properties.png)
   shows the written/effective indication and native contextual fields.
2. [Beata gens with selected accidental toolbar](acceptance/beata-toolbar.png):
   the flat is above the earlier F diamond; G–A intervenes before its later B
   owner. The selection rectangle and properties belong to the sign alone.
3. [Earlier-note targeting](acceptance/beata-targeting.png): eligible note
   outlines, native target list and guarded controls are visible. No false
   lyric-history prompt is present after the correction.

Compare these with the retained [scale-normalized printed/editor/Gregorio board](review-editor-vs-printed.png)
and [actual Gregorio matrix](gregorio-matrix-1.png). The sign aspect/scale and
B alignment agree with the adopted reference profile: flat 12×28, natural 8×39
canonical units versus Greciliae's approximately 12.34×28.11 and 8.23×38.67 at the
same staff step. One sign precedes each complete repeated-B neume; Beata's earlier
F placement is preserved. Current live screenshots use the same geometry; no
new font or contour compilation was needed. Current Chromium historical boxes
match the retained metrics exactly. Firefox's Domini natural is at x=205.552
versus Chromium's 206.010 (under 0.5 canonical unit); y=44 and its 8×39 shape
are identical. This small horizontal difference is consistent with the browsers'
text measurements; it is not treated as pixel-identical cross-browser output.

Visual uncertainty is limited rather than hidden: these are original project
contours and simplified neume silhouettes, with different stem/curve shapes and
spacing from the printed editions, not exact facsimiles. The synthetic sheet's
Porrectus natural demonstrates approved vocabulary; the verified Ecce specimen
uses a flat in the comparison board. Compact continuations can look dense, and
the targeting panel's native option labels are visually tight; their full text
remains in the DOM. The owner should judge contour weight, compact spacing and
panel legibility from these few images, without repeating functional tests.

## Remaining defects and genuinely human-only decisions

The newly found focus-stealing prompt is fixed and regression-tested. No other
Stage 8D acceptance defect remains in the audited cases, and no further
implementation changes are necessary. Existing documented limits remain: the
synthetic C3 low-notehead/own-lyric overlap and extreme-position viewport behavior
in [the review record](review-revisions.md) were not reclassified as supported
engraving or silently fixed by this audit.

The remaining human decisions/checks are:

- Subjective engraving/UI approval of the three images and reference comparison.
- Actual spoken screen-reader output and physical keyboard/IME/touch/pinch behavior
  where required; the Firefox HTML-activation transport qualification is explicit.
- Native OS print-dialog and physical printer results where required. Prior browser
  PDFs establish narrower vector/visibility evidence only.

No merge or reviewer-thread resolution is part of this audit.

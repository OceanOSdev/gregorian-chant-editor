# One-shot editor probe verification

Date: 2026-11-02. Branch: `one-shot-test`.

## Automated verification

The full suite passes: **46 test files, 703 tests**, including the original 666
regressions. Production TypeScript/Vite compilation, formatting and Oxlint checks
also pass. No runtime or development dependencies were added; the package manifest
and lockfile are unchanged. The runtime initially supplied Node 24.19.0; the final
suite and production build were also run using the repository's declared Node
24.18.0. Chromium is 154.0.8037.57 on Debian 13.

## Actual browser checks

`browser-check.mjs` exercises the actual editor with DevTools Protocol, not a mock
React tree. Both development and built-production preview runs passed these scenarios:

- pointer selection, native pitch keys, independent left/right focus browsing;
- atomic undo/redo and metadata changes;
- semantic browser recovery after reload;
- JSON download/open, explicit replacement cancellation/acceptance and invalid
  file rejection without altering the current score;
- clean SVG and supported-subset GABC downloads;
- new blank score and graphical placement of all seven neume types;
- continuous lyric entry, dirty draft protection and cancellation;
- a 180-neume score with actual SVG text bounds checked for overlap;
- narrow 320px containment and zoom controls;
- passive print systems and an actual five-page A4 PDF;
- Ctrl+S with a still-focused title draft;
- unreadable recovery preserved byte-for-byte, downloaded and explicitly resumed;
- a compact import whose formatted JSON exceeds 2 MB rejected before replacement;
- an actual second-tab storage write pausing the first tab's autosave;
- injected storage quota failure with working file-download fallback;
- dirty title and unserializable document unload protection;
- disabled metadata controls during draft-history resolution and anchor movement.

Unload guards are verified through cancelable browser events. Whether a native
close/reload confirmation appears still depends on browser activation rules.
Storage-failure injection exercises the real adapter's error handling, not an
actual full disk. Downloads verify the files Chromium wrote, not a human's final
choice of save destination.

Browser artifacts are generated in system temporary directories and are not
committed. The final production run wrote diagnostics to
`/tmp/chant-one-shot-ONihl0` in this execution workspace. The driver prints its exact artifact directory on success.

## Independent review and limits

An independent implementation review identified title-draft unload protection,
serialization-failure dirty state, metadata edits while the reducer blocks them,
and a GABC title delimiter round-trip bug. Those findings were fixed; follow-up
review found no further serious layout/reducer defect.

Firefox, Safari, spoken screen-reader behavior and physical touchscreen gestures
were not tested. Chromium's generated PDF is not a tagged-accessibility claim.
SVG exports retain text with local font-family references; font substitution on
another machine can change text metrics. The experimental spacing policy remains
simple minimum-clearance engraving, not full chant justification.

Oversized content expands the whole viewBox, which can reduce fit/print scale.
A long syllable can move its neume beyond the normal staff insertion region;
selection and toolbar insertion remain available, while graphical insertion stays
within the normal staff. The supported musical vocabulary is deliberately limited;
see the [file/interchange contract](../../persistence-and-interchange.md).

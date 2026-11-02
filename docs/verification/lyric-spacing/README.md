# Stage 4B implementation verification

Stage 4B is implemented for owner review under Proposed ADR 0010. ADR 0005
remains Accepted. This record reports checks of this implementation, not final
Stage 4D cross-browser or editorial acceptance.

Run Vite and Chromium with debugging port 9230, then:

```bash
node docs/verification/lyric-spacing/browser-check.mjs
node docs/verification/vowel-alignment/browser-check.mjs
```

The standalone driver mounts the actual StrictMode editor using the existing
development fixture. It uses native DevTools mouse, key and wheel input; SVG
measurements and pure resolver expectations supplement those actual interactions.
`CHANT_BASELINE=1` captures the initial comparison and exits; run it against the
pre-4B checkout to reproduce the before image. Screenshots are generated in a
printed system temporary directory and are deliberately not committed.

## Observed results

Chromium headless at 1440px and 320px passed:

- Measured same-system clearance and multi-system wrapping for Kyrie eleison,
  adjacent words and long syllables; all seven supported neume silhouettes.
- Native text replacement, reflow, undo/redo; native word-boundary changes and
  undo/redo; selection independent of Tab browsing.
- Actual pointer ghost and insertion at the displayed global boundary on a
  later system, atomic undo/redo, surface focus and selected-note focus/reveal.
- Provisional font-measurement invalidation and recovery retain the focused
  syllable when it moves between system groups. Loading events are dispatched
  explicitly for this test; the separate font test loads a real local DejaVu Sans
  face and applies it to both visible and measurement SVG text.
- Left, right and two-sided oversized overhangs use a derived canvas, preserve
  font size, isolate the oversized item and retain normal wrapping afterward.
  Native arrow-key scrolling and horizontal wheel scrolling reach the content;
  the 320px page has no horizontal overflow. Scrolled pointer placement and
  focus/reveal remain usable on the next system, including negative origins.
- Existing Stage 4A browser regressions: language, native manual grapheme ranges,
  reset, undo/redo, dirty-draft preservation, text-change reset, combining marks,
  focus versus selection and responsive multi-system layout.

The before capture shows collisions around `son`, `longissimum`, `verbum` and
`misericordiam`. After spacing, the first long word has clearance, subsequent
words wrap to system two, and later music wraps normally. No conditional or
system-break hyphens are generated, so separated same-word syllables remain a
Stage 4C limitation. The 5-unit word minimum is deterministic across fonts;
platform typography still changes the measured advances.

Firefox, spoken screen-reader output and final auditione editorial appearance
were not verified. Local automated/browser runs used Node 24.12.0; `.nvmrc`
requests 24.18.0, which is not installed in this environment. Hosted CI is a
separate verification and must not be inferred from these local results.

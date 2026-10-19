# Simplified neume entry verification

PR #35 revised interaction model; 2026-10-18. The toolbar is one persistent
neume palette, with one contextual Insert command and compact syllable/lyric
controls. No repetition preference, Finish control, context panel, or sticky
strip remains.

## Implementation decisions

- Retained the pure session reducer, serialized current-document resolution,
  caller-allocated stable IDs, atomic semantic history, shared insertion commands,
  preview geometry, and postcommit focus requests. No semantic model, insertion
  anchor, engraving, whole-neume wrapping, or dependency changes.
- Replaced repetition state with a transient remembered kind, initially Punctum.
  Only neume activation changes it. Contextual insertion resolves that kind from
  the reducer's latest state, returns to Select, and focuses the new first note.
- Palette focus is local UI state: one roving Tab stop. Arrows and T move focus
  without activation. Enter/Space remain native. I inserts from notation controls;
  native editing, composition, modified keys and repeated keydown are excluded.
- Removed one-shot placement branches, Finish-specific focus identity, the large
  panel and its layout-context helper, and sticky-strip scroll calculations.
  Select remains an ordinary palette button. Escape/Select restores a surviving
  enabled note, otherwise the visible Select palette button and its Tab stop.
- Retained scroll-prevented SVG-root focus after placement, a local decorative
  focus cue, concise placement naming, nearest clipped-destination reveal, and
  one event-keyed polite status region. Hover and focus browsing stay silent.
  Focus requests are consumed in layout effects after refs and geometry commit.

## Browser verification

[Recorded results](browser-results.json) exercise the real editor in React
StrictMode in Linux headless Chromium 150.0.7871.128, scale factor 1. The script
uses trusted DevTools pointer/key events except where explicitly testing batched
React events or synthetic composition/modifier guards.

| Check                 | Verified behavior                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard-only entry   | Visible Insert into empty notation → pitch arrow → I → T/Right/Enter → I inserts Podatus → Shift+Tab selects/edits an earlier note → native syllable selector → Insert into the new syllable                      |
| Palette               | Exactly one Tab stop; arrows/Home/End browse without activation/memory changes; native Enter and Space activate; T restores remembered focus                                                                      |
| Seven kinds           | Repeated graphical placement, disabled-note guards, Escape restoration, contextual Insert exits to an enabled first note                                                                                          |
| Rapid clicks/history  | 12 trusted clicks without pointer movement plus 30 dispatched in one JS turn retain all edits; individual Undo/Redo restores exact IDs; identical success messages produce distinct mutations                     |
| Preview               | Hover is silent; switching clears preview; invalid points/CTM do nothing; committed ink exactly matches preview after late-system reflow                                                                          |
| Native editing/guards | I/T ignored in lyric, textarea, contenteditable, native select, unrelated controls and composing/modified/repeated events; native lyric Undo/Redo and Escape rollback preserved                                   |
| Target/fallback       | Changing syllables preserves tool; adding focuses lyric; removing the only target restores Select focus and a single combined status message                                                                      |
| Long score            | 37 systems, placement at system 24: exact window offset preserved at 1440, 390, 320 px; Escape restores visible enabled note; pitch edits/history and contextual insertion retain appropriate focus across reflow |
| Nested scrolling      | Visible late-system placement preserves both container and window offsets                                                                                                                                         |
| Accessibility         | Focused placement group has short name/description, no entire-score summary, no programmatic disabled-note focus; one polite atomic live region                                                                   |
| Responsive/Tab order  | No page overflow at 1440, 390, 320 px; native Tab visits Insert, syllable, Add syllable, lyric, enabled history, help; focused controls remain visible                                                            |

Browser scrolling rounds CSS-pixel offsets: visibility assertions allow half a
pixel at the requested 8 px margin. Document shrinkage can still trigger native
scroll-range clamping. Ordinary Tab from the SVG surface can leave page content;
there is no focus trap. T intentionally reveals the palette at the page top.

## Screenshots

- [Desktop palette and placement](placement-1440.png)
- [390 px palette and placement](placement-390.png)
- [320 px palette and placement](placement-320.png)
- [Desktop late-system editing](late-system-1440.png)
- [390 px late-system editing](late-system-390.png)
- [320 px late-system editing](late-system-320.png)

## Reproduce

No browser automation dependency is added. Use a Chromium binary with remote
DevTools enabled and a recent Node with built-in fetch/WebSocket:

```bash
npm run dev -- --host 127.0.0.1
chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=9250 --user-data-dir=/tmp/chant-placement-verification about:blank
CHANT_EDITOR_URL=http://127.0.0.1:5173 node docs/verification/placement/browser-check.mjs
```

Use flags appropriate to the environment. `CHANT_CHROME_URL` overrides the
DevTools endpoint (default `http://127.0.0.1:9250`). The script runs from the repo
root, writes results/screenshots here and opens the development-only
[browser fixture](browser-fixture.html), which mounts production components with
explicit documents. It adds no debug API to the application.

## Automated checks and limits

Session tests cover all seven kinds, persistent lifecycle, remembered-kind
invariants, contextual insertion contours and unchanged note-only anchors,
preview parity after wrapping, stable history identity, target removal,
deterministic replay and fresh resolution after layout changes. Palette tests
cover focus navigation and shortcut guards. Visibility tests cover minimum
scroll calculations. Existing domain/command/engraving suites are unchanged.

Chromium accessibility-tree and live-region mutation checks do not establish
spoken screen-reader output. Screen-reader speech, Safari/Firefox, physical
touch and real IME integration remain unverified. Composition guards are tested
with synthetic events; rapid polite announcements may be coalesced by assistive
technology. The existing score scales down on narrow screens; zoom is deferred.

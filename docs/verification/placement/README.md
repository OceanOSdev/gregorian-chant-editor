# Simplified entry and caret/ghost placement verification

PR #35; 2026-10-19. The persistent palette, contextual Insert command, I/T and
roving keyboard navigation are unchanged. Moving the pointer now communicates
insertion intent without rearranging the score. Actual reflow happens on click.

## Preview decisions

- One preview path: a caret for the resolved semantic boundary and a translucent
  blue ghost for the actual neume shape/pitch on the hovered committed staff.
- The caret uses painted gap midpoints, half-gap offsets at system ends and the
  normal first anchor on an empty system. A boundary shared by systems stays on
  the hovered system when possible. Active-syllable clamping is authoritative;
  a remote caret gets a compact “Insertion: system N” label at the hovered staff.
- The ghost follows pointer x with horizontal bounds clamped inside the staff.
  Its pitch uses the same snapping and contours as insertion. Crowded ghosts may
  overlap ink; their pale outline is presentation only. Final engraved x/system
  position is intentionally not predicted.
- Removed prospective scene/system/lyric assembly, speculative score height,
  committed-ink hiding, and full-scene parity tests. Committed layout and shared
  engraving builders remain unchanged. No parallel legacy preview renderer.
- Preview output is ID-free; SVG cues are aria-hidden, pointer-inert and
  unfocusable. No hover announcements, focus requests, document edits, history,
  reserved staff space or viewBox changes. Existing committed controls stay
  mounted and visible.
- Commit re-resolves current document/layout/point, allocates stable IDs once,
  adds one history entry and retains the tool. Existing layout-effect focus
  uses preventScroll, then minimally reveals the actual committed destination.
  No semantic, insertion-order, contour, wrapping, keyboard or dependency change.
  ADR 0007's shared geometry boundary is preserved; no new ADR is needed.

## Real-browser results

[Recorded results](browser-results.json) use the actual StrictMode React editor
in headless Linux Chromium 150.0.7871.128. Trusted pointer/key events exercise
DOM behavior, with synthetic events explicitly used for batching and guard tests.

| Check                    | Result                                                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nearly full first system | Punctum and Torculus swept right → left across boundaries → right at 1440, 390, 320 px; committed ink, lyrics, staff count, bounding rectangles, viewBox, height and scroll offset stayed identical |
| Wrapping commit          | Only the click created the second system; inserted note visible, root focused without disabled-note focus, tool active, one-step Undo/Redo restored exact IDs                                       |
| Middle insertion         | Existing neumes and the later syllable's lyric moved to the next system only after commit                                                                                                           |
| Seven kinds              | Ghost painted width/height and pitch placement matched the corresponding committed ink on the same staff; persistent placement and contextual insertion still passed                                |
| Remote syllable boundary | Pointer/ghost on system 3, caret correctly on system 1 at insertion index 5; target label accurate; click committed index 5                                                                         |
| Preview DOM              | No accessible controls/semantic IDs in overlay; pointer hit testing bypassed it; hover/cancellation added no history                                                                                |
| Rapid input              | 12 trusted same-position clicks plus 30 in one JS turn retained every edit; atomic Undo/Redo restored exact IDs; repeated success strings produced distinct status mutations                        |
| Long score               | Visible placement at system 24 of 37 preserved exact scroll offsets at all widths; Escape and contextual entry restored enabled-note focus                                                          |
| Offscreen wrapping       | A local ghost near the viewport bottom stayed on the hit staff; click placed the neume on system 25 and minimally revealed its actual destination (scroll 6440 → 6743)                              |
| Nested scrolling         | Visible late-system insertion preserved both window and container offsets                                                                                                                           |
| Keyboard/accessibility   | Native I/T workflow, roving Tab order, note pitch editing, text/select/contenteditable/composition/modifier guards, concise root accessible name and polite status mutations passed                 |
| Responsive               | No horizontal page overflow at 1440, 390, 320 px; focused controls remained visible                                                                                                                 |

Visibility assertions allow half a CSS pixel for browser scroll rounding at the
8 px reveal margin. Hover never auto-scrolls to a caret on another system.
Document shrinkage can trigger native scroll-range clamping. T intentionally
reveals the palette; ordinary Tab can leave score content without a focus trap.

## Screenshots and reproducible pointer sequence

| Width | Punctum                                                                              | Torculus                                                                               |
| ----- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 1440  | [Hover](intent-punctum-1440-before.png) / [Committed](intent-punctum-1440-after.png) | [Hover](intent-torculus-1440-before.png) / [Committed](intent-torculus-1440-after.png) |
| 390   | [Hover](intent-punctum-390-before.png) / [Committed](intent-punctum-390-after.png)   | [Hover](intent-torculus-390-before.png) / [Committed](intent-torculus-390-after.png)   |
| 320   | [Hover](intent-punctum-320-before.png) / [Committed](intent-punctum-320-after.png)   | [Hover](intent-torculus-320-before.png) / [Committed](intent-torculus-320-after.png)   |

The browser fixture starts with ten Puncta on one nearly full system. With
Punctum selected, move at SVG y=100 through x values
`655,610,550,450,411,409,360,280,230,64,230,409,411,550,610,655`, then click.
The script converts coordinates through the current SVG screen transform.
Repeat with Torculus, then at 390 and 320 px. Reset the fixture per case.
This is a reproducible real-pointer sequence rather than a recording.

Existing [desktop](placement-1440.png), [390 px](placement-390.png) and
[320 px](placement-320.png) palette screenshots and late-system screenshots
remain available. Earlier prospective-scene images were removed to avoid
presenting superseded behavior as current.

## Reproduce the automated browser checks

No browser automation dependency is added. Use a recent Node with built-in
fetch/WebSocket and a Chromium DevTools endpoint:

```bash
npm run dev -- --host 127.0.0.1
chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=9250 --user-data-dir=/tmp/chant-placement-verification about:blank
CHANT_EDITOR_URL=http://127.0.0.1:5173 node docs/verification/placement/browser-check.mjs
```

Use browser flags appropriate to the environment. `CHANT_CHROME_URL` overrides
the endpoint (default `http://127.0.0.1:9250`). Run from the repo root. Results
and screenshots are written here. The [development fixture](browser-fixture.html)
mounts production components with explicit documents and no production debug API.

## Tests and limits

`graphical-placement-preview.test.ts` covers seven-kind local contours across
low/high line/space pitches, caret boundaries, crowded ends, remote syllable
constraints, empty/shared system boundaries, ID-free output, stable layout and
on-click reflow. Geometry matrices retain approved specimen, wide-interval,
measurement and committed-layout checks without claiming complete prospective
parity. Session/history, palette navigation and focus visibility tests remain.

Screen-reader speech, Firefox/Safari, physical touch and actual IME integration
remain unverified. Composition guards use synthetic events; polite rapid
announcements may be coalesced by assistive technology. On narrow screens,
existing score scaling remains small; zoom is outside scope. Crowded ghost
opacity/overlap and a remote caret beyond the viewport remain reviewable visual
tradeoffs of the approved interaction.

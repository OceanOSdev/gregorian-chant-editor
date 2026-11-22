# CSS zoom contextual toolbars (issue #112)

The [interaction guide](../../editor-interactions.md#sticky-editing-tools) owns
the placement contract. Issue #112 found that the note and accidental
properties panels were scaled twice under CSS `zoom`. They were placed from
client-pixel measurements but written to inline CSS pixels, so the root
`zoom` scaled them again. At 150% zoom in a 480×1100 viewport, the note panel
opened about 290px below its note and past the viewport's bottom and right
edges. Close then received no pointer events. The `lyric-spacing` (Chromium)
and `lyric-spacing-selection-cue` (Firefox) drivers failed when dismissing it.
`7062268` exposed the defect when the sticky toolbar's bottom became the
panel's upper limit, which moved the panel below the note.

## Driver

`browser-check.mjs` (runner ID `css-zoom-toolbars`, dev fixture, Chromium CDP
and Firefox BiDi) mounts 16 puncta under a C clef on line 4, with a flat
owned by the B at index 8. It runs four viewport modes:

| Mode            | Viewport  | Device pixel ratio | CSS `zoom` |
| --------------- | --------- | ------------------ | ---------- |
| `desktop-1440`  | 1440×1100 | 1                  | 1          |
| `narrow-320`    | 320×1100  | 1                  | 1          |
| `css-zoom-150`  | 480×1100  | 1                  | 1.5        |
| `page-zoom-150` | 320×733   | 1.5                | 1          |

`page-zoom-150` is what 150% browser zoom gives a 480×1100 window: fewer CSS
pixels and denser device pixels, with no CSS `zoom`.

In each mode it opens each panel (note `note6`, accidental `flat`) with a
native click, with the target at 50% and at 85% of the viewport height. Then
it asserts:

1. The panel's `currentCSSZoom` is the CSS `zoom` (1 under page zoom). This
   keeps CSS zoom and real browser zoom distinct.
2. The inline left and top, times that zoom, equal the rendered client
   position (±0.5px), so the position is scaled once.
3. The panel stays inside the visual viewport, does not cover the sticky
   toolbar's visible bottom, and does not overlap its target.
4. `document.elementFromPoint()` at Close's centre is Close. A panel shorter
   than its content (the short-viewport policy, for example 320px with a low
   note) is first scrolled internally to Close; the page must not scroll.
5. Each dismissal route closes the panel and returns focus to the note or
   accidental glyph:
   - **pointer:** a native move, press and release at Close's centre;
   - **escape:** native Tab from the selected target into the panel, then
     Escape;
   - **keyboard** (Chromium only): Close is focused, then a native Enter.

That is 48 cases in Chromium and 32 in Firefox. Screenshots of each mode's
centred pointer case go to a fresh temporary directory.

### Known baseline behavior: headless Firefox Enter on a button

In headless Firefox, `document.hasFocus()` is false. A native BiDi Enter on
a script-focused Close delivers `keydown`, `keypress` and `keyup` (`code`
`Enter`, WebDriver `\uE006`) but no `click`. This is identical on the
unmodified base `d1439ed`; `\uE007` (NumpadEnter) also produced no `click`. It
is a headless automation limitation, not a placement change, so Firefox skips
only the keyboard route.
Escape, which the panel handles on `keydown`, and native pointer Close are
still checked.

## Verification (2026-11-22, Chromium 157, headless Firefox)

- On the unmodified base `d1439ed`, this driver failed in both browsers at
  the first CSS-zoom case (`css-zoom-150 note at 0.5 by pointer: panel leaves
the viewport`). The note panel was rendered from y≈857 to y≈1190 in a
  1100px viewport. The accidental panel failed the same way when run alone.
  The `lyric-spacing` and `lyric-spacing-selection-cue` drivers failed as
  recorded in issue #112.
- With the fix (`1ffffbc`), the following passed in three consecutive runner
  invocations: `lyric-spacing` (Chromium), `lyric-spacing-selection-cue`
  (Firefox) and this driver (Chromium, 48 cases; Firefox, 32 cases). None of
  the original drivers changed.
- `npm run verify:browser -- --preset full --browser both` at clean `1ffffbc`
  reported 54 passed, 2 failed and 6 unsupported. The two failures are
  `word-composition` in Chromium and Firefox (`punctum selected whole-neume
cue must be clipped`). They fail identically on the base `d1439ed`, which
  makes them pre-existing and unrelated to toolbar placement.

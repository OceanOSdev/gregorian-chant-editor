# Editor toolbar verification (readability M1)

The [interaction guide](../../editor-interactions.md#palette-and-action-bar-ownership)
owns the behavior; the [M1 plan](../../plans/editor-readability-m1.md) owns
scope. M1 is a behavior-preserving ownership refactor; this driver checks the
palette and action-bar contracts that no earlier driver covered.

## Driver

`browser-check.mjs` (runner id `editor-toolbar`, production preview, Chromium
CDP and Firefox BiDi, clears test-origin storage) checks:

1. One roving palette stop; Arrow/Home/End browsing and wrapping move focus
   without arming a tool.
2. The Division menu reopens at the remembered kind after a variant choice.
3. **New**, **Import** and **recovery reload** each reset the roving stop to
   Select and the remembered Division kind to Minima. Arrow browsing still
   works afterwards (live button refs). Reload is reached as in
   `local-persistence`: a foreign autosave is written, a window `focus` makes
   the editor detect it, and **Load cached score** is confirmed.
4. `T` from a focused note focuses the remembered tool (Punctum, then
   `podatus-menu` after arming Epiphonus) without changing selection, and the
   handled palette request is **cleared from the session**. A following Arrow
   key is not undone by a refocus.
5. The Quilisma figure select arms the Quilisma tool and keeps the figure.
6. Action bar: empty-clipboard Copy/Paste state, passage-range
   `aria-describedby` on Lyrics/Insert, and Copy, Paste, Undo and Redo
   buttons changing the score.
7. Sticky toolbar `data-too-tall` matches its measured height against half the
   viewport at 1440×1100, 320×1100, 320×500 and 150% CSS zoom; at 320×500 the
   computed position is `static`.

### How request clearance is observed

There is no DOM test environment, so step 4 reads the `focusRequest` prop
that `NotationPalette` last committed. It gets this from the React fiber that
React attaches to the `.neume-palette` element (`__reactFiber$…`, present in
production builds), switching to the current-tree twin when the DOM node still
references the alternate. This is test-only introspection of React internals;
no production hook was added. It shows that the request was cleared. It cannot
distinguish one acknowledgement from two. A second, stale acknowledgement is a
reducer no-op by identity, which `editor-session.test.ts` covers.

### Mutation checks (Chromium, 2026-11-17)

Each mutation was applied to the source temporarily and then reverted:

- Removing the palette `reset()` call failed with “New: roving stop returns to
  Select”.
- Removing `onFocusRequestHandled(focusRequest)` failed with “handled palette
  focus request is acknowledged (cleared)”.
- Removing only the reload path's `resetPresentationState()` failed with
  “Reload: roving stop returns to Select”.

## Results (2026-11-17)

Linux, Node 24.12.0, Chromium 157.0.8103.38, Firefox 146.0.

- Current driver on the review follow-up tree: Chromium and Firefox both
  passed (`run-2026-11-17T06-58-01-206Z-uJuDds`).
- The first version of the driver, which had no reload case, no fiber check
  and no `static` assertion, also passed unchanged on the clean base
  `917137c` (`run-2026-11-17T06-09-48-829Z-kFzZXx`). Its sticky measurements
  matched the branch (Chromium 238/468/468/354 px; Firefox 246/476/476/357
  px). The current driver's clearance check looks for the `NotationPalette`
  fiber, so it is branch-specific and was not run on the base.

## Not verified here

- Foreground focus rings, real browser zoom (as opposed to CSS zoom), IME and
  screen-reader output: headless runs cannot check these.
- Reload through a genuine second tab: `local-persistence` covers that
  conflict path; this driver uses the in-page focus check.

The full-matrix comparison is recorded in the M1 pull request.

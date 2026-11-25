# Editor toolbar verification (readability M1)

> **Retired in Playwright M2.5.** `browser-check.mjs` was deleted after the owner
> accepted its [crosswalk](#playwright-migration-m25). Commands and results
> below are historical; recover the script with
> `git show 7cb61ba:docs/verification/editor-toolbar/browser-check.mjs`.

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
- Reload through a genuine second tab: `tests/e2e/local-persistence.spec.ts`
  covers that conflict path (the former `local-persistence` driver did before
  M2.2); this driver uses the in-page focus check.

The full-matrix comparison is recorded in the M1 pull request.

## Playwright migration (M2.5)

Status: **accepted and retired.** The owner approved this crosswalk and its
removals on 2026-11-24; the driver was removed from the runner manifest and
deleted (recover it with `git show 7cb61ba:docs/verification/editor-toolbar/browser-check.mjs`). This
crosswalk maps each scenario in the former `browser-check.mjs` to
[`tests/e2e/editor-toolbar.spec.ts`](../../../tests/e2e/editor-toolbar.spec.ts)
(production preview, Chromium and Firefox) under the
[M2 plan](../../plans/playwright-m2-migration.md).

| #   | Legacy scenario (lines)                                                                                                                                                                                  | Playwright                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | One roving stop; ArrowRight, End, Home and ArrowLeft browse and wrap; browsing never arms (359–376)                                                                                                      | "one roving stop; Arrow, Home and End browse and wrap without arming a tool".                                                                                                                                    |
| 2   | Remembered Division kind (Minor) reopens the menu there; Escape closes it and returns to Select; **New** resets the roving stop and the kind; button refs stay live (377–392)                            | "New, Import and recovery reload each reset the roving stop and the remembered Division kind", **New** part. A native click on **New** with a real confirm (the driver tagged the button and stubbed `confirm`). |
| 3   | **Import** resets the same state (393–402)                                                                                                                                                               | Same test, **Import** part (real file input; real confirm).                                                                                                                                                      |
| 4   | **Recovery reload**: a foreign autosave and a window `focus` show **Load cached score**; loading resets the same state (403–429)                                                                         | Same test, **Reload** part. The foreign write and `focus` event are controlled setup, as in the driver; the click and confirm are native.                                                                        |
| 5   | **T** from a focused note focuses the remembered tool without changing selection; the handled palette request is cleared; a following Arrow is not undone (430–455)                                      | "T focuses the remembered tool without changing selection, and later browsing is not undone". The fiber check is replaced by the behavioural check (item A).                                                     |
| 6   | After arming Epiphonus by pointer and Escape, **T** reaches the Podatus menu (456–464)                                                                                                                   | Same test (native clicks on the arrow and the menu item).                                                                                                                                                        |
| 7   | The Quilisma figure select arms Quilisma and is remembered (465–479)                                                                                                                                     | "the Quilisma figure select arms Quilisma and remembers the figure". Also asserts the figure is still remembered after Escape.                                                                                   |
| 8   | Action bar: Copy disabled without a selection; Paste labelled empty; a two-neume passage (Shift+Enter, Shift+ArrowRight); Lyrics and Insert describe it; Copy, Paste, Undo, Redo; Insert label (480–528) | "action bar Copy, Paste, Undo and Redo use the session commands and describe the passage". Native clicks; counts neumes' notes as the driver did, on the same six-punctum score (restored from the cache).       |
| 9   | Sticky `data-too-tall` tracks a height above half the window at 1440 × 1100, 320 × 1100, 320 × 500 (flag true, static) and 1440 × 1100 at 150% CSS zoom and after (529–553)                              | "the sticky toolbar observer tracks its height at 1440px, 320px, a short window and 150% CSS zoom". Uses `expect.poll` instead of a fixed 300 ms wait.                                                           |

### Proposed removals

- **A. React fiber introspection** (`paletteFocusRequest`, lines 235–239). The
  driver read `NotationPalette`'s `focusRequest` prop from React's internal
  fiber to show the handled request was cleared. That depends on React
  internals and the component tree. The reducer contract (only the matching
  request clears) is covered by Vitest: `editor-session.test.ts`, "selects
  without an edit, remembers kind, and restores focus by stable ID"
  (`focus-handled`). The browser-visible consequence — the effect does not
  refocus, so Arrow browsing after **T** stays put, and a second **T**
  resolves a new request — is asserted in rows 5 and 6.
- **B. Review screenshots** (`t-focus-variant`, `sticky-320`, `sticky-zoom`),
  never asserted.
- **C. Tagging buttons with `data-toolbar-check`** and script `focus()` to
  reach controls. Role locators and native clicks replace them. Script focus
  remains only as fixture setup for the starting stop, as in the driver.

### Results (M2.5, 2026-11-24)

Implementation commit `d5603ec` with a clean tree. Linux x64, Node 24.12.0,
Playwright 1.65.1 (Chromium `chromium-1255`, Firefox 159.0 `firefox-1572`).
The runner used installed Chromium 157.0.8103.38 and Firefox 146.0.

| Check                                                                                                                                    | Result                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Legacy `npm run verify:browser -- --driver bundled-example,editor-toolbar,score-focus-reparenting,css-zoom-toolbars --browser both -j 4` | 8 of 8 passed (50.7 s wall clock)                                                                                   |
| `npm run test:e2e` (all specs, both browsers)                                                                                            | 277 passed, 1 skipped (the Chromium-only IME test in Firefox)                                                       |
| The four M2.5 specs (66 tests across both browsers), `--repeat-each=10`                                                                  | 660 passed, 0 failed, 0 flaky                                                                                       |
| Negative controls (temporary worktrees, removed)                                                                                         | #112 fix parent: 8 CSS-zoom failures; restore effect disabled: 6 focus failures; palette reset disabled: 2 failures |
| `format:check`, `lint`, `test` (118 files / 2,703 tests), `build`, `git diff --check`, `test:verify-runner` (28/28)                      | All passed                                                                                                          |

### Retirement verification (M2.5, 2026-11-24)

Retirement commit `3b6588e` with a clean tree, in the same environment as
above.

| Check                                                                                 | Result                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `format:check`, `lint`, `test` (118 files / 2,703 tests), `build`, `git diff --check` | All passed                                                                                                                                                                                                                                                         |
| `npm run test:verify-runner`                                                          | 28/28 passed (selection tests updated; 44 runnable and 6 unsupported pairs in `full`)                                                                                                                                                                              |
| `npm run verify:browser -- --list`                                                    | 25 drivers; smoke = `vowel-alignment`, `contiguous-selection`, `audio-playback`                                                                                                                                                                                    |
| `audio-playback` alone, 3 runs before the switch                                      | 3/3 passed in each browser                                                                                                                                                                                                                                         |
| Legacy smoke `--browser both`, 3 runs                                                 | `audio-playback` passed every time in both browsers. `contiguous-selection` failed in Chromium in 2 of 3 runs on a fixed-timing wait in that driver ([#131](https://github.com/OceanOSdev/gregorian-chant-editor/issues/131)); alone it passed 3/3 in each browser |
| `npm run test:e2e`                                                                    | 277 passed, 1 skipped (the Chromium-only IME test in Firefox)                                                                                                                                                                                                      |
| The four M2.5 specs, `--repeat-each=10`                                               | 660 passed, 0 failed, 0 flaky                                                                                                                                                                                                                                      |

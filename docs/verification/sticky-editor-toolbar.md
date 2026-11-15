# Sticky toolbar verification

The [interaction guide](../editor-interactions.md#sticky-editing-tools) owns the
behavior. The existing runner drivers cover the focused UI change; no semantic,
engraving, schema or command contract changed and no new ADR was needed.

## Automated evidence (2026-11-15 UTC)

Linux, Node 24.12.0 (installed; `.nvmrc` requests 24.18.0), Chromium
157.0.8103.38 and Firefox 146.0. Standard gate: formatting, lint, 91 test files /
2,030 tests, production build and `git diff --check` passed. The build retains
its existing large-chunk warning.

Targeted runner evidence is under ignored `.verification-runs/` directories.
Each listed driver passed in **both** browsers with successful runner cleanup:

| Driver                     | Run suffix                            | Durations Chromium / Firefox |
| -------------------------- | ------------------------------------- | ---------------------------- |
| divisions (Chromium)       | `run-2026-11-15T03-46-40-818Z-dgqFQa` | 34.8 / — s                   |
| divisions (Firefox)        | `run-2026-11-15T03-47-27-414Z-oQPehC` | — / 37.8 s                   |
| mid-score-clefs            | `run-2026-11-15T03-42-22-883Z-7sdtzl` | 123.4 / 139.1 s              |
| vertical-episemata-context | `run-2026-11-15T03-44-11-745Z-06MDFg` | 24.1 / 30.0 s                |
| bundled-example            | `run-2026-11-15T03-44-52-992Z-IpHVFB` | 5.4 / 7.3 s                  |
| b-accidentals              | `run-2026-11-15T03-45-47-331Z-A5XaYe` | 14.3 / 19.8 s                |

These runs used the implementation working tree based on plan commit
`0cf584e`; later application edits only extracted the already tested numeric
visibility calculation into a pure function with unit tests. A final CSS-only
stacking correction raises the sticky region above the contextual panels. The bundled-example
driver exercises Kyrie XI at 1440px and 320px: the header scrolls out, tools
remain visible, arming does not scroll, lower-system neume placement and
Undo/Redo work, and the 500px-high fallback returns tools to normal flow.
Screenshots are in that run's `jobs/*/driver-tmp/*/sticky-*.png`.

Earlier diagnostic failures are retained in local run directories. They exposed
panel overlap before the sticky edge, excessively tall wrapped/zoomed tools,
and driver assumptions about the old control names/order and unobstructed
viewport. The implementation now reserves measured visible toolbar bounds and
falls back when the tools exceed half the viewport. Drivers reveal targets below
the tools, click an exposed note hit area beside an accidental panel, and allow
pointer movement to settle before activating Close. Firefox requires an actual
coordinate change to refresh the ghost after synthetic menu activation.
Assertions were retained; the full matrix was not run. The division driver also
checks primary activation, keyboard variant selection and Escape focus return,
then reveals a note covered by the toolbar and checks that repeated focus does
not scroll.

Final stacking verification: `npm run verify:browser -- --driver
divisions,bundled-example --browser both -j 4` at
`run-2026-11-15T03-48-26-146Z-OGYmTy`: all four jobs passed, cleanup succeeded,
38.4 s wall time. Divisions Chromium/Firefox 34.8/37.7 s; bundled example
5.8/8.4 s. This covers the final application bytes, including menu stacking.

## Focused PR review corrections (2026-11-15 UTC)

Native Tab reproduced obscured score focus in Chromium before the focus fix:
`run-2026-11-15T03-55-37-497Z-geZufF`, Chromium failed “native Tab reveals
covered focus”; Firefox passed. This regression uses real browser Tab and
Shift+Tab actions, not a direct helper import. The replacement test confirms
that each direction reaches note50, reveals it below the toolbar without
changing selection, and leaves scroll unchanged for an already visible target.

The existing ScoreSvg browser focus tracker now schedules minimal reveal after
native traversal settles. It cancels stale callbacks on subsequent focus or
unmount and never intercepts Tab, changes selection, or refocuses another target.
The entire division editing fieldset is conditional on the existing resolved
target, with guards and handlers preserved. Division primary activation also
remembers Minima; the browser regression chooses Finalis, returns to Select,
arms the primary, returns to Select, and checks Minima receives menu focus.
It also checks absence of an empty division fieldset and unchanged remembered
Punctum insertion text. No architectural or scope deviation.

Final application working tree based on `7062268`:
`npm run verify:browser -- --driver divisions,bundled-example,vertical-episemata-context --browser both -j 4`
at `run-2026-11-15T03-56-44-772Z-84vTQp`: all six jobs passed, 41.8 s wall
clock, cleanup succeeded. Chromium/Firefox durations: divisions 37.4/41.2 s,
bundled example 5.8/8.4 s, contextual toolbar 23.5/30.8 s.

Supplemental final-implementation run:
`npm run verify:browser -- --driver vowel-alignment,local-persistence,compound-directional-neumes --browser both -j 4`
at `run-2026-11-15T03-57-13-742Z-ucxcX6`. Local persistence passed in
Chromium/Firefox (15.1/19.9 s); the existing compound-directional-neumes family
driver passed in both (51.1/57.4 s), with its menu, focus, ghost, editing and
persistence assertions intact. Vowel alignment Firefox is unsupported, not run.
The unchanged alignment driver failed its exact Undo music restoration assertion:
its pointer helper scrolled sticky Undo before measuring/clicking it. The helper
now leaves sticky controls in place and waits for scrolling to settle before
measuring other targets. No assertions were removed or loosened. The corrected
vowel-alignment Chromium run `run-2026-11-15T03-58-16-210Z-kFet1S` passed
(10.4 s; 10.6 s wall time). Every run cleaned up successfully.

Standard gate on the corrected application passed: format:check, lint, 91 test
files / 2,030 tests, build and diff check. Subsequent edits changed only browser
driver pointer setup and documentation; formatting and diff checks were repeated.
The installed Node version and existing bundle warning remain as recorded above.
No comprehensive matrix or foreground acceptance is claimed.

## Remaining owner acceptance

- Foreground Chromium/Firefox authoring with Kyrie XI, including native HTML
  Enter/Space on the division primary and explicit before/after controls
  (Firefox headless HTML Enter limitations remain in the division driver).
- Human review of wrapped menus, native Tab traversal, actual browser zoom,
  screen-reader announcements, and lyric/clef draft transitions during authoring.
- Final visual acceptance; generated screenshots are local diagnostics, not new
  engraving reference specimens. Do not merge until owner acceptance.

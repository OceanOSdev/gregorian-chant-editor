# Bundled example verification

> **Retired in Playwright M2.5.** `browser-check.mjs` was deleted after the owner
> accepted its [crosswalk](#playwright-migration-m25). Commands and results
> below are historical; recover the script with
> `git show 7cb61ba:docs/verification/bundled-example/browser-check.mjs`.

The example driver mounts the real editor on a disposable origin/profile. Use
the [local persistence setup](../local-persistence/README.md#reproduce) for
Chromium/CDP on 9230, Firefox/BiDi on 9231 and production preview on 4173
(historical; the runner no longer lists this driver). The persistence driver it was originally run
beside was retired to Playwright in M2.2
([migration record](../local-persistence/README.md#playwright-migration-m22)).

```sh
node docs/verification/bundled-example/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9231/session node docs/verification/bundled-example/browser-check.mjs
```

Set `CHANT_PREVIEW_URL=http://127.0.0.1:5173/` for Vite development mode.
Never point these drivers at an owner profile: they clear test-origin storage.
Generated screenshots go to temporary storage; selected evidence is retained here.

## Results (2026-11-09)

- Production Chromium and Firefox: example driver and existing local-persistence
  regression driver PASS at 1440px and 320px.
- Vite development Chromium and Firefox: example driver PASS.
- Native keyboard ArrowDown/Enter opens the confirmation; cancellation retains
  focus on Load example. Other selector choices dispatch native DOM change events.
  Confirmations are stubbed to inspect their wording and control acceptance.
- Cancel/reselect, fresh history, immediate refresh, complete export equality,
  cross-tab byte-conflict protection, incompatible draft-v2 protection and explicit
  cache replacement pass. Blocked replacements retain unsaved feedback.
- Existing persistence regression checks New/Import/Export, title drafts/history,
  pending lyric guards, storage failure and cache recovery.
- Format, lint, 73 Vitest files / 1,532 tests, production build and diff whitespace
  checks pass. No dependency, schema, autosave-key or ADR change.
- Canonical JSON is unchanged; it is excluded from formatting to preserve the
  owner's committed bytes.

Selected screenshots: [before loading](before-chromium.png),
[loaded desktop](after-chromium.png), [loaded Firefox 320px](after-firefox-320.png).
The before image shows the starter with the new selector available.

## Discovery cleanup verification (2026-11-11)

- Production preview: bundled-example driver PASS in headless Chromium and
  Firefox at 1440px and 320px. Keyboard cancellation checks the selected option's
  display name independently of example ordering; Pater Noster load, persistence,
  focus, cancellation and protected-cache assertions remain in place.
- Format, lint, 78 Vitest files / 1,575 tests, production build and diff whitespace
  checks PASS. Tests discover and validate every bundled source independently.
- Both musical sources retain their bytes; De Profundis was renamed to
  `de-profundis-antiphon.chant.json`. All bundled sources are excluded from
  automatic formatting. No schema, UI, dependency or ADR change.
- De Profundis provenance and reuse terms remain undocumented and need owner
  confirmation; see the [persistence guide](../../persistence.md#bundled-examples).
  Foreground native-dialog and screen-reader checks were not repeated.

## Remaining owner acceptance

- Inspect native confirmation and OS select presentation in a foreground browser.
- Review the chant engraving against the source; vertical episemata remain deferred.
- Check screen-reader speech, actual browser/OS zoom and IME as appropriate.

Headless input/DOM checks do not establish these foreground results. Cross-tab
protection in the example driver simulates an external byte change plus storage
event; it does not claim atomic simultaneous writes or a real two-tab race.

## Playwright migration (M2.5)

Status: **accepted and retired.** The owner approved this crosswalk and its
removals on 2026-11-24; the driver was removed from the runner manifest and
deleted (recover it with `git show 7cb61ba:docs/verification/bundled-example/browser-check.mjs`). Under the
[M2 plan](../../plans/playwright-m2-migration.md), this crosswalk maps each
scenario in the former `browser-check.mjs` to the Playwright test
that now protects it:
[`tests/e2e/bundled-example.spec.ts`](../../../tests/e2e/bundled-example.spec.ts),
on the production preview in Chromium and Firefox.

| #   | Legacy scenario (lines)                                                                                                                                                                                            | Playwright                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fresh storage writes nothing; the header is contained at 1440px and 320px before any example (188–194)                                                                                                             | "keyboard choice asks to confirm the named example …" (first assertions). Review screenshots are dropped (item B).                                                                                                                                                                                 |
| 2   | Keyboard: ArrowDown and Enter on the focused selector ask to confirm the first example by name; dismiss; focus stays on the selector (199–240)                                                                     | Same test. A native **ArrowDown** on the focused closed `<select>` chooses the first example and opens the confirmation in both browsers; the dialog is answered through Playwright's dialog API (the driver replaced `window.confirm`). Adds: the selector resets to empty and nothing is cached. |
| 3   | Pater Noster, cancelled: cache unchanged; message names Pater Noster; selector resets (241–247)                                                                                                                    | "Pater Noster: cancel keeps everything; accept replaces …". Stronger: the real dialog text also states the undo/redo reset and advises Export, as the [contract](../../persistence.md#bundled-examples) requires.                                                                                  |
| 4   | Pater Noster, accepted: cached title, 103 neumes, 111 notes; Undo disabled; refresh keeps the bytes; Export equals the document; header contained (248–268)                                                        | Same test, with a real download replacing the `createObjectURL` patch (item A).                                                                                                                                                                                                                    |
| 5   | Foreign bytes plus a synthetic `StorageEvent`: a load stays in memory (cache keeps the foreign bytes, "Not saved / another tab"); Replace cache saves (269–276)                                                    | "a load during a cache conflict stays in memory until the cache is explicitly replaced". The foreign write comes from a **real second tab**, so the browser's own `storage` event is delivered (item A). Replace cache goes through its real confirm.                                              |
| 6   | Incompatible (withdrawn draft-v2) cache: a load does not overwrite it; "Not saved"; Replace cache saves (277–289)                                                                                                  | "an incompatible cache is not overwritten by a load until it is explicitly replaced".                                                                                                                                                                                                              |
| 7   | Kyrie XI at 1440px and 320px: sticky tools pinned at the top with the header scrolled away; arming Minima does not scroll; a lower-staff click places one punctum and the page stays scrolled; Undo/Redo (290–349) | "long bundled score (Kyrie XI)" › "sticky tools stay pinned and arm in place …" (2). Native clicks on the tools (the driver used DOM `click()` for Minima, Punctum, Undo and Redo) and a native click on the lower staff.                                                                          |
| 8   | A 1440 × 500 window keeps the sticky tools static (350–360)                                                                                                                                                        | "a short window returns the sticky tools to normal flow".                                                                                                                                                                                                                                          |

### Proposed removals

- **A. Replaced test doubles:** the `window.confirm` stub, the
  `createObjectURL`/anchor patch and the same-tab synthetic `StorageEvent`
  become real dialogs, a real download and a real second tab.
- **B. Review screenshots** (`before-example`, `after-example`, `sticky-*`),
  which were never asserted. The containment assertions are kept.
- **C. Programmatic `change` and `click()`** on the selector and tools become
  `selectOption`, native keys and native clicks. `selectOption` itself sets the
  value programmatically, as the driver's `change` did; neither opens the
  native popup.

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

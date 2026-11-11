# Bundled example verification

The example driver mounts the real editor on a disposable origin/profile. Run
sequentially with the persistence driver (they share a browser tab). Use the
[local persistence setup](../local-persistence/README.md) for Chromium/CDP on
9230, Firefox/BiDi on 9231 and production preview on 4173.

```sh
node docs/verification/bundled-example/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9231/session node docs/verification/bundled-example/browser-check.mjs
node docs/verification/local-persistence/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9231/session node docs/verification/local-persistence/browser-check.mjs
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

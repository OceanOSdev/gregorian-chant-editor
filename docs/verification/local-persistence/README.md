# Stage 7A verification

Date: 2026-11-08. Implementation follows Accepted ADR 0016 and the
[committed plan](../../plans/stage-7a-local-document-persistence.md).
The [persistence guide](../../persistence.md) owns the implemented contract.

## Automated results

Passed locally: `npm run format:check`, `npm run lint` (no warnings), `npm test`
(63 files / 1,297 tests), `npm run build`, and `git diff --check`.
Local Node was v24.12.0; the repository declares v24.18.0 in `.nvmrc`.
Hosted CI uses the declared version and is a separate result.

New pure tests cover exact full-document/empty/all-seven-kind round trips,
shared validation, tuple/contour/type/ID/anchor/alignment rejection, unknown
schema versions, damaged/oversize input, filenames, absent/corrupt/unavailable
storage, quota failure, explicit recovery, cross-tab protection and undo/redo.

The standalone `browser-check.mjs` passes in headless Chromium/CDP and
Firefox/BiDi against the real StrictMode production app at
`http://127.0.0.1:4173/gregorian-chant-editor/`, at 1440px and 320px:

- First load leaves absent cache absent; a real React select change saves
  synchronously in the same JavaScript task, before refresh.
- Refresh restores committed content and fresh history; undo and redo save
  the correct document, then survive refresh.
- Complete multi-system native file round trips preserve semantic equality,
  stable IDs, lyrics/manual alignment, divisions and authored C/F clefs.
  New creates a blank score; accepted import clears undo history.
- New/import cancellation and malformed/future/malformed-array/oversize files
  preserve cached content. Errors are announced.
- Export exercises Blob construction, UTF-8 content and sanitized filename.
  The driver captures bytes instead of opening an OS download/save dialog.
- Dirty lyric input blocks Document controls and announces the distinction
  from saved committed content. Refresh discards only that uncommitted draft.
  Pending clef edits block controls without saving; Cancel restores availability.
- An actual independent tab writes divergent cache content. The original tab
  warns and refuses to overwrite it after a local edit; explicit Load restores it.
- Corrupt cached bytes survive startup and subsequent edits until explicit
  replacement. A throwing Storage setter retains editable memory, announces
  Not saved and recovers through explicit retry.
- Production JS/CSS URLs retain the repository subpath; responsive page width
  stays contained. Screenshots were also inspected by the implementation agent.

The driver uses native pointer actions for Document/history/clef buttons.
It feeds File/DataTransfer objects to the file input and programmatically
answers `window.confirm` to exercise accept/cancel handlers. Input/select
changes and draft activation use DOM events. This is browser automation, not
foreground manual keyboard, native picker/dialog or spoken-output verification.

Fresh final diagnostic folders (temporary, not required for reproduction):
Chromium `/tmp/chant-local-persistence-1UnPHz`; Firefox
`/tmp/chant-local-persistence-ZaCuLn`.
Selected retained screenshots: [Chromium controls](document-controls-chromium.png)
and [Firefox 320px controls](document-controls-firefox-320.png).

## Reproduce

Use isolated disposable profiles so tests cannot replace personal work.
Build with `npm run build`, then run `npm run preview -- --host 127.0.0.1`.
In separate terminals:

```bash
chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=9230 --user-data-dir=/tmp/chant-7a-chromium about:blank
mkdir -p /tmp/chant-7a-firefox
firefox --headless --remote-debugging-port 9231 --profile /tmp/chant-7a-firefox about:blank
```

Run (Node with built-in fetch/WebSocket):

```bash
node docs/verification/local-persistence/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9231/session node docs/verification/local-persistence/browser-check.mjs
```

The script replaces only the named app cache in these disposable profiles and
writes screenshots to a fresh system temporary directory. It is outside CI.

## Foreground owner acceptance — not run

1. Run the production preview above and open its subpath in foreground Chromium
   and Firefox with a disposable profile. Verify Tab/Shift+Tab, native confirmation
   dialogs, file picker cancellation and actual downloaded `.chant.json` files.
2. Create/edit notes and neumes, lyrics/language/manual alignment, divisions and
   C/F clefs. Refresh immediately after each accepted edit and after undo/redo;
   compare visible notation. Export the final score.
3. Use New; verify blank C3/Latin and empty history. Import the actual downloaded
   file; compare the complete score. Export/import an empty chant too.
4. Start a dirty lyric draft, a clef transaction and a lyric move in turn. Confirm
   Document controls explain why they are unavailable. Save/cancel through the
   existing controls; verify operations become available without losing text.
5. Cancel New, a valid import confirmation and the picker. Confirm document,
   undo/redo, placement and drafts remain unchanged. Try damaged/future JSON;
   check accessible error feedback and unchanged score/history.
6. Open two tabs. Edit one, then the other. Confirm conflict warning; export both
   versions before choosing Load or Replace. Check explicit recovery confirmation.
7. In a disposable profile, damage the namespaced cache in DevTools and refresh.
   Confirm the bytes remain until explicit replacement. Restrict browser storage
   and verify Not saved, retained memory and actual file export still work.
8. Check controls and feedback at 320px and actual browser zoom, keyboard-only
   use, IME and screen-reader announcement. These checks remain unverified.

Hosted GitHub Pages checks remain pending owner merge/deployment; local subpath
verification does not prove deployed recovery. Storage is best-effort, not an
atomic cross-tab synchronization service. Truly simultaneous writes remain a
localStorage platform limitation. Extreme semantic pitches retain existing
engraving limits; persistence never changes them. No GABC, cloud, library,
playback or history persistence was introduced.

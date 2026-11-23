# Stage 7A verification

Date: 2026-11-08. Implementation follows Accepted ADR 0016 and the
[committed plan](../../plans/stage-7a-local-document-persistence.md).
The [persistence guide](../../persistence.md) owns the implemented contract.

**The `browser-check.mjs` driver was retired in Playwright M2.2.** Its
scenarios now run in the Playwright specs listed under
[Playwright migration](#playwright-migration-m22). The commands below record
how earlier results were produced. The script is in git history, for example
`git show 793fa79:docs/verification/local-persistence/browser-check.mjs`.

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

## Initial title review follow-up (historical UI)

The compact-header refinement below supersedes this section’s immediate-on-input
title interaction; its original verification results are retained for context.

The Document section now includes a labeled Title field. Each input change
commits through the existing semantic history/autosave path, with no separate
draft. The pure command preserves all music/lyrics and returns the same document
for unchanged text. Native validation now uses `Number.isSafeInteger()` for note
positions, rejecting unsafe values instead of rounding or clamping them.

Follow-up verification passed: `npm run format:check`, `npm run lint` (no
warnings), `npm test` (64 files / 1,307 tests), `npm run build`, and
`git diff --check`. New tests cover title immutability/sharing, no-op history,
undo/redo, cache recovery, file round trips and blank-title filenames, plus
inclusive safe-integer bounds and out-of-range rejection.

The expanded production Chromium and Firefox drivers both pass the previous
Stage 7A scenarios and the following additions:

- Name a newly created blank chant and observe synchronous cache update, heading
  update, title undo/redo and refresh recovery.
- Append a character through native keyboard input while retaining title focus;
  Undo restores the preceding title through semantic history.
- Export the named chant, verify exact title/filename, New then Import the
  exported bytes, and verify title-field restoration. A cleared title exports
  with the fallback filename.
- Reject unsafe imported staff positions while retaining the active score.

Fresh diagnostics: Chromium `/tmp/chant-local-persistence-vBsAbg`; Firefox
`/tmp/chant-local-persistence-0Be3n1`. Agent-inspected screenshots show the title
field at [1440px in Chromium](title-controls-chromium.png) and
[320px in Firefox](title-controls-firefox-320.png). The original screenshots above
remain pre-follow-up evidence. Local Node remains v24.12.0; hosted CI uses the
repository's declared version.

Add to foreground acceptance: name a new chant using native typing/paste/IME,
use Undo/Redo, refresh, and export/import an actual downloaded file. Check that
its filename follows the chosen title, including the blank-title fallback.
Foreground and hosted Pages checks remain unrun as described above.

## Compact document header refinement

The fieldset and separate title display are replaced by one compact header above
the score. Its editable heading is the sole visible title; New / Import / Export
are compact secondary actions on the right, wrapping at narrow widths. Normal
save/recovery feedback is just “Saved locally.” Storage errors, conflicts and
pending/unsaved edits retain visible guidance and recovery buttons. The permanent
storage disclaimer is now in **About local saving**, a native disclosure. Short
file-success announcements remain available to assistive technology without
permanent visual paragraphs. No dependencies or engraving changes were added.

Title activation opens a focused local draft. Enter or blur commits one semantic
history/autosave change; Escape discards it without altering history, redo or
cache. Enter/Escape return focus to the heading. Document actions explicitly
commit the title before acting, and Export uses the newly committed title even
when browser focus events are delayed or absent. The shared semantic command,
codec, recovery policy and confirmation dialogs remain in use.

Verification: formatting, lint without warnings, all 64 files / 1,307 unit tests,
production build and diff checks pass. Adapter tests additionally assert the
explicit saved-state flag for initial, recovered, failed and conflicting storage.
The expanded Chromium/CDP and Firefox/BiDi production drivers pass all prior
Stage 7A scenarios and check:

- Click-to-edit, native Enter/Escape, focus return, composition-Enter rejection,
  no autosave while typing, one history entry per accepted title, canceled title
  drafts preserving redo, and unchanged titles creating no entry.
- Native blur commit in Chromium; explicit blur-handler invocation in Firefox.
  This headless Firefox environment changes activeElement without emitting
  focusout, even on input.blur(). Its driver injects focusout for that assertion;
  **foreground Firefox native blur remains manual**. Native Firefox title keys
  and pointer actions still run, and Export commits safely without relying on blur.
- Click Export with an active title draft; the actual exported Blob contains the
  accepted title. Refresh, undo/redo, file round trips and blank-title filenames
  retain their existing behavior.
- One visible heading, no Document fieldset, short normal saved feedback, and
  actual pointer activation of the collapsed local-saving disclosure.
- Containment at 1440px and 320px for normal, title-editing, conflicting-cache,
  corrupt-cache, expanded-help, long-title and unbroken-title states.

The implementation agent inspected the retained screenshots linked below.
Foreground keyboard/IME/zoom, spoken screen-reader behavior, actual file dialogs
and deployed Pages validation remain owner checks. In particular, verify native
Firefox blur by editing the heading then tabbing or clicking outside it; also
check that Escape keeps the old title and that one Undo restores an accepted
multi-character edit.

Fresh compact-header diagnostics: Chromium
`/tmp/chant-local-persistence-CRPiX0`; Firefox
`/tmp/chant-local-persistence-2G99cS`.
Retained screenshots: [desktop Chromium](compact-header-chromium.png),
[320px Firefox](compact-header-firefox-320.png),
[320px title draft](compact-header-title-draft-chromium-320.png), and
[320px actionable conflict](compact-header-conflict-firefox-320.png).

## Playwright migration (M2.2)

Status: **accepted and retired.** The owner approved this crosswalk and
removals A–E on 2026-11-23. The driver was removed from the runner manifest
and smoke preset (replaced there by `bundled-example`) and deleted. Under the
[M2 plan](../../plans/playwright-m2-migration.md), this crosswalk maps each
scenario of the former `browser-check.mjs` to the test that now protects it.
It supersedes the local-persistence rows
of the [M1 crosswalk](../playwright-m1/README.md#local-persistence-production-preview).

Specs, all on the production preview, in Chromium and Firefox:

- [`local-persistence.spec.ts`](../../../tests/e2e/local-persistence.spec.ts):
  autosave, files, recovery and blocking workflows.
- [`document-title.spec.ts`](../../../tests/e2e/document-title.spec.ts):
  title editing, IME, filenames.
- [`document-header.spec.ts`](../../../tests/e2e/document-header.spec.ts):
  the help disclosure, responsive containment and asset paths.

Shared helpers are in
[`helpers/preview-document.ts`](../../../tests/e2e/helpers/preview-document.ts).
Unlike the single long legacy session, each test starts from a fresh browser
context. Tests that need an existing score store it in the cache and reload
(`openWithCache`), which is the documented restore path. The import path
itself stays covered by the tests in rows 5, 22 and 23.

### Crosswalk

"Legacy" gives the driver lines. Vitest tests are named where they own the
pure logic.

| #   | Legacy scenario (lines)                                                                                                                              | Coverage now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cleared storage: first render shows the 4-note example and writes nothing (293–300)                                                                  | `local-persistence` › autosave, "first load saves nothing …". Vitest: `browser-document.test.ts` "does not write on first visit".                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | **Same-task synchronous save**: a select `change` dispatched by script, with the cache read inside that same evaluation (301–305)                    | `local-persistence` › autosave, "a committed edit is already saved when its input event finishes dispatching". A window listener in the bubble phase, which runs after React's root listener in the same dispatch, records the cache bytes. Checked for a `selectOption` change (programmatic `change`, as before) **and** a native pointer click on Undo (new). Negative check: an init script that defers every `localStorage` write to a later task made this test fail in both browsers (Expected `"el"`, Received `null`); the scratch file was deleted. |
| 3   | Refresh: "Saved locally" (306–307)                                                                                                                   | `local-persistence` › autosave, "first load …" (also fresh history and restored value).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 4   | New, cancelled: cache unchanged (308–311)                                                                                                            | `local-persistence` › files, "import via the native file chooser …", through a real `confirm` dialog (the driver replaced `window.confirm`).                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 5   | Import of the v8 multi-system fixture re-saves v10 exactly; history cleared; several systems (312–324)                                               | Same test, through the native file chooser.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6   | Export bytes equal v10; filename `Salve-Regina.chant.json` (325–330)                                                                                 | `local-persistence` › files, "export through a real download …". A real download replaces the driver's `createObjectURL`/anchor-click patch.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 7   | New, accepted: empty score saved (331–332)                                                                                                           | `local-persistence` › files, "import via the native file chooser …".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 8   | A title draft over an existing cache: cache unchanged; status "Title not saved"; header contained at 1440px and 320px; Undo still disabled (333–346) | `document-title` › "a typed draft is not saved, says so, keeps the page contained …". Native typing replaces the driver's value setter. Review screenshots are dropped (item C).                                                                                                                                                                                                                                                                                                                                                                              |
| 9   | Escape: cache unchanged, focus returns to the heading button (347–354)                                                                               | `document-title` › "title edits stay a draft until Enter …" and "a typed draft …".                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 10  | **IME**: a dispatched `keydown` Enter with `isComposing: true` does not commit (355–361)                                                             | Two tests, see [IME](#ime-approach). `document-title` › "Chromium IME: Enter while composing does not commit; Enter after composition does" uses **real composition through Chromium's input-method pipeline** (CDP `Input.imeSetComposition`; Chromium only). `document-title` › "a keydown marked isComposing does not commit the title (synthetic guard check)" runs in both browsers and is labelled as a handler-guard check, not IME behaviour.                                                                                                         |
| 11  | Enter commits: cache and displayed title updated; focus on the heading button (362–370)                                                              | `document-title` › "title edits stay a draft until Enter …".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 12  | Several input events in one title session make one history entry (Undo restores the old title, Undo then disabled) (371–379)                         | `document-title` › "several edits in one title session are one history entry". Vitest: `update-document-title.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 13  | Escape on a later draft keeps the redo branch; Redo restores the title (380–389)                                                                     | `document-title` › "Escape on a later draft and Enter on unchanged text both keep the redo branch".                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 14  | Refresh shows the committed title; exactly one `h1` (390–392)                                                                                        | `document-title` › "title edits stay a draft until Enter …".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 15  | Native typing at the end of the title stays uncommitted; Escape restores the display (393–419)                                                       | `document-title` › "a typed draft is not saved …" (native End and typing, both browsers; the driver used CDP `insertText`/BiDi keys).                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 16  | Leaving the title commits it; Undo restores (420–433). Firefox: blur plus a dispatched `focusout` workaround                                         | `document-title` › "leaving the title by native Tab commits it and focus follows the user". Native Tab in both browsers, with no workaround. Stronger: focus moves on rather than returning to the heading button.                                                                                                                                                                                                                                                                                                                                            |
| 17  | Enter on unchanged text keeps the redo branch (434–442)                                                                                              | `document-title` › "Escape on a later draft and Enter on unchanged text …" (also asserts no new Undo entry). Vitest: `update-document-title.test.ts` "does not create history for an unchanged title".                                                                                                                                                                                                                                                                                                                                                        |
| 18  | Export with a pending title commits it first (443–450)                                                                                               | `document-title` › "Export commits a pending title before writing the file" (real download; also asserts the cache and the filename).                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 19  | Filename keeps diacritics: `Sálve-Regina.chant.json` (451–456)                                                                                       | `document-title` › "filenames come from the committed title …" and "Export commits …". Vitest: `native-document.test.ts` "uses a bounded safe filename".                                                                                                                                                                                                                                                                                                                                                                                                      |
| 20  | Re-importing the named export restores the title (457–461)                                                                                           | `document-title` › "filenames come from the committed title …".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 21  | Empty title: cache title `''`; export `untitled.chant.json` (462–466)                                                                                | Same test. Also asserts the visible and accessible "Untitled chant" affordance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 22  | Re-importing the earlier export restores v10 exactly (468–469)                                                                                       | `local-persistence` › files, "export through a real download … round-trip".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 23  | Rejected imports (malformed JSON, version 11, `neumes: null`, over 1 MiB, unsafe integer pitch): cache unchanged, "Import failed" alert (470–503)    | `local-persistence` › files, "rejected imports keep the cache, the score and the undo history, and each is announced". All five classes through the real file input. Stronger: the in-memory score and the undo history are unchanged, and each attempt changes the alert, so a stale message cannot pass. Vitest: `native-document.test.ts` "rejects broken, future, foreign and oversized envelopes", unsafe staff positions, and invalid collections.                                                                                                      |
| 24  | Import, cancelled at the confirm: cache unchanged (504–511)                                                                                          | `local-persistence` › files, "import via the native file chooser …".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 25  | Edit then Undo back to the imported score saves those exact bytes, also after refresh (512–520)                                                      | `local-persistence` › autosave, "Undo back to the loaded score saves those exact bytes …". Vitest: `browser-document.test.ts` "saves exact committed undo and redo snapshots".                                                                                                                                                                                                                                                                                                                                                                                |
| 26  | Undo/Redo results survive refresh (521–529)                                                                                                          | `local-persistence` › autosave, "first load …".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 27  | Dirty lyric draft: New/Import/Export and the title disabled; status "Pending edits" (530–549)                                                        | `local-persistence` › pending edits, "a dirty lyric draft disables every Document control without saving". A native double-click opens the lyric and native typing changes it (the driver dispatched `dblclick` and set the value by script). Stronger: also checks the "Load example" select and that the cache is unchanged.                                                                                                                                                                                                                                |
| 28  | Staged clef edit: controls disabled, cache unchanged; Cancel re-enables them, cache unchanged (550–572)                                              | `local-persistence` › pending edits, "a staged clef edit disables every Document control until it is cancelled …". Native click on the clef change (the driver dispatched `click`). Also checks "Load example".                                                                                                                                                                                                                                                                                                                                               |
| 29  | Another tab writes the cache: conflict status; header contained at both widths; edits do not overwrite; Load cached score (573–636)                  | `local-persistence` › recovery, "a write from another tab is detected …", with a real second page in the same context. Adds containment at 1440px and 320px.                                                                                                                                                                                                                                                                                                                                                                                                  |
| 30  | Corrupt cache: status "invalid or unavailable"; header contained; edits do not overwrite; Replace cache / Retry save writes the score (637–649)      | `local-persistence` › recovery, "a corrupt cache survives load and edits until it is explicitly replaced". Stronger: the bytes also survive a refresh, and a dismissed confirm leaves them. Vitest: `browser-document.test.ts` "protects corrupt bytes …".                                                                                                                                                                                                                                                                                                    |
| 31  | Throwing `setItem`: the edit stays in memory and the status says "Not saved"; restore, Retry saves (650–665)                                         | `local-persistence` › recovery, "throwing storage keeps the edit in memory, reports Not saved, and Retry saves it". The same `Storage.prototype.setItem` fault injection, as controlled setup. Stronger: the cache is unchanged during the failure, and Retry goes through its real confirm. Vitest: `browser-document.test.ts` "guards unavailable access, read and quota errors …".                                                                                                                                                                         |
| 32  | Help disclosure closed by default; a native click opens it; no `fieldset` in the header (666–689)                                                    | `document-header` › "About local saving is a closed native disclosure …". Stronger: closes by click, and opens and closes by keyboard Enter (the driver closed it by setting `open`).                                                                                                                                                                                                                                                                                                                                                                         |
| 33  | Page contained at 1440px and 320px (690–711)                                                                                                         | `document-header` › "the header stays inside the page at {width}px …" (first assertion).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 34  | A very long title stays contained while drafted, once committed and with help open, at both widths (712–736)                                         | Same tests, with the help opened by a native click.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 35  | Built scripts and stylesheets load from `/assets/` (737–742)                                                                                         | `document-header` › "built scripts and stylesheets load from /assets/". Adds a check that at least one asset exists.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### IME approach

Three options were investigated:

1. **Chromium CDP input-method composition** (`Input.imeSetComposition`, then
   `Input.insertText`, through Playwright's `CDPSession`). This drives
   Chromium's own input-method pipeline. The input received
   `compositionstart`/`compositionupdate`/`compositionend`, the composed text
   appeared in its value, and an Enter pressed during the composition reached
   the input as `keydown` with `isComposing === true` (`keyCode` 13). The title
   did not commit and the cache was unchanged. After the composition ended,
   Enter committed. **Chosen for Chromium.** Scope: no OS IME, candidate
   window or platform text service is involved, so this does not establish
   behaviour with a specific real IME.
2. **Firefox**: Playwright 1.65.1 exposes no composition API for its Firefox
   (Juggler) build, so no genuine Firefox composition is tested. Foreground
   IME acceptance remains manual, as it was for the driver.
3. **Synthetic `keydown` with `isComposing: true`** (the driver's method).
   This exercises only the handler's guard. It is **kept in both browsers and
   labelled as a guard check**, not as IME evidence.

### Proposed removals

Each item is a legacy mechanism that is not reproduced as written. None of
them removes protection of a documented behaviour:

- **A. Replaced test doubles.** The `window.confirm` replacement (rows 4, 7,
  24, 29–31) and the `URL.createObjectURL`/anchor `click` patch (rows 6,
  18–21) become real dialogs and real downloads.
- **B. Synthetic user input.** The script `dblclick`/`click` events, the
  value setter followed by an `input` event (rows 8, 15, 27, 28), the
  programmatic `open = false` on the help disclosure (rows 32, 34) and the
  Firefox `focusout` workaround (row 16) become native Playwright input. The
  one remaining synthetic event is the labelled guard check in row 10.
- **C. Review screenshots** (`title-draft`, `conflict`, `corrupt-cache` and
  the plain header, at 1440px and 320px). These were captured for human
  review, not asserted. The containment assertions they accompanied are kept.
  Visual baselines are excluded from M2.
- **D. One continuous session.** The driver chained every scenario through
  one page, so later steps depended on earlier ones. The specs use fresh
  contexts, and tests that need a cached score set it up with
  `openWithCache`. Row 12 now undoes back to the restored title rather than
  "Untitled chant", and row 20 re-imports a full score rather than an empty
  one. Neither changes the contract under test.
- **E. Fixed 100 ms pauses and transport.** CDP/BiDi plumbing, endpoint
  discovery and fixed sleeps go; web-first assertions and `expect.poll`
  replace them.

### Findings while porting

- **No product defect found.** No assertion is marked `test.fail()`.
- **Same-task check can fail.** The negative check in row 2 shows that the
  bubble-phase listener detects a save made in a later task.
- **Firefox IME is not testable through Playwright.** See [IME approach](#ime-approach).

### Results (2026-11-23)

Implementation commit `807d90a` with a clean tree. Linux x64, Node 24.12.0,
Playwright 1.65.1 (Chromium `chromium-1255`, Firefox 159.0 `firefox-1572`).
The runner used installed Chromium 157.0.8103.38 and Firefox 146.0.

| Check                                                                                                                                               | Result                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Legacy `npm run verify:browser -- --driver local-persistence --browser both -j 2`                                                                   | Chromium passed (13.0 s), Firefox passed (16.1 s)                                   |
| `npm run test:e2e` (all specs, both browsers)                                                                                                       | 169 passed, 1 skipped (the Chromium-only IME test in Firefox), 43.9 s               |
| `npx playwright test local-persistence document-title document-header --repeat-each=10` (default workers)                                           | 470 passed, 10 skipped (the same test), 0 failed, 0 flaky (2.4 min)                 |
| Same three specs, `--repeat-each=5 --workers=16`                                                                                                    | 235 passed, 5 skipped, 0 failed, 0 flaky (1.4 min)                                  |
| Negative check for row 2 (deferred `localStorage` writes)                                                                                           | The same-task test failed in Chromium and Firefox as expected; scratch spec removed |
| `format:check`, `lint`, `test` (118 files / 2,703 tests), `build` (including `tsconfig.e2e.json`), `git diff --check`, `test:verify-runner` (28/28) | All passed                                                                          |

Legacy run directory: `.verification-runs/run-2026-11-23T08-42-09-404Z-S0sUxt/`
(ignored, not committed).

Not run: hosted CI, WebKit, a real OS IME, foreground window focus, native
`<select>` popups and screen readers.

### Retirement verification (2026-11-23)

Retirement commit `11bff9f` with a clean tree, in the same environment as
above. Before switching, `bundled-example` was run three times in each browser
to check that it suits the smoke preset: 3/3 passed in Chromium (about 5.4 s)
and 3/3 in Firefox (about 7.1 s).

| Check                                                                                   | Result                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `test` (118 files / 2,703 tests), `build`, `git diff --check`   | All passed                                                                            |
| `npm run test:verify-runner`                                                            | 28/28 passed (selection tests updated; 52 runnable and 6 unsupported pairs in `full`) |
| `npm run verify:browser -- --list`                                                      | 29 drivers; smoke = `vowel-alignment`, `contiguous-selection`, `bundled-example`      |
| `npm run verify:browser -- --browser both` (legacy smoke)                               | 5 passed, 1 expected unsupported (`vowel-alignment` Firefox); 62.5 s wall clock       |
| `npm run test:e2e`                                                                      | 169 passed, 1 skipped (the Chromium-only IME test in Firefox), 44.1 s                 |
| `npx playwright test local-persistence document-title document-header --repeat-each=10` | 470 passed, 10 skipped (the same test), 0 failed, 0 flaky (2.4 min)                   |

No intermittent failure appeared in these runs.

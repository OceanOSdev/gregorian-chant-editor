# PR #65 review follow-up and storage investigation

Follow-up to the owner-scoped static Giga Review at `a1228fb`. All eleven
should-fix findings were verified against the source and addressed. None is
disputed. Finding 6 is a preventive exhaustiveness defect, not a currently
reachable wrong glyph among the three supported forms. Optional suggestions
were limited to directly related correctness and verification wording.

## Findings and evidence

| Finding                        | Resolution                                                                                                                                                                         | Regression / evidence                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Negative inclinatum bearing | Translate the unchanged 14×20 diamond silhouette to x=0…14, with its true note/lyric centre at x=7. Existing default contours remain unchanged.                                    | Actual `layoutChant` tests force lyric rebuilds and assert 5-unit word, 1-unit continuation and 2-unit compact ink clearances; rebuilding at resulting ink x reproduces the same path.                |
| 2. Form-aware announcements    | Both tool arming and successful placement use the visual entry name.                                                                                                               | Four-form announcement matrix plus real-browser assertions for Virga, Punctum inclinatum and both Quilisma figures.                                                                                   |
| 3. Stale errors after mutation | Clear `noteFormError` at the shared outer reducer boundary whenever the committed document changes, including early-return paths.                                                  | Insert, division, clef, title, form, lyric commit, undo/redo tests; browser rejected-delete → native I → undo sequence. No-op identity remains exact.                                                 |
| 4. Misleading pitch guidance   | Only form-constrained deletion carries `formDeletionNoteId`. Invalid pitch movement retains the existing contour rejection behavior and never suggests removing a form.            | Validity/no-op comparison with and without the override; browser invalid pitch move checks no form-error banner.                                                                                      |
| 5. Duplicate entry naming      | One `entryName(kind, form)` beside `neumeName` serves the editor, clef controls and announcements.                                                                                 | Naming/announcement matrix; identical title casing for both Quilisma figures.                                                                                                                         |
| 6. Fall-through form dispatch  | Explicit form switch with a `never` check dispatches separate figure builders. Unsupported kinds/combinations reject instead of falling through or ignoring another authored note. | Strict production TypeScript build, complete command whitelist matrix, and existing geometry suites; widening the form union without handling a case fails the exhaustive check.                      |
| 7. Stale roadmap               | Limitations now state v3 writes and v1/v2/v3 reads.                                                                                                                                | Owning persistence wording also explicitly includes v3 modifiers and all three alignment readers.                                                                                                     |
| 8. Ineffective v2 upgrade test | Use Quilisma for the actual v2 fixture's lower Podatus, Virga for v1 Punctum. Assert a changed document, intended form and the exact original cache key on both read/write.        | Both actual-source cases pass and round-trip the changed v3 score.                                                                                                                                    |
| 9. Weak wrapping assertion     | Keep the mixed-event test as an accurately named metadata/order smoke test; add a width-sensitive measured-lyrics case.                                                            | Twelve authored diamonds put only n0…n9 on the first system; default squares put n0…n10 there. Advances are 47 versus 45, and widths 14 versus 12. Ignoring authored geometry fails these assertions. |
| 10. Existence-only ghost check | Compare actual ghost and committed path command sequences in ink-local coordinates, not outerHTML existence.                                                                       | All four figures match up to translation in Chromium and Firefox; ordinary square/unmarked ghosts would differ.                                                                                       |
| 11. Weak keyboard check        | Assert the second inserted neume's kind and authored form after native I. State tool-selection scope accurately.                                                                   | Tool activation uses native pointer input, figure selects/focus use DOM APIs, then native I inserts. No keyboard-only palette activation is claimed.                                                  |

Directly related suggestion 20 is also addressed: browser measurements now
compare x as well as y/width/height, and each first isolated figure must begin
at the known layout input x=144. The latter independently detects a negative
bearing rather than deriving the expected position from the ink itself.
[Updated Chromium](ink-chromium.json) and [Firefox](ink-firefox.json) measurements
and the [refreshed comparison boards](implementation.md#rendered-comparisons)
are retained. Broader component, tuple-helper and profile-table refactors were
not undertaken. No new ADR or semantic fields are required.

## Independent local-storage investigation

**No unexpected loss of successfully committed data was reproduced** in the
ordinary tested sequences. This does not establish that an intermittent problem
cannot occur, and no cause is assigned to the owner's unisolated observation.
No speculative storage implementation change was made.

Fresh Chromium and Firefox profiles were created specifically for these tests.
No existing user profile, cache or other user data was cleared or overwritten.
An actual Stage 8A v2 build from `56816a4` and the current v3 build were served
read-only at one test-only origin, port 4255, distinguished by `?build=v2` and
`?build=v3`. This tests real old/new application behavior, not just changing an
envelope number. Normal production-preview regressions used separate port 4254.

Both browsers passed these scenarios:

1. Load actual v2 bytes without rewriting; commit a mora edit using the real
   v2 app, then refresh and recover exactly those v2 bytes.
2. Open the v3 app against that cache without hydration writes; commit Virga
   to the same note, preserving mora and IDs, then immediately refresh into v3.
3. Reopen the resulting cache in the actual v2 app. It rejects the v3 schema,
   shows **Not saved** and original-source recovery, and blocks attempted edits
   from overwriting the original v3 bytes. Reopening v3 recovers them normally.
4. Open two actual v3 app tabs. A form commit in one produces **Not saved /
   another tab** in the other. Blocked local edits leave the other tab's bytes
   unchanged; refreshing recovers them and restores **Saved locally**. A reverse
   write produces the same protection in the second tab.
5. Perform twelve successive form commits with a cache read in the same JS task
   as each change dispatch, followed immediately by navigation/refresh. Exact
   bytes and the expected forms persist; the recovered UI says **Saved locally**.
6. Inject a `QuotaExceededError` only into the disposable page's storage writer.
   The edit reports **Not saved**, previous cache bytes remain intact, and refresh
   recovers only the last successful commit. This is a controlled failure probe,
   not evidence of a naturally occurring quota failure in the owner's browser.

[Chromium investigation output](storage-chromium.json) and
[Firefox investigation output](storage-firefox.json) retain the actual results.
The existing full local-persistence browser regressions also pass in both
browsers, covering title drafts, pending workflows, replacement confirmations,
source download bytes, corruption, failures and conflict feedback. Their driver
now accepts explicit preview/CDP URLs so isolated profiles and ports can be used.

The tested v2 rejection, multi-tab conflict and injected writer failure are
intentional, visible safeguards; they must not be described as a demonstrated
autosave defect. Uncommitted drafts also retain their documented save boundary.
Further owner reproduction details remain useful. Truly simultaneous cross-tab
writes remain subject to localStorage's existing lack of atomic compare-and-set.

### Reproduce safely

Build the baseline separately without switching or modifying the current tree:

```sh
mkdir -p /tmp/chant65-v2-source
git archive 56816a4 | tar -x -C /tmp/chant65-v2-source
ln -s "$PWD/node_modules" /tmp/chant65-v2-source/node_modules
(cd /tmp/chant65-v2-source && npm run build)
npm run build
node docs/verification/note-shapes/storage-review-server.mjs /tmp/chant65-v2-source/dist
```

Launch **new disposable profiles** with Chromium/CDP on 9250 and Firefox/BiDi
on 9251. Never point this investigation at a normal user browser/profile. The
driver refuses to replace an existing cache at its test origin. Run:

```sh
CHANT_CHROMIUM_URL=http://127.0.0.1:9250/json node docs/verification/note-shapes/storage-review.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9251/session node docs/verification/note-shapes/storage-review.mjs
```

Each emits a fresh temporary output directory. Repeated independent runs need
new disposable profiles; the final extreme-pitch fixture is deliberately left
in its test cache so its refresh behavior can be inspected. The comparison
server never writes app storage or modifies either source/build.

## Separate extreme-pitch finding

The pre-existing viewBox issue is **reproducible in both actual builds and both
browsers**. A valid note at `Number.MAX_SAFE_INTEGER`, with `mora: 1` in v2 or
`form: 'virga'` in v3, produces a viewBox height of approximately
`1.080863910568919e17` score units. Chromium caps the physical SVG around
33,554,432 CSS pixels; Firefox was around 17,895,000 CSS pixels in these runs.
The original cache and exact semantic pitch survive refresh. New remains
reachable/enabled; this is loss of a usable score view, not loss of stored data.

A focused rendering follow-up is warranted: agree on bounded viewport expansion
and a usable out-of-range display policy while preserving the accepted semantic
pitch range and native readers. Simply rejecting or changing the persisted pitch
would violate compatibility, and inventing a new display policy here would exceed
the owner-scoped review fixes. No clamp or semantic workaround was added in this
follow-up. The actual measurements are in the investigation JSON above.

## Verification and remaining limits

- `npm run format:check`, `npm run lint`, `npm test` (72 files / 1,530 tests),
  `npm run build`, and `git diff --check` passed.
- Strengthened authored-form and existing local-persistence browser drivers
  passed in Chromium and Firefox against a **local preview of the production
  build** using `/gregorian-chant-editor/` on port 4254.
- The independent actual-build storage/extreme-pitch investigation passed in
  both disposable browsers at its separate origin.
- Existing Stage 8A modifier browser regressions also passed in both browsers.

Native select/file choices use DOM events; native pointer activation and I
insertion are separately exercised. Foreground OS dialogs, browser-menu zoom,
IME, spoken screen-reader behavior and owner contour acceptance remain pending
as in the original [manual checklist](implementation.md#owner-manual-acceptance-checklist--pending).
No hosted deployment or complete keyboard-only palette flow is claimed.

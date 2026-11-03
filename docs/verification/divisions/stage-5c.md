# Stage 5C verification and owner acceptance

**Stage 5C verification milestone complete with qualitative owner acceptance
(2026-11-02).** The owner reported successful foreground Firefox division
workflows and no issues requiring fixes before merge. Individual checklist
results and environment details were not supplied; no boxes have been checked
on the owner’s behalf. See the [owner checklist](owner-acceptance.md).
The [Stage 5B record](README.md) retains historical evidence.

## Scope and environment

Codex verification date: 2026-11-02. Branch:
`feat/stage-5c-division-acceptance`, implementation baseline
`659271154b63b7a48a0c0713756814cdcd62f2ea` (the final PR commit contains the
checklist, documentation corrections and targeted browser assertions).
Pop!_OS 24.04 LTS, Linux 6.17.9-76061709-generic, Node 24.12.0,
Chromium 156.0.8078.47 snap and Firefox 146.0. Both browsers run **headless**
with fresh temporary profiles. Vite serves port 5173; CDP uses 9230 and Firefox
BiDi uses `ws://127.0.0.1:9234/session`. Drivers mount the real StrictMode editor.
Generated screenshots remain in system temporary directories; no new committed
image fixtures or browser dependencies were needed.

Browser startup and local debugging connections required sandbox escalation.
An initial overlapping Chromium division/lyric-move invocation interfered with
the shared tab; those failures are invalid evidence, not product regressions. Initial isolated
keyboard activation failures led to the CDP payload correction and the Firefox
limit described below.
Final runs must be sequential within each browser, as documented below.

## Coverage audit

The final column identifies evidence not itemized in the qualitative owner
report; it does not negate that acceptance or claim these scenarios failed.

| Owner workflow                           | Existing automated evidence                                                                   | Owner evidence not itemized                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Four forms, persistent placement, Escape | Division driver ghosts/tools; pure glyph geometry                                             | Recognizability, minima/minor proportions, end placement feel    |
| Kind/delete/history and unchanged lyrics | Division driver ID/order/history; pure semantic structural sharing                            | Readability and word/anchor continuity during ordinary editing   |
| Before/after, adjacent and trailing bars | Division driver pointer/caret, explicit sides, edge fixtures; pure slots                      | Foreground keyboard traversal, perceived caret clarity           |
| Words, syllables and melismas            | Pure division layout and command invariants; measured browser bar/lyric clearance             | Ordinary lyric entry before/after punctuation, readable phrasing |
| Wrapping and oversized text              | Pure bounded progress; driver outgoing marks, 320px and scrolled pointer sides                | Typical long syllables, visual line-end quality                  |
| Focus, shortcuts, drafts                 | Division driver Tab/delete/reflow; lyric-entry/move drivers; pure dirty-draft division guards | Foreground focus, native popup and recovery usability            |
| Width and zoom                           | 320px viewport assertions and 150% CSS zoom                                                   | Actual browser zoom 80/100/125/150%, usable target sizes         |
| Reference engraving                      | Existing documented geometry recipes and reference basis                                      | Owner comparison to a representative score                       |

The targeted addition to `browser-check.mjs` focuses the native kind select,
then uses native Tab to each explicit side button in both browsers. Chromium
also uses Enter to insert and checks score order and Undo at desktop and 320px.
The prior explicit-button test used pointer clicks. Chromium CDP Enter now
includes its character payload to activate native HTML buttons. Firefox BiDi
Return/Enter changed no content on the focused HTML button in this headless
session (both key codes were tried). Firefox activation is explicitly skipped
in the new case; its existing pointer-button coverage remains. This is an
unresolved automation/foreground verification limit, not a passing keyboard
activation claim or an established application regression. DOM focus setup is still
synthetic; this verifies native traversal/activation from that setup, not a
complete foreground keyboard session. Existing pure and browser seams already
cover the other high-risk behaviors; no broader fixtures or feature changes
were justified. No application regression or ADR conflict was established.
ADRs 0011/0012/0013 and layout policies remain unchanged; no new ADR is warranted.

## Codex automated checks

Results are scoped to this branch on the date above:

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm test`: 48 files / 881 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Codex browser-driver checks

With `npm run dev -- --host 127.0.0.1` running, start Chromium headless with
`--remote-debugging-port=9230` and a fresh temporary `--user-data-dir`.
Start Firefox headless with an initialized temporary `--profile` directory,
`--no-remote --remote-debugging-port 9234`. Run each browser's commands sequentially.

```sh
node docs/verification/divisions/browser-check.mjs
node docs/verification/continuous-lyrics/browser-check.mjs
node docs/verification/lyric-move/browser-check.mjs
node docs/verification/vowel-alignment/browser-check.mjs
node docs/verification/lyric-spacing/browser-check.mjs
node docs/verification/word-composition/browser-check.mjs
CHANT_CORPUS=1 node docs/verification/word-composition/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session node docs/verification/divisions/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session node docs/verification/word-composition/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session CHANT_CORPUS=1 node docs/verification/word-composition/browser-check.mjs
```

All seven Chromium commands above passed. Both Firefox division and
word-composition commands passed within the stated scope; the Firefox corpus
also passed. Each corpus completed 47 cases with no invariant errors. The
additional Firefox rendering command below passed native pointer selection,
contained selection background and unchanged geometry at desktop/320px/150%
CSS zoom:

```sh
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session node docs/verification/lyric-spacing/selection-cue-firefox.mjs
```

Chromium-only lyric drivers are
not claimed as Firefox runs. The division kind selector is changed with a DOM
event, not an OS dropdown interaction. Composition/paste guard assertions in
the lyric driver use synthetic events and do not establish foreground IME.
Corpus invariant measurements and screenshots do not establish musical taste.

## Owner foreground acceptance and remaining limits

On 2026-11-02, the owner reported manually testing the Stage 5C division
workflows in foreground Firefox: everything tried appeared to work as expected,
and no issues were encountered that needed fixing before merge. At the owner’s
request, this is recorded as **qualitative owner acceptance** and completion of
the Stage 5C verification milestone.

The report does not identify individual scenarios, Firefox version, operating
system, viewport, display scaling, zoom levels, reference score or exact tested
commit. The Codex headless environment above must not be attributed to the
owner. No individual checklist item is marked Passed. In particular, the report
does not separately establish native dropdown operation, explicit button Enter
activation, narrow-screen usability or actual browser/OS zoom coverage. The
Firefox headless activation limitation remains recorded; qualitative acceptance
does not turn that skipped automated assertion into a pass.

- Spoken screen-reader testing: **Not run**.
- Foreground IME testing: **Not run**.
- Itemized foreground scenarios and environment/zoom details: **Not supplied**.
- Codex foreground manual testing: **Not run**; browser-driver results remain
  headless evidence.

Small responsive notation remains an existing limitation; no zoom redesign,
publication-quality engraving claim or comprehensive accessibility verification
is implied. No additional pre-merge fix was requested by the owner. PR #49
remains subject to review and the owner’s merge decision; no merge was performed.

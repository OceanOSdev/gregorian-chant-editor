# Stage 4D verification and owner acceptance

Status: verification delivered for review; **owner acceptance pending**.
This report is current evidence, not an assertion that all Stage 4 acceptance
criteria passed. Historical Stage 4A–4C records retain their original results.

## Revision and environment

Tested 2026-11-02 by Codex, from handoff `af13fe8c4fb8c823bcec6515189c258ee4be9b3f`
(Stage 4C baseline `46b1d59`), with the driver changes committed in `a53bfed`. No application
source or engraving policy changed. Pop!_OS 24.04 LTS, Linux
6.17.9-76061709-generic; Chromium 156.0.8078.47 snap and Firefox 146.0,
both headless with fresh temporary profiles. Node 24.12.0 was installed;
`.nvmrc` requests 24.18.0, so that exact Node version is **Not run** locally.
Browser drivers mount the real StrictMode React editor via the existing Vite
fixture, using native CDP/BiDi input plus explicitly scripted DOM inspections.
Default browser zoom was 100%; the spacing drivers additionally use 150% CSS
zoom (not browser chrome zoom). Desktop is 1440px; narrow is 320px.

## Coverage audit and current results

Pass means the named automated assertions completed, not human acceptance.
All browser rows below are real browser automation, separate from pure tests.

| Behavior / coverage source                                                                                                    | Pure coverage                                                         | Chromium                                                                                    | Firefox                                                           | Foreground human         |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------ |
| Latin/English/Greek/unspecified, accents, combining graphemes, overrides                                                      | `lyric-alignment`, `update-lyric-alignment`                           | Pass: vowel driver, including manual ranges/history/dirty draft                             | Not run: interactive language workflow                            | Not run                  |
| Measured ink/advance, wrapping, partial metrics, exceptional overhang                                                         | `lyric-spacing`, `multi-system-layout`                                | Pass: spacing driver, left/right/both overflow, local scrolling, scrolled pointer insertion | Not run: full overflow/input driver                               | Not run                  |
| Eight words × five arrangements, auditione controls, et/lux (47 cases)                                                        | `word-corpus`, `et-lux`, `word-composition`, `rendered-continuations` | Pass: desktop, 320px, real DejaVu Sans substitution                                         | Pass: desktop, 320px, real DejaVu Sans substitution               | Not run                  |
| Conditional/outgoing marks, true boundaries, melismas, near-edge reservation                                                  | same suites                                                           | Pass: composition driver                                                                    | Pass: composition driver                                          | Not run                  |
| All seven compact kinds, each constituent, Shift whole-neume selection, clipped selection/placement/move cues                 | geometry/ownership/preview suites                                     | Pass: composition driver at desktop/320px                                                   | Pass: composition driver at desktop/320px                         | Not run                  |
| Continuous lyrics, `_`, occupied anchors, L, native character deletion, focus vs selection, focused deletion, history prompts | `syllable-workflow`, `editor-session`, keyboard suites                | Pass: continuous driver                                                                     | Not run: foreground focus limitation remains                      | Not run                  |
| Move preview/commit/cancel, selected vs focused targets, legal/rejected destinations, history/reflow                          | `lyric-move`                                                          | Pass: repaired move driver                                                                  | Not run                                                           | Not run                  |
| Font readiness/invalidation, focused ID after reparenting, history after reflow                                               | alignment/spacing/session suites                                      | Pass: spacing driver (simulated loading events plus real alternate font)                    | Pass: real alternate-font corpus geometry; focus recovery not run | Not run                  |
| Lyric role/name/state/instruction references, semantic DOM reading order, inert punctuation                                   | label/description helpers; new corpus DOM assertions                  | Pass across corpus matrix                                                                   | Pass across corpus matrix                                         | Not run                  |
| Selection background at desktop/320px/150% CSS zoom                                                                           | spacing geometry                                                      | Pass: spacing driver                                                                        | Pass: selection-cue driver; document focus false                  | Not run                  |
| Score summary, note names/selected state, live messages                                                                       | accessible helper/session tests                                       | Pass: existing workflow assertions; no complete accessibility-tree audit                    | Not run: complete accessibility-tree audit                        | Not run                  |
| OS Tab/focus, keyboard traps, browser zoom, speech, actual IME                                                                | guard logic only                                                      | Not run: foreground                                                                         | Not run: foreground                                               | Not run; checklist below |
| Repeated long-score editing / sustained performance                                                                           | bounded progress/repeated layout tests                                | Not run: sustained stress profiling                                                         | Not run                                                           | Not run                  |

The initial `format:check` failed solely on the committed 4D plan's formatting;
Prettier corrected it. Lint, all **46 files / 847 tests**, and production build
passed. Final formatting and whitespace checks are recorded in the PR.

The Stage 3 browser driver reproducibly failed at its obsolete caption assertion
`Selection (purple outline): ri`. Current UI says `Selection (purple cue): ri`,
consistent with the accepted background treatment. Corrected that expectation
and supplied explicit Latin on its document fixture; the full driver then passed.
This was a coverage maintenance defect, not a production engraving regression.

Added focused assertions to the existing corpus driver: every semantic syllable
renders once in order, as an initially unpressed tabbable named button with
resolved instructions; generated hyphens stay hidden, pointer-inert and without
interactive roles/tabindex. These run against actual rendered DOM in both
browsers. They do not establish speech or native foreground focus behavior.
No new framework, dependency, ADR, threshold or production fix was needed.

## Reproduction

Use the repository's installed dependencies (`npm ci` for a clean install) and
start `npm run dev -- --host 127.0.0.1`. In separate terminals:

```sh
chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=9230 --user-data-dir=/tmp/chant-4d-chromium about:blank
mkdir -p /tmp/chant-4d-firefox
firefox --headless --no-remote --profile /tmp/chant-4d-firefox --remote-debugging-port 9234 about:blank
```

Use fresh profile directories for a new run. Run each browser's drivers
sequentially because they share its tab and ports. Node requires built-in fetch
and WebSocket. Run from repository root:

```sh
npm run format:check
npm run lint
npm test
npm run build
git diff --check
node docs/verification/continuous-lyrics/browser-check.mjs
node docs/verification/lyric-move/browser-check.mjs
node docs/verification/vowel-alignment/browser-check.mjs
node docs/verification/lyric-spacing/browser-check.mjs
node docs/verification/word-composition/browser-check.mjs
CHANT_CORPUS=1 node docs/verification/word-composition/browser-check.mjs
CHANT_CORPUS=1 CHANT_CORPUS_WIDTH=320 node docs/verification/word-composition/browser-check.mjs
CHANT_CORPUS=1 CHANT_CORPUS_FONT=sans node docs/verification/word-composition/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session node docs/verification/word-composition/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session CHANT_CORPUS=1 node docs/verification/word-composition/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session CHANT_CORPUS=1 CHANT_CORPUS_WIDTH=320 node docs/verification/word-composition/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session CHANT_CORPUS=1 CHANT_CORPUS_FONT=sans node docs/verification/word-composition/browser-check.mjs
CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session node docs/verification/lyric-spacing/selection-cue-firefox.mjs
```

Do not count `CHANT_BASELINE=1` or `CHANT_CORPUS=diagnostic` as passing tests.
Earlier placement, syllable and Stage 1 anchor drivers still target superseded
controls/models; they are historical scenario inventories, not current passes.

## Editorial evidence and limitations

Selected fresh screenshots are review evidence, never golden comparisons:
[Firefox words](review/firefox-words.png),
[Firefox outgoing continuation](review/firefox-outgoing.png),
[Firefox compact selection at 320px](review/firefox-compact-320.png),
[Chromium two-sided overflow at 320px](review/chromium-overflow-320.png),
[Chromium selection at 150% CSS zoom](review/chromium-selection-zoom.png).
Codex inspected these actual images. Words and outgoing marks remain distinct;
compact selection is contained; exceptional text uses local scrolling. A viewport
capture cannot show the entire oversized text at once; the scrolling assertions
check edge reachability. Ordinary scores scale down at 320px and remain small;
owner usability review is pending. Font substitution changes joins/hyphens
(Firefox desktop default corpus: 76 joins/40 hyphens; Chromium: 77/39; Sans in both: 85/31), as intended from
measured geometry. Both retain 9 outgoing and 17 true-word boundaries.

Full screenshots/JSON/HTML were generated in temporary storage; representative
runs: `/tmp/chant-lyrics-clxLZU`, `/tmp/chant-lyric-move-34s9vM`,
`/tmp/chant-vowel-alignment-BBVhwy`, `/tmp/chant-lyric-spacing-PDZ6Rx`,
`/tmp/chant-word-composition-PfnJl9` (Chromium targets),
`/tmp/chant-word-composition-rumBsV` (Firefox targets),
`/tmp/chant-word-composition-DlmQ43`, `D3QgKm`, `4FSElb` (Firefox corpus
normal/narrow/Sans; latter two share the same directory prefix).
Chromium corpus runs: `/tmp/chant-word-composition-LyTws6`,
`/tmp/chant-word-composition-r3u6Ki`, `/tmp/chant-word-composition-Iv7wIN`.
Firefox selection-cue run: `/tmp/chant-firefox-selection-kZwNLw` (Pass;
`document.hasFocus()` false). Temporary paths are diagnostic provenance,
not durable links.

No foreground manual interaction was performed. Orca is installed locally, but
this verification used headless browser sessions and did not drive a foreground
assistive-technology session or hear speech. **Screen-reader testing: Not run**.
No WCAG or comprehensive accessibility claim is made. Complete browser
accessibility-tree inspection and sustained performance profiling are also
unverified. Automated focus checks in Chromium do not close those gaps.

## Foreground Firefox owner checklist

Run `npm run dev` and keep an ordinary **foreground** Firefox window active.
Record each numbered scenario as Pass / Fail / Not run, with reproduction for
failures. All foreground results remain **Not run** until the tester records them.

Tester/date: **pending**. OS / Firefox version: **pending**.
Viewport / browser zoom / fonts / screen reader and version: **pending**.

### Setup and resets

The default app at `http://127.0.0.1:5173/` has **only Al, one punctum and one
torculus**. Use it for scenario 1 only. The other scenarios use existing corpus
fixtures in the same real editor; they do not change the default document.

Open `http://127.0.0.1:5173/docs/verification/placement/browser-fixture.html`
(initially blank). Open Firefox's Web Console (Ctrl+Shift+K on Linux/Windows),
paste this setup once, and press Enter:

```js
window.load4d = async (arrangement = 'two-words', variant = '') => {
  const { compositionCorpus } =
    await import('/docs/verification/word-composition/corpus.ts');
  const sample = compositionCorpus.find(
    (s) => s.name === 'Alleluia' && s.arrangement === arrangement,
  );
  const document = {
    ...sample.document,
    syllables: sample.document.syllables.map((s) => ({ ...s })),
  };
  if (variant === 'empty') document.syllables = [];
  if (variant === 'accent') document.syllables[0].text = 'a\u0301e';
  if (variant === 'overflow') document.syllables[0].text = 'b'.repeat(160);
  mountChantFixture(document);
};
await load4d();
```

Close the console and wait for the score. If Firefox blocks pasted code, type
it or follow Firefox's own paste instructions only after reviewing it. For each
**reset** below, reopen the console, enter the given `await load4d(...)` command,
and close it. Reset discards edits/history and starts in Select with **nothing
selected and no lyric draft**. Do not reload this fixture page: reload clears the
helper and requires setup again. Adjust the URL if Vite prints a different port.

| Reset command                           | Starting score; neumes numbered from 1 in musical order                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `await load4d()`                        | Seven puncta; Al/le/lu/ia/gre/gar/io on 1–7. Al and gre start words, all others continue: **Alleluia gregario**.        |
| `await load4d('break')`                 | Fifteen puncta across systems; Al on 1, le on 13, lu on 14, ia on 15. Only Al starts a word; 2–12 are unanchored music. |
| `await load4d('break', 'empty')`        | The same fifteen puncta, no syllables.                                                                                  |
| `await load4d('wide')`                  | Al/le/lu/ia on Podatus/Clivis/Scandicus/Torculus; only Al starts a word.                                                |
| `await load4d('two-words', 'accent')`   | Seven-punctum score above, with Al replaced by áe (two graphemes).                                                      |
| `await load4d('two-words', 'overflow')` | Seven-punctum score above, with Al replaced by 160 b characters; exceptional local overflow.                            |

Console use is **fixture preparation only**, not keyboard/focus evidence. During
tests, close DevTools and use actual clicks and natural Tab/Shift+Tab; never
DevTools `.focus()`. Returning from the console can alter initial focus, so each
scenario specifies how to start.

### Scenarios

1. **Default navigation:** open the default app (not the fixture). At about
   1440px / 100% zoom, focus the address bar and Tab through controls and score;
   Shift+Tab back. Palette arrows browse; Enter opens Keyboard help. Check visible
   focus, no trap and no accidental edits. Only Al is expected here.
2. **Focus versus selection:** reset `await load4d()`. Click engraved Al, Tab to
   engraved le without Space: purple selection stays Al, blue focus/panel names
   le. Shift+Tab reverses. Press Space to select le and Enter to edit; Escape
   exits. Reset before **each** destructive check: click Al → Tab to le → Delete
   (then repeat with Backspace); only le disappears, music survives, Undo restores
   it. Reset again, click Al → Tab to le, then click **Delete selected syllable**:
   Al disappears instead. No history should be added by focus browsing alone.
3. **Text, IME and history:** reset `await load4d()`, click le → L. Use caret
   arrows, type l, and Delete/Backspace within the input; these edit characters,
   not score entities. Try accents and your actual IME if used. Escape cancels
   and exits. For **each** Save/Discard/Cancel history check, reset, click le → L,
   replace its text with `lé`, click **Save syllable** (creates history), click engraved lé → L, change draft to `lu`, then click score **Undo**. Test each choice:
   Cancel retains the draft; Discard navigates without saving lu; Save records
   the draft before navigation (Redo can restore lu). Use score buttons rather
   than native input undo. Check visible focus and atomic history.
4. **Entry and boundaries:** reset `await load4d('break', 'empty')`. Click the
   first note → L. Type `Al`, minus, underscore (empty draft skips note 2), then
   type `le-lu-ia ah` **one key at a time**, and Enter. Expect Al/le/lu/ia/ah on
   notes **1/3/4/5/6**, with only Al and ah starting words. Escape; click le →
   Enter, change **Word boundary** to Starts word, save, then undo/redo; repeat
   with Continues word. For occupied protection, reset `await load4d()`, click
   Al → L → End → minus: it pauses at occupied le without replacing it; use
   **Edit syllable** deliberately, then Escape. Verify undo/redo restores committed
   entry text/boundaries and surviving entity selection/focus.
5. **Move across systems:** reset `await load4d('break')`, click le → **Move
   syllable**. Notes 2–12 are legal; Al on 1 and lu on 14 are unavailable. Click
   those unavailable notes to check rejection, then browse legal destinations
   with Left/Right or Previous/Next destination. Tab/Shift+Tab traverses controls
   without changing selection; Escape cancels. Reset and repeat; preview **note
   2 on the first system**, then Enter with score focus (or Move here) to commit
   le from the later system. Check visible restored lyric focus and one-step
   undo/redo. Reset and repeat with a direct click on note 2 to commit.
6. **Music and compact targets:** for each of the seven palette kinds, reset
   `await load4d()`, click that kind, inspect the hover preview over the staff,
   click once to place, then Escape to Select. Click a new constituent to select;
   Shift+click selects its whole neume. Up/Down moves a valid pitch/whole neume,
   Delete removes the selected note/neume; Undo each edit. Reset between note
   and whole-neume deletion. Then reset `await load4d('wide')` and click each
   constituent near compact boundaries: verify the intended target, contained
   selection and inert decorations. For a reflow repeat, click le → Enter, replace
   its text with `misericordiam` repeated six times without spaces, save, exit
   Lyrics with Escape, then repeat constituent selection on the reflowed music.
7. **Language and graphemes:** reset `await load4d('two-words', 'accent')`, click
   the first lyric áe. Change Latin/English/Greek/Unspecified; select/reset its
   manual two-grapheme range in the alignment controls. Finish by applying an
   override for only the first grapheme (á). Click áe → Enter to edit;
   replace text with `Deo`, save, and check the override resets; Undo restores
   text and range. For font-load/reflow recovery, keep this selection and change
   Firefox's default serif font in Settings → Fonts (disable page-chosen fonts
   if necessary), return to the tab and inspect the reflow without reloading.
   Restore font settings afterward; if no font change occurs, record Not run.
   Font changes must not create score history or lose entity selection.
8. **Narrow usability (explicit owner decision):** reset `await load4d('break')`.
   At a 320px viewport, then at real browser zoom 150–200%, repeat Tab/edit/move
   on le: click Al → Tab to le for focus/selection, Enter → Escape for editing,
   then click le → Move syllable and use scenario 5. Record viewport and zoom separately;
   Firefox Responsive Design Mode can set 320px if needed (leave its controls
   before traversing the page). Are ordinary score text, targets and controls
   actually usable despite passing geometry checks? Check later-system focus
   reveal and no page-wide overflow. Reset `await load4d('two-words', 'overflow')`;
   scroll the score locally to both text edges, select/place at a visible note
   while scrolled, Escape and Tab back to a lyric. Verify visible focus/cues and
   reachable text. Accept or reject narrow usability explicitly.
9. **Editorial review:** reset `await load4d()` for joined Alleluia and the true
   space before gregario; `await load4d('wide')` for musically forced separation;
   `await load4d('break')` for outgoing continuation to le on a later system.
   Check legibility, ownership and no extra incoming mark. Review the linked
   corpus screenshots as additional evidence, not manual interaction results.
10. **Spoken accessibility:** reset `await load4d()` with Orca or your screen
    reader running in the foreground. Repeat scenario 2 and le's edit from 3;
    reset `await load4d('break')` for move/rejection from 5. Record actual spoken
    names, roles, selected state, instructions, score totals, reading order and
    live edit/error/undo announcements. Hyphens/ghosts/cues must not add spoken
    syllables or tab stops. If no screen reader is used, record **Not run** and
    explicitly accept or defer that risk. DOM assertions do not verify speech.

### Checklist setup validation (review follow-up, 2026-11-02)

Codex ran the exact setup snippet above and all six reset commands in real
**headless Firefox 146.0** through BiDi. Automated DOM inspection confirmed the
default app's one lyric/two neumes, each fixture's stated music and lyric counts,
initial unselected lyrics/no draft, and Al on system one with le on system two
in the break fixture. These checks validate preparation, **not** console paste
policy, natural foreground focus, completion of the manual scenarios or speech.
Formatting, lint, 847 pure tests, production build and whitespace checks passed
again for this documentation follow-up. No application or fixture source changed.

## Owner decision and cleanup proposal

- [ ] Record foreground Firefox results above (currently all Not run).
- [ ] Record actual screen-reader results or explicitly accept the untested risk.
- [ ] Record explicit acceptance/rejection of narrow text/target/control usability
      (scenario 8); review visual evidence and any reproduced failures.
- [ ] Accept Stage 4D, or request scoped fixes; CI alone is not acceptance.
- [ ] At acceptance, retire `docs/plans/lyric-system-redesign.md` and mark the
      overarching Stage 4 plan complete (or remove obsolete one-off handoffs).

Retirement is intentionally pending acceptance. Durable contracts already live
in ADRs 0002/0003/0004/0007–0011 and the domain, commands/history, interactions,
layout and architecture guides. No accepted decision needs to be kept alive
solely by deleting or retaining a plan. Historical research and evidence stay.
Auditione `auditi-óne` vs reference `audi-ti-óne` and within-syllable repeated
punctum spacing in `et(hh)` remain deferred; neither is a Stage 4D failure.

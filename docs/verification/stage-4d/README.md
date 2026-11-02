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

Run `npm run dev`, open `http://127.0.0.1:5173/` in an ordinary **foreground**
Firefox window, and keep that window active. Use the default example first.
Record each row as Pass / Fail / Not run, with reproduction for failures.
Do not use DevTools `.focus()` as evidence of natural keyboard traversal.

Tester/date: **pending**. OS / Firefox version: **pending**.
Viewport / browser zoom / fonts / screen reader and version: **pending**.

1. At about 1440px and 100% zoom, Tab from the address bar through the editor;
   Shift+Tab back. Palette arrows move within the toolbar. Every visited control
   has a visible focus cue; no trap or unexpected document edit occurs. Open
   Keyboard help with Enter and traverse its next controls normally.
2. Click/select Al, then use Tab to focus le without Space. Confirm purple
   selection remains Al, the blue keyboard cue/panel names le, and history is
   unchanged. Shift+Tab reverses traversal. Space selects the focused lyric;
   Enter edits. Repeat Delete and Backspace with Al selected and le focused:
   only le disappears, music survives, undo restores it. Separately activate
   Delete selected syllable and confirm it acts on Al.
3. Focus a lyric, press L, and edit with normal caret arrows. Type l and use
   native character Delete/Backspace; score shortcuts must not steal input.
   Try accented/combining text and the owner's actual IME if used. Escape exits
   Lyrics to Select without trapping focus. Test Save/Discard/Cancel when undo
   encounters a dirty draft; cancel retains it and each chosen edit is atomic.
4. From a free note activate Lyrics; enter `Al-le-lu-ia ah`, using `_` to skip
   one free neume. Verify Starts word/Continues word, occupied-anchor pause,
   deliberate edit, and cancellation. No accidental replacement of an occupied
   anchor. Undo/redo restores text, boundary and stable selected/focused entity.
5. Select a middle syllable, Move syllable, browse destinations with arrows,
   Tab/Shift+Tab through controls, Escape to cancel, then repeat and Enter or
   click a legal destination. Selection stays on the moving lyric; rejected
   occupied/crossing destinations explain why. Focus returns visibly after
   cancel/commit, including a destination on a later system.
6. Place each of the seven kinds; inspect preview, commit, Escape, Shift whole
   selection, note/neume movement and deletion. At compact boundaries click
   individual constituents; decorations must not steal clicks. Undo each edit.
   Repeat after text/language changes cause wrapping and after a font reload.
7. Change Latin/English/Greek/Unspecified; choose/reset a manual grapheme range,
   including combining accents. Confirm text edit resets the override and undo
   restores it. Font-dependent reflow must not change selection or add history.
8. At 320px and real browser zoom 150–200%, repeat navigation/editing and scroll
   to later systems. No page-wide horizontal overflow; controls remain usable.
   Enter a very long unbreakable syllable, scroll the score both ways, inspect
   both text edges, then click/place while locally scrolled. Check focus reveal
   and cues are visible without obscuring neighboring text.
9. Inspect mixed joined/hyphenated words, real spaces and outgoing marks after
   wrapping. Review the linked 47-case screenshots; use the existing corpus
   driver to regenerate full review boards if needed. Approve good-enough
   composition separately from keyboard results.
10. With Orca or the owner's screen reader running in that foreground window,
    repeat a representative select/edit/move/error/undo flow. Record actual
    spoken names, roles, selected state, instructions, score totals, reading
    order and live edit/rejection announcements. Hyphens/ghosts/cues must not
    become extra spoken syllables or tab stops. If unavailable, mark Not run
    and explicitly accept or defer that remaining risk; DOM checks are not a
    substitute.

## Owner decision and cleanup proposal

- [ ] Record foreground Firefox results above (currently all Not run).
- [ ] Record actual screen-reader results or explicitly accept the untested risk.
- [ ] Review narrow usability, visual evidence and any reproduced failures.
- [ ] Accept Stage 4D, or request scoped fixes; CI alone is not acceptance.
- [ ] At acceptance, retire `docs/plans/lyric-system-redesign.md` and mark the
      overarching Stage 4 plan complete (or remove obsolete one-off handoffs).

Retirement is intentionally pending acceptance. Durable contracts already live
in ADRs 0002/0003/0004/0007–0011 and the domain, commands/history, interactions,
layout and architecture guides. No accepted decision needs to be kept alive
solely by deleting or retaining a plan. Historical research and evidence stay.
Auditione `auditi-óne` vs reference `audi-ti-óne` and within-syllable repeated
punctum spacing in `et(hh)` remain deferred; neither is a Stage 4D failure.

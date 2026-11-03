# Stage 5C owner acceptance checklist

Status: **Pending — owner has not run this checklist.**
All boxes below start **Not run**. Only the owner records foreground results.
Headless driver results are recorded separately in [Stage 5C verification](stage-5c.md).

## Run and record

On `feat/stage-5c-division-acceptance`, run `npm ci` if dependencies are absent,
then `npm run dev`. Open the printed local URL in **foreground Firefox on Linux**.
Use the ordinary editor, not the browser-driver fixture. Keep this page alongside
it; start a fresh page when needed (there is no save/load persistence).
Optional Chromium results should have a separate copy of this checklist.

- Tester / date / tested commit: ____________________
- Browser / version: ____________________
- Linux distribution / desktop: ____________________
- Viewport in CSS pixels / display scaling: ____________________
- Actual browser zoom levels tested: ____________________
- Reference score / page / source: ____________________

For each row, record **Passed**, **Blocked** or **Not run**, plus observations.
Check a box only after personally testing it. Record unexpected behavior with
steps, expected/actual results, viewport/zoom and a screenshot if useful.

## Ordinary editing

Build a short fragment with Punctum and a few other neumes. A useful lyric is
`Ky-ri-e e-le-i-son`: use minus between syllables and Space between words.
Use underscore or Skip neume to leave extra notes in one syllable's melisma.
Choose Done before musical placement. Repeat with lyrics added after bars.

- [ ] **Not run:** Choose each of Minima, Minor, Maior and Finalis in Divisions;
      use Place division between existing neumes and at the end. Hover then
      click: caret and committed position agree, glyphs are recognizable, and
      repeated clicks keep the tool armed. Compare minima/minor proportions.
      Escape and Select return to editing; the remembered neume kind survives.
      Result / observations: ____________________
- [ ] **Not run:** Select a bar, change its kind, delete it, Undo and Redo.
      Its position is stable on kind change; neighboring notes and lyrics
      survive. Verify words and syllable anchors remain attached to the same
      music. Undo restores content; do not expect it to restore old selection.
      Result / observations: ____________________
- [ ] **Not run:** Place a neume directly before a bar, then directly after it.
      Compare the hover caret side with committed order. Repeat between two
      adjacent bars and beside a trailing Finalis. With mouse aside, Tab to a
      bar, Enter/Space to select, then Tab to each explicit Insert before/after
      button and activate it. No hidden default side or keyboard dead end.
      Result / observations: ____________________
- [ ] **Not run:** Add/edit lyrics before and after bars: between words,
      within one syllable's melisma, and between two syllables of one word.
      Read the phrase aloud. Bars must not split words, move anchors, or force
      hyphens solely by being present; measured gaps may warrant a hyphen.
      Log readability concerns separately from content/order failures.
      Result / observations: ____________________

## Wrapping, focus and recovery

- [ ] **Not run:** Add enough neumes for several systems. Place divisions
      near line ends, including a finalis and adjacent bars. Ordinary phrase
      endings should stay with preceding music; inspect collisions, outgoing
      continuation marks and caret sides on later systems. An exceptional long
      run of bars may split for progress; Finalis does not force a line break.
      Result / observations: ____________________
- [ ] **Not run:** Try a fairly long syllable, then one long enough to require
      local horizontal scrolling. Reach both ends, inspect all text/bars, and
      insert on both sides of a nearby division after scrolling. Subsequent
      music still wraps normally and controls remain reachable.
      Result / observations: ____________________
- [ ] **Not run:** Use native Tab and Shift+Tab across score, lyrics, toolbar,
      division selects and before/after controls, also after wrapping. Focus
      browsing must not change selection. Inspect the separate focus/selection
      cues; exercise Enter/Space and Delete/Backspace on focused bars and lyrics.
      Open the native kind dropdown by keyboard. No keyboard trap.
      Result / observations: ____________________
- [ ] **Not run:** On selected notes try pitch arrows, I insertion, T then
      palette arrows/Enter, and L to enter/edit lyrics. Native text keys must
      remain text editing. Undo/Redo musical edits. Leave a dirty lyric draft,
      change a bar kind, then request Undo: try Cancel, Save and Discard paths.
      Confirm the draft is not silently lost. If a preserved-text recovery
      prompt appears, select a free neume and try Retry at selected neume, then
      repeat and Discard. Record how it arose; if unreachable in ordinary
      editing, mark recovery Not run rather than deleting text to simulate it.
      Result / observations: ____________________

## Size and engraving review

- [ ] **Not run:** Inspect normal desktop width and approximately 320 CSS px.
      At actual Firefox zoom 80%, 100%, 125% and 150%, try placement, selection,
      lyrics and controls. Record viewport at each zoom and whether small score
      targets remain usable. CSS zoom automation does not satisfy this check;
      the known small responsive score does not imply a new zoom policy.
      Result / observations: ____________________
- [ ] **Not run:** Compare all four forms and phrasing positions with a
      representative modern Gregorian square-notation score. The existing
      [Gregorio bar reference](https://gregorio-project.github.io/gabc/#separation-bars)
      is a starting point; record the actual score/page used above. Separate
      subjective engraving proportions from reproducible behavioral failures.
      Result / observations: ____________________

## Explicitly unverified modalities

- Foreground IME: **Not run**. If tested, record input method, steps and results: ______
- Spoken screen reader: **Not run** (owner previously declined). No speech
  coverage is inferred from keyboard, DOM or ARIA checks. If tested later,
  record reader/browser versions, steps and actual speech: ______

## Owner decision

Final status: **Pending** (choose Pending / Accepted / Blocked only after review).
Acceptance does not imply IME or screen-reader testing.

- Bugs / reproduction steps / PR comments: ____________________
- Subjective engraving concerns / agreed deferrals: ____________________
- Unrun items and reason / blockers: ____________________
- Owner decision / date: ____________________

Report observations in the Stage 5C PR for follow-up on the same branch.
Merge remains an explicit owner decision.

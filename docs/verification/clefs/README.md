# Stage 6A initial clef verification

The engraving was subsequently revised after owner review. See the
[printed-reference and actual-size refinement comparison](refinement/review.md)
for the current contours and leading spacing. The original screenshots and
results below are retained as historical pre-review evidence.

Date: 2026-11-03. Implementation evidence for the Stage 6A PR; owner graphical
acceptance and Proposed ADR 0014 review remain pending. No Stage 6B/6C feature
is claimed. Current contracts belong to the [domain](../../domain-model.md),
[interaction](../../editor-interactions.md) and [layout](../../layout-and-rendering.md)
guides, and [Proposed ADR 0014](../../adrs/0014-preserve-melody-on-initial-clef-edit.md).

## Reproduction

Start Vite on port 5173 and an isolated headless Chromium with DevTools port 9230. Use Node with built-in fetch/WebSocket:

```sh
npm run dev -- --host 127.0.0.1
chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=9230 --user-data-dir=/tmp/chant-clef-review about:blank
node docs/verification/clefs/browser-check.mjs
```

The driver mounts the existing real StrictMode development fixture and writes
fresh screenshots to a unique system temporary directory. It never refreshes
the selected review images here. `CHANT_EDITOR_URL` overrides the Vite origin.
Browser drivers share a tab and must run sequentially.

## Automated evidence

The pure tests cover all 64 clef pairs, all seven neume kinds, identities,
intervals, outside-staff positions, invalid/no-op exact references and atomic
history, plus session guards, drafts/tools, all eight line/glyph geometries,
wrapped/empty systems and occupied musical clearance. The clearance regression
prevents leftward outgoing-reservation fitting from encroaching on the existing
33-unit separation from clef ink. It does not change word-compaction eligibility
or the relative-pitch rule.

The clef Chromium driver checks desktop 1440px and narrow 320px layouts:

- C/F × lines 1–4, anchored reference lines and actual SVG `getBBox()` versus
  pure occupied bounds, with one interactive initial clef and decorative repeats;
- native pointer selection, line arrows and legal-edge no-ops, Tab without
  selection, modifier guards, Space selection and non-deletability;
- exact rendered +2-step C3→C4 and −3-step C3→F3 displacements;
- semantic toolbar and native keyboard undo/redo, persistent selection/focus,
  and dirty native lyric-draft preservation;
- initial clefs in empty scores, persistent Podatus placement, disabled clef
  pointer/Tab ownership during placement, and Escape back to Select;
- page containment and representative screenshots at both widths.

The native type/line selects are changed by DOM change events. This verifies
React control wiring, not OS dropdown behavior. Other interactions use native
CDP mouse/key input. Independently authored glyph specimens use a midrange
melody under each clef; they are not proof that every transposed extreme pitch
will fit the existing vertical system bounds.

Existing Chromium regressions also run against this branch: divisions,
continuous lyrics, lyric anchor movement, vowel/manual alignment, measured
lyric spacing and word composition. The anchor-move driver initially failed
at its mixed-neume fixture replacement: that direct remount inherited a prior
panel's scroll position, unlike its normal mount helper. Applying the same
explicit scroll reset to that remount restored its actual pointer selection
and the full driver passed. No production lyric behavior was changed for this
verification adjustment.

## Recorded results

After `npm ci`, the standard local gate passed on the declared Node 24.18.0:
`npm run format:check`, `npm run lint`, `npm test` (53 files, 1,029 tests),
`npm run build` and `git diff --check`. No dependency or lockfile changed.
The handoff plan needed mechanical Prettier formatting to pass the gate; its
requirements and Stage 6A scope were unchanged.

All seven standalone Chromium drivers listed above completed successfully.
Those development-browser runs used the already installed Node 24.12.0; the
final install and automated gate used an isolated Node 24.18.0 in temporary
storage. Browser evidence is headless Chromium only. Firefox, foreground manual
interaction and spoken screen-reader checks were not run for Stage 6A.

## Visual review and remaining acceptance

Selected screenshots below are review evidence, not golden images. They show
original simplified square do jaws and the fa clef's added left virga, checked
against the [LilyPond Editio Vaticana examples](https://lilypond.org/doc/v2.25/Documentation/notation/typesetting-gregorian-chant#gregorian-clefs)
and [Gregorio clef conventions](https://gregorio-project.github.io/gabc/#the-clef).
No font asset or third-party outline is shipped.

Owner review against printed chant is still required before merge. Headless
numeric and DOM checks do not establish publication-quality typography,
spoken screen-reader behavior, foreground Firefox focus, OS dropdowns, actual
browser/OS zoom or IME acceptance. These manual checks were **not run** here.
The responsive notation remains small. Ledger lines and general vertical
collision handling are absent; melody-preserving clef changes can expose those
existing outside-staff limitations. Notes are never clamped or silently altered.
There is no clef deletion, mid-score insertion/event ordering or dragging.

The retained specimens below were explicitly selected from the final successful
clef-driver run; temporary diagnostics and earlier runs are not committed.

| Specimen                                             | Review image                      |
| ---------------------------------------------------- | --------------------------------- |
| C3, desktop, repeated systems                        | [C3 desktop](c3-desktop.png)      |
| F3, desktop, repeated systems                        | [F3 desktop](f3-desktop.png)      |
| C4, simultaneous selection and native keyboard focus | [C4 cues](c4-selection-focus.png) |
| F4, narrow 320px editor                              | [F4 narrow](f4-narrow.png)        |

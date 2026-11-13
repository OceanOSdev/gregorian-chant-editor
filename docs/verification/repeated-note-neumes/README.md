# Stage 9A: Bistropha and Tristropha implementation record

Status: implemented on `feature/stage-9a-repeated-note-neumes` (PR #74) under
the committed [plan](../../plans/stage-9a-repeated-note-neumes.md) and
[ADR 0022](../../adrs/0022-explicit-repeated-note-neumes.md). Owner visual and
foreground acceptance remain pending. The original mora reference gate report
(commit `c8bd51c`) is preserved unchanged in substance as
[gate-investigation.md](gate-investigation.md).

## Owner decision

On 2026-11-12 the owner approved **none-only mora** for Bistropha and
Tristropha (gate option 1). This is an initial authoring-scope restriction, not
a claim that historical repeated-note morae are prohibited. It is recorded in
the plan's owner clarification, ADR 0022 and the Stage 9A extension note in
ADR 0018. Every existing mora pattern is unchanged.

## What is implemented

- Explicit `bistropha`/`tristropha` kinds with fixed two/three-note tuples of
  distinct stable IDs at one written staff position; one neume ID and one lyric
  boundary per group.
- Exhaustive mora dispatch (`domain/mora.ts`): both kinds offer only `none`;
  commands and native decoding reject every nonempty subset. The contextual
  note editor disables the mora select with an explanation.
- Independent horizontal and vertical episemata per constituent; no authored
  Virga/Inclinatum/Quilisma overrides.
- Single-note moves that break equality are rejected with no history entry and
  an announcement directing the author to whole-neume movement; whole-neume
  moves transpose the group. That announcement is limited to single-note moves,
  so a rejected whole-group move is not misreported as a unison violation.
- Deleting a constituent normalizes Tristropha → Bistropha → Punctum, keeping
  the neume ID, surviving note objects/order, marks and anchors.
- ADR 0021 accidentals apply unchanged; the earliest matching B owns the sign.
- Measured geometry (`layout/neumes/repeated-notes.ts`): original 12-unit
  Punctum heads at 18-unit origins, no connector, adjacent hit columns. The
  same geometry drives score ink, ghosts, palette icons, signs, lyrics and
  wrapping.
- Punctum split control (`components/PunctumMenu.tsx`): primary always arms
  ordinary Punctum; the chevron menu arms the exact variant without editing.
- Native v6 writes; exact v1–v5 readers reject both new kinds.

## Reference comparison

`comparison.png` combines, without redrawing notation:

- Sister Demetria, _Basic Gregorian Chant and Sight Reading_ (1960), printed
  p. 70 (Bistropha between Clives; square Tristropha beside the excluded
  Trivirga) and p. 71 Ex. 115 (repeated groups, adjacent neumes, ictus).
- An actual editor screenshot (`editor-engraving.png`, cropped from the
  browser driver's 1440px `engraving-1440.png`): line/space Bistropha and
  Tristropha and both episema kinds.
- Gregorio 6.0.0 / Greciliae renderings of `cases.gabc` (square heads) and
  `stropha-cases.gabc` (excluded stropha alternate), composed by
  `comparison.tex`.

Regenerate the board with
`node docs/verification/repeated-note-neumes/render-comparison.mjs <driver-output-dir>`
(requires ImageMagick `convert`). The comparison is qualitative: it supports
the square-head, disconnected profile and similar intra-group spacing; it is
not a measured typographic match and makes no claim about historical
performance or mora placement.

## Actual verification (2026-11-13)

Repository gate: `npm run format:check`, `npm run lint`, `npm test` (83 files,
1,741 tests) and `npm run build` passed.

Browsers: headless Chromium 157 (CDP) and Firefox 146 (BiDi), disposable
profiles, production `vite preview` of the same build, run sequentially.

| Driver                                         | Chromium | Firefox |
| ---------------------------------------------- | -------- | ------- |
| `repeated-note-neumes/browser-check.mjs`       | pass     | pass    |
| `b-accidentals/browser-check.mjs`              | pass     | pass    |
| `b-accidentals/acceptance-browser-check.mjs`   | pass     | pass    |
| `bundled-example/browser-check.mjs`            | pass     | pass    |
| `local-persistence/browser-check.mjs`          | pass     | pass    |
| `note-modifiers/browser-check.mjs`             | pass     | pass    |
| `note-shapes/browser-check.mjs`                | pass     | pass    |
| `vertical-episemata/browser-check.mjs`         | pass     | pass    |
| `vertical-episemata/context-browser-check.mjs` | pass     | pass    |
| `clefs`, `continuous-lyrics` (dev server)      | pass     | n/a     |
| `mid-score-clefs`, `divisions` (dev server)    | pass     | pass    |
| `lyric-anchors`, `lyric-move` (dev server)     | fail     | n/a     |

The Stage 9A driver covers, at 1440px and 320px: primary Punctum always
re-arming ordinary Punctum; chevron open, Escape, Tab and outside-pointer
dismissal with unchanged storage bytes; keyboard Right Arrow/Enter/End/Enter
selection; exact ghosts and repeated one-click placement of both kinds; T/I
recall of the remembered variant; disabled mora with explanation; independent
episemata and canonical B ownership; rejected single-note move with its
announcement; whole-group move; constituent deletion normalization with
undo/redo; v6 reload, export and import; no horizontal overflow and one
toolbar Tab stop.

`lyric-anchors` (a self-described historical Stage 1 driver) and `lyric-move`
fail at the same assertions (lines 48 and 189) on an untouched worktree of
`c8bd51c`, which has the same source as `master`. They are stale pre-existing
drivers, not Stage 9A regressions. The dev-server drivers hardcode their ports;
they were run from port-substituted copies with no other edits.
`storage-review.mjs` and the optional `CHANT_LEGACY_URL` v4-build check were
not run.

## Review revision: split-button lifecycle (2026-11-13)

The owner's review of `433ae6d` reported two split-button findings. Both were
reproduced before changing code, in headless Chromium 157 and Firefox 146 at
1440px, with identical results in both browsers:

1. With Tristropha armed and the menu reopened, clicking primary Punctum armed
   Punctum and wrote nothing, but the menu stayed open. The open-menu effect,
   which also depended on `active`/`remembered`, then moved focus onto the
   "Punctum" menu item. A further consequence: the next chevron click closed the
   stale menu instead of opening it.
2. A score click used only to dismiss the menu edited nothing, but it left
   focus on `<body>`. Afterwards `I` inserted nothing and `T` did nothing.

The fix in `PunctumMenu.tsx`: an item receives focus only when the menu opens.
Activating the primary button closes the menu, and focus stays on the primary
button. A dismissal-only score click returns focus to the chevron. Clicks on
other controls keep native focus.

The Stage 9A driver now checks, at 1440px and 320px in both browsers:

- After a primary click with the menu open, the menu is closed, Punctum is the
  pressed tool, focus is on the primary button and storage bytes are unchanged.
  The next chevron click opens the menu.
- After a score dismissal, storage is unchanged, focus is on the chevron, and
  `I` and `T` then work.
- An exposed palette control clicked while the menu is open receives focus.

The primary-click check failed against the pre-fix build. With the fix, the
gate passed again (format, lint, 1,741 tests, build), and the Stage 9A driver
passed in Chromium and Firefox. The other regression drivers were not rerun for
this focused revision.

At 320px the open menu covers wrapped neighbouring palette buttons, so a click
there selects the menu item underneath. The menu is on top, so this is the
intended behavior. The driver chooses an exposed control for the focus check.

## Follow-up maintenance

The pre-existing `lyric-anchors` and `lyric-move` driver failures are out of
scope for this PR. Repair or retire those drivers in separate maintenance work.

## Manual owner acceptance (not yet performed)

- Foreground Chromium and Firefox: open the chevron by pointer and keyboard,
  choose each variant, confirm the primary Punctum always returns to ordinary
  Punctum and the active-variant indicator is clear.
- Screen-reader announcement of the menu, active variant, constituent labels,
  disabled mora select and its explanation, and the unison-rejection message.
- Visual acceptance of repeated-head spacing at typical zoom and 320px against
  the printed references, including signs and adjacent neumes.
- Real-pointer placement, I/T recall and Escape/Tab dismissal behavior.

## Remaining limitations

- Mora authoring is unavailable for both kinds (owner-approved scope limit).
- Historical stropha silhouettes, bivirga/trivirga, oriscus/pressus and GABC
  interchange remain out of scope.
- Older builds cannot read v6 files, including v6 files without new kinds.

# Testing

## Scope

This document is authoritative for test strategy, repository commands,
fixtures, regression expectations, and manual browser verification.

## Related documents

- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Commands and history](commands-and-history.md)
- [Layout and rendering](layout-and-rendering.md)
- [Editor interactions](editor-interactions.md)

## Test environment

Vitest runs the suite as plain TypeScript. The repository currently has no DOM
test environment, component testing library, browser automation dependency, or
coverage requirement.

Prefer tests at the smallest pure seam:

- domain validation, lookup, and normalization;
- immutable commands and insertion resolvers;
- document history, selection, and tools;
- graphical-placement and focus resolvers;
- layout, wrapping, lyric alignment, and preview geometry;
- pure accessibility-label and score-description helpers.

Do not rely on a component test for logic that can be expressed and tested as a
plain TypeScript function.

## Fixtures and assertions

Tests usually construct small `ChantDocument` fixtures inline. Use descriptive,
stable IDs such as `syllable-1`, `neume-podatus`, and `note-upper`, and create
pitch values with `staffPosition(...)`.

Parameterized matrices are useful for supported neume kinds, valid and invalid
pitch contours, insertion boundaries, and rejection paths. A regression test
should cover the narrowest seam that owns the contract.

Assertions should cover more than final values when identity matters:

- exact input reference for rejected or no-op commands;
- stable entity IDs and semantic order;
- structural sharing of unaffected data;
- invariant preservation after movement or normalization;
- one atomic history entry and exact undo/redo restoration;
- stable IDs and ordering across multi-system reflow;
- complete ink bounds, musical anchors, interaction partitions, and whole-neume wrapping;
- ID-free preview shape and preview/commit geometry parity;
- flattened multi-system accessibility totals.

## Automated and manual coverage

The automated suite covers pure accessibility descriptions and interaction
decisions. It does not execute actual React or browser behavior.

Manually verify important changes involving:

- DOM focus and focus restoration after keyed elements are reparented;
- browser `getScreenCTM()` and client-to-SVG pointer conversion;
- placement-mode pointer-event ownership;
- tab order and `aria-disabled` behavior;
- click and keyboard event propagation;
- visual clipping and selected-neume outlines;
- responsive SVG scaling and dynamic multi-system height.

## Commands

The exact supported Node.js version is declared in the repository-root
`.nvmrc`. Contributors using nvm can activate it before installation:

```bash
nvm use
npm ci
```

`npm ci` installs the exact dependency tree recorded in `package-lock.json`.
Use `npm install` only when intentionally adding, removing, or updating a
dependency so npm can update the manifest and lockfile together.

Apply deterministic formatting with:

```bash
npm run format
```

Check formatting without modifying files with:

```bash
npm run format:check
```

Run the standard local verification in this order:

```bash
npm run format:check
npm run lint
npm test
npm run build
```

Other available scripts are:

```bash
npm run test:watch
npm run dev
npm run preview
```

`npm test` invokes `vitest run`, runs the suite once, and exits.
`npm run test:watch` remains active and reruns tests while files change; do not
use it for the standard verification gate or CI.

`npm run dev` is the normal manual-interaction environment.

For a production check, run `npm run build`, then `npm run preview` and open
`http://localhost:4173/gregorian-chant-editor/` (or the port Vite reports).
Production builds and preview use `/gregorian-chant-editor/`; the development
server continues to use `/`. Inspect `dist/index.html` and verify that the
referenced JS, CSS and favicon load under the project subpath. Check the page
title, experimental notice, basic editing and committed-score refresh recovery in the
real browser, including a narrow viewport.

## Formatting changes

Prettier owns mechanical formatting, while Oxlint owns code-quality,
correctness, and framework diagnostics. Keep formatting-only changes
mechanical: do not combine a repository formatting pass with refactoring,
renaming, cleanup, test changes, or feature work. Review a formatting baseline
normally and with whitespace ignored to identify any non-mechanical change.

## Continuous integration

The `CI` GitHub Actions workflow runs for pull requests and pushes to `master`,
except changes limited to the Markdown, PlantUML and Makefile paths excluded
by the workflow.
Its parallel `Format`, `Lint`, `Test`, and `Build` jobs each install locked
dependencies with `npm ci`, then run the corresponding command shown above.
The hosted status checks are normally reported as `CI / Format`, `CI / Lint`,
`CI / Test`, and `CI / Build`. The jobs intentionally repeat setup rather than
sharing `node_modules`, keeping each result independent and immediately
visible.

Reviewing the workflow structure or YAML locally does not prove hosted
execution. After pushing, confirm the workflow runs successfully and that a
newer push cancels an obsolete run for the same branch or pull request before
requiring all four CI checks in branch protection.

### GitHub Pages deployment

The separate `Deploy to GitHub Pages` workflow runs on every push to `master`,
including documentation-only changes, and supports manual dispatch on `master`.
Other branches cannot build or deploy through this workflow; pull requests do
not publish. Existing CI checks and branch protection are managed separately.

`Verify and build Pages artifact` has only `contents: read` permission. It uses
`.nvmrc` and `npm ci`, then runs formatting, lint, tests and the production build
before uploading `dist/`. `Publish to GitHub Pages` depends on that job's success
and has only `pages: write` and `id-token: write` permissions. It configures Pages
and deploys the uploaded artifact through the `github-pages` environment without
checking out source or running application build scripts. Deployments are
serialized without canceling an in-progress run.

Follow the [README setup steps](../README.md#public-preview-and-deployment) to
enable Pages or manually rerun deployment. Local checks and a passing PR CI run
do not prove hosted deployment. After deployment, verify the public project URL
in Firefox and Chromium: all assets load without 404s, the title and preview
notice appear, and a basic editor interaction works. Record these checks as
pending owner deployment until the site can actually be tested.

## Climacus and Porrectus regressions

The domain, command, and layout suites cover strict contours, stable survivor
identities, Porrectus equal-outer-pitch deletion rejection, movement validation,
atomic history, approved ribbon/diamond geometry, first-note lyric anchors, and
preview/commit parity across reflow. Tool mapping and accessibility matrices
include both kinds. Verify their toolbar and graphical entry, keyboard editing,
placement cancellation, and actual focus behavior in the browser.

## Extension checklists

### Add a semantic neume kind

- Update the discriminated union and fixed tuple in the
  [domain model](domain-model.md).
- Extend runtime validation, lookup-dependent normalization where applicable,
  movement switches, layout geometry, lyric alignment, and accessible labels.
- Update exhaustive switches and add invariant, rejection, identity, command,
  layout, and accessibility tests.
- Do not assume the kind is graphically placeable.

### Make a kind graphically placeable

- Add it deliberately to the graphical-kind union and editor tool mapping.
- Extend placement contours, typed resolver results, preview input/output,
  connector geometry, and commit handling.
- Test system hit behavior, snapping, complete-neume midpoint boundaries,
  unrestricted semantic insertion, long documents, reflow, and preview/commit parity.

### Change connector or notehead geometry

- Update shared geometry and painted-bound expectations; do not derive ink-part
  cardinality from semantic note count.
- Keep intended joins as continuous filled contours, and test adjacent
  contacts at fractional scale. Preserve intentional disconnected components
  such as Scandicus (1,1); never require blanket neume ink connectivity. Test both note controls and musical anchors
  independently of ink bounds.
- Test compact spacing, following-neume spacing, wrapping thresholds,
  selection outlines, lyric anchors, and preview/commit parity.
- Review whether exact-fit and oversized-neume progress cases still hold.

### Change `ChantLayout`

- Update every pure layout assertion and rendering consumer.
- Preserve or deliberately revise the documented absolute-coordinate and
  `startNeumeIndex` contracts.
- Update score totals and multi-system interaction resolvers when affected.

### Change accessibility descriptions

- Update the pure helper tests for every neume constituent and selected state.
- Check singular/plural score totals across multiple systems.
- Manually verify label relationships and keyboard use in the browser.

### Change command or history behavior

- Test acceptance, rejection, exact-reference no-op behavior, immutability,
  structural sharing, ID preservation, one history entry, undo/redo, and future
  clearing after a replacement edit.
- Update [commands and history](commands-and-history.md) when the contract
  changes.

## Verification artifact policy

The [verification index and audit](verification/README.md) distinguishes approved
engraving references, reusable fixtures, historical drivers and generated outputs.
Browser diagnostics belong in system temporary directories; committed specimens
and historical evidence must not be refreshed as a side effect of test runs.
These scripts remain separate from Vitest and CI.

## Initial square-notation engraving verification

`neume-geometry.test.ts` covers the approved adjacent contacts, interval/stem
matrix, large-interval extrapolations, shared geometry/committed-layout equivalence,
anchor independence, exact-fit interval reflow, stable IDs,
normalization, and atomic undo/redo. Existing interaction and accessibility tests
remain in place. The [browser verification record](verification/engraving/README.md)
preserves historical screenshots, viewport scales, and the limits of the Chromium checks.
No browser testing dependency was added.

### Climacus and Porrectus engraving verification

`climacus-porrectus-geometry.test.ts` compares independent approved review
recipes against application paths, anchors, painted bounds and targets. Matrix
tests cover interval extrapolations, transposition, shared builder/committed
geometry (including optional hit paths), exact-fit wrapping, stable identities,
normalization, focus-survival decisions and atomic history. The
[implementation verification](verification/climacus-porrectus/implementation.md)
records real editor pointer/keyboard/focus checks, SVG bounds, accessibility,
opacity raster checks and integrated normal/responsive screenshots. These
browser checks remain separate from the plain Vitest suite. No browser test
dependency or component-test environment was added.

## Persistent graphical placement regressions

`editor-session.test.ts` covers all-kind persistent placement and contextual
insertion, remembered-kind invariants, same-position sequential insertion, pitch/contour intent across
wrapping, independent history, event announcements, stable selection, and target
removal. `focus-visibility.test.ts` covers minimal reveal of clipped notation and oversized bounds.

`graphical-placement-preview.test.ts` checks caret placement at semantic
boundaries, local ghost shapes/pitches for every kind, staff-end clamping,
shared system boundaries, crowded insertion, lyric-independent boundaries,
ID-free output, stable committed layout during hover, and actual wrapping on
commit. Geometry matrices continue checking approved shapes and committed
layout; obsolete full prospective-scene parity assertions were removed.
The browser script checks committed SVG ink/lyrics/positions and height across
pointer sweeps, ghost shapes/pitch against shared committed ink, non-interactivity,
cancellation, actual wrapped destination reveal, and atomic commit history.

`palette-navigation.test.ts` covers roving focus destinations and shortcut
scope/modifier/composition guards.

The [real-browser placement record](verification/placement/README.md) includes a
standalone development fixture and a dependency-free DevTools Protocol script.
The fixture still mounts the actual StrictMode React editor. The historical
driver requires adaptation to the anchored model and current controls before
it can pass; its recorded scenarios include rapid clicks,
focus timing, long/nested scroll preservation, live-region mutations, and native
keyboard behavior. They remain separate from the plain Vitest suite. Accessibility
tree and mutation checks do not replace a spoken screen-reader verification.

## Anchored lyric regression coverage

`lyric-anchors.test.ts` covers ordered/unique anchors, inferred spans, lyricless
prefixes, free-anchor creation, boundary repair, constrained reassignment,
normalization, anchored deletion and atomic history. Layout and placement suites
use anchor fixtures and verify lyric-independent music insertion. Stage 1 browser
checks should cover selecting a free neume to add lyrics, occupied-anchor protection,
text validation, insertion without lyrics, anchored deletion and undo/redo.

The [Stage 1 browser record](verification/lyric-anchors/README.md) records historical interactions and verification limits. Its driver targets controls replaced in Stage 2 and does not pass against the current UI; use the Stage 2 driver below for current lyric checks.

## Continuous lyric-entry verification

`syllable-workflow.test.ts` exercises continuous entry through the pure session
reducer: delimiters, skips, commit-on-navigation, occupied protection, replacement,
empty/invalid drafts, end resumption, recovery and history choices. Keyboard
guards have plain TypeScript tests. The [Stage 2 browser record](verification/continuous-lyrics/README.md)
checks native focus/Tab, composition guards, paste rejection, replacement caret
behavior and responsive input positioning in the actual React editor.

Syllable selection/deletion regressions exercise active and inactive Lyrics mode,
no-input single-click selection, atomic deletion and stable anchor focus. The
continuous-entry browser script tests actual keyboard Delete/Backspace and the
Delete syllable button separately, plus normal cursor editing and native input deletion.

PR #38 review regressions cover Space selection on focused lyrics, selected
delimiter entry from inactive Lyrics mode (including occupied/end targets),
and keyboard-only browser traversal through deletion. Browser checks also assert
normal selected lyric ink, absence of underline, and distinct simultaneous
selection outline and labeled focus marker.

Direct focused-lyric deletion is covered with and without an existing selection,
including focus on a different syllable, active/inactive Lyrics mode, draft
resolution and atomic history. Browser checks use Tab → Delete/Backspace without
Space or a mouse, and retain the native input character-deletion regressions.

Focus/selection browser regressions preserve click selection while Tab/Shift+Tab
visits another lyric, assert no history or draft changes, check the panel's named
keyboard target versus selected target, and verify focused deletion separately
from the selection-button command. The continuous-lyrics record documents the Firefox automation limitation and
manual foreground-window verification steps.

L-targeting regressions cover no selection, another selected lyric, and the
focused lyric already selected; activation preserves semantic selection, music,
anchors and history, and explicitly pressing L opens the existing syllable
for cursor editing. Sequential navigation onto an occupied anchor still pauses.
Pure session tests cover
focused notes, missing IDs and active-draft resolution. Browser checks prove L
reaches the intended handler even from selected lyric text and stays ordinary
letter input within the native field.

## Lyric anchor correction verification

`lyric-move.test.ts` covers temporary reassignment, derived legal targets, middle
and edge moves, exact-reference rejection, sibling/music preservation, atomic
undo/redo, selection versus preview, cancellation and draft integration (including
stale/recovery targets). The [Stage 3 browser record](verification/lyric-move/README.md)
covers actual pointer targeting, keyboard browsing/confirmation, native Tab,
rejection announcements, text drafts, stable selection/focus and multi-system
reveal at narrow widths. Stage 2 browser regressions remain applicable.

## Stage 4A vowel alignment

`lyric-alignment.test.ts` covers explicit-language nuclei, accents/graphemes,
English/unspecified/incompatible-script fallbacks, invalid/missing measurements,
manual precedence, and unchanged multi-system music geometry.
`update-lyric-alignment.test.ts` covers range validation, text-change reset,
immutable language edits, semantic history and dirty-draft/focus preservation.
All typed document fixtures supply `lyricLanguage` explicitly.

Run `node docs/verification/vowel-alignment/browser-check.mjs` with Vite and
Chromium's debugging port 9230 for actual native keyboard/pointer, SVG metrics,
undo/redo, focus-selection independence, and 320px/multi-system verification.
The [verification record](verification/vowel-alignment/README.md) describes
actual results and limitations. Generated screenshots stay in system temporary
storage; no browser dependency or DOM test environment was added.

## Stage 4B lyric-aware layout

`lyric-spacing.test.ts` verifies complete music-only geometry across all seven
kinds, word versus continuation clearance, melismatic minimum advances, exact
fits, first left bearings, isolated oversized progress, both canvas overhangs,
missing/partial/invalid metrics, semantic history and repeated measured pointer
resolution on the reducer's latest document.

Run `node docs/verification/lyric-spacing/browser-check.mjs` with Vite and
Chromium debugging port 9230, plus the Stage 4A browser driver above. The
[implementation record](verification/lyric-spacing/README.md) distinguishes
actual native interaction checks, font tests and remaining acceptance work.
Verify focused-ID preservation during measurement reparenting, later-system
pointer/caret agreement, word-boundary/text/alignment/language history, 320px
containment, native horizontal scrolling to both edges and scrolled insertion
with a negative viewBox origin. Generated before/after screenshots remain in
temporary storage. ADR 0010 is Accepted; ADR 0011 narrowly qualifies same-word spacing.

The same-word regression uses `Al / lealsdkfjaasdfhasdf / lu / ia / bla`.
Assert painted SVG `getBBox()` clearance as well as advance clearance, including
responsive scaling, ordinary wrapping, oversized isolation and text undo/redo.
Pure regressions cover negative/positive ink overhangs, an advance-exact fit
whose ink requires wrapping, and ink-only oversized canvas expansion. These
three regressions fail against the pre-fix implementation.

Selected-lyric checks inspect the cue separately from glyph clearance. The Stage
4B browser driver selects the long second syllable, then deselects it, at desktop,
320px and 150% CSS zoom; positions must stay unchanged, the background must paint
behind the text with no stroke/outline, and its SVG bounds must stay clear of the
next syllable. The continuous-entry browser driver checks native keyboard
selection/focus independence with the new highlight.

For the targeted Firefox rendering regression, start Firefox headless with a
fresh temporary profile and `--remote-debugging-port 9233`, then run
`node docs/verification/lyric-spacing/selection-cue-firefox.mjs`. The driver uses
native BiDi pointer actions and captures selected/unselected screenshots. Override
`CHANT_FIREFOX_URL` for a different session WebSocket URL. This is a rendering
and pointer check, not foreground keyboard-focus or spoken screen-reader acceptance.

## Stage 4C word composition

`word-composition.test.ts` covers contextual minima, unchanged internal ink and
anchors for all seven kinds, disjoint external pointer ownership, measured
joining/hyphens, melismas, real word ends, outgoing reservation, missing hyphen
metrics, deterministic fallback and oversized progress. Stage 4B's exact-fit
regression now uses a final syllable without an outgoing reservation.

Run `node docs/verification/word-composition/browser-check.mjs` against Chromium
on port 9230. Set `CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session` to run the same
cases with Firefox BiDi. `CHANT_BASELINE=1` captures the four visible-editor
baseline cases without asserting Stage 4C behavior. The driver mounts the real
StrictMode editor, captures word, wide-neume and outgoing cases, and uses native
pointer actions for all constituent notes of compact pairs of all seven kinds
at desktop and 320px. Run drivers sequentially on their shared browser tab.
The [verification record](verification/word-composition/README.md) distinguishes
actual results, selected review screenshots and remaining acceptance limits.

The Stage 4A driver now checks vowel centers against displayed musical anchors,
and music restoration on undo, since measured composition can reflow music on a
language edit. Stage 4B's boundary-edit browser case uses the second lyric on its
system; changing a first lyric's boundary need not move geometry.

### PR #45 corpus verification

`word-corpus.test.ts` consumes the same explicit eight-entry, five-arrangement
corpus as the browser driver. Three synthetic glyph-advance profiles exercise
relative geometry rather than fixed x coordinates. Checks validate editorial
`boundaryBefore` metadata (including Kyrie / eleison), complete-neume order and
wrapping determinism, unchanged musical ink/anchors/internal targets, disjoint
external target ownership, lyric and hyphen clearance, word-space minima,
geometrically feasible joins and necessary continuation marks. A negative
metadata case proves the checker detects an accidentally joined word boundary.

Run `CHANT_CORPUS=1 node docs/verification/word-composition/browser-check.mjs`
with the existing Vite/CDP setup; `CHANT_FIREFOX_URL` selects Firefox BiDi.
`CHANT_CORPUS_WIDTH=320` measures the real narrow editor; `CHANT_CORPUS_FONT=sans`
loads a real alternate local font for both visible and hidden SVG text. The
shared inspector checks derived invariants, and separate DOM checks inspect
actual `getBBox()` ink and text advances. A small numeric precision tolerance is
not an image-difference threshold. All metrics, complete contact sheets and HTML
review boards are generated in temporary storage. Selected sheets are explicitly
retained as [review evidence](verification/word-composition/corpus-review.md),
never automatically compared to golden images or refreshed by test runs.
`CHANT_CORPUS=diagnostic` records invariant failures for investigation; it is not
a passing correctness run. Run each browser's drivers sequentially.

### Auditione and giga-review regressions

The corpus now includes four auditione reference/control documents in addition
to the existing 40 arrangements. See the [investigation](verification/word-composition/auditione-review.md)
for the source assignment and measured differences; the join threshold is unchanged.
`rendered-continuations.test.ts` rejects missing, extra, wrong-system and wrongly
flagged displayed marks using the same typed assertion as the browser driver.
`word-composition.test.ts` includes a first source lyric that fits by itself but
requires room for its outgoing mark. The native browser driver Shift-selects
compact whole neumes and inspects selection/placement/move ownership clips for
all seven kinds at desktop and 320px, and checks a real near-edge outgoing mark.
Firefox resource cleanup uses one encompassing finally, including setup errors.

### Et lux repeated-puncta regression

The [et investigation](verification/word-composition/et-lux-review.md) records
source grouping and the first-note alignment comparison. `et-lux.test.ts` and
three shared corpus specimens cover one syllable owning two equal-pitch puncta,
no internal hyphen, full-phrase pitch/boundary metadata, and a split syllable span.
The corpus driver also measures the actual e center and both note centers
relative to their staffs. No image matching or production policy change is used.

## Stage 4D acceptance audit

The [current Stage 4D record](verification/stage-4d/README.md) inventories pure
and runnable browser coverage, reproduction commands, actual Chromium/Firefox
results, selected fresh visual evidence and unverified areas. Its foreground
Firefox checklist is a separate owner signoff; headless input and DOM/ARIA
assertions do not verify foreground keyboard behavior or spoken output.
The existing corpus driver now also checks semantic lyric DOM order, names,
roles, initial pressed/tab state, instruction references and inert punctuation.
The Stage 3 move driver uses the current purple-cue caption and explicit Latin
fixture. Historical placement/Stage 1 drivers still need adaptation.

## Stage 5A semantic divisions

`divisions.test.ts` asserts derived score order for explicit insertion on either
side, adjacent slots, leading/trailing/empty scores, finalis before later music,
converging deletion anchors, normalization, pitch movement, runtime rejection,
structural sharing and atomic exact-reference history restoration. Existing
insertion, lyric and geometry suites remain regression gates. Fixtures explicitly
include the required empty division collection.

This stage adds no graphical behavior. Browser acceptance of divisions belongs
to Stage 5B/5C; pure tests do not claim division rendering or accessible UI.

## Stage 5B graphical divisions

`division-layout.test.ts` covers all staff-relative glyphs and padded targets,
explicit pointer/command slots on both sides, adjacent/leading/trailing and empty
music, bounded long-run wrapping, finalis phrase endings, isolated oversized
syllables, unchanged lyric identities, blocked contextual compaction, measured
conditional/outgoing marks, contextual insertion, persistent tools, atomic edits,
history reconciliation and dirty draft guards. Existing division-free suites
remain regression gates.

Run `node docs/verification/divisions/browser-check.mjs` with Vite on port 5173
and Chromium debugging port 9230. Set
`CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session` for Firefox BiDi. The same real
StrictMode editor fixture checks native pointer caret/commit sides, explicit
insertion buttons, four persistent tools, focus/selection/kind/deletion/history,
native Tab, adjacent/leading/trailing/empty music, zoom, 320px containment and
exceptional local scrolling. Kind choice dispatches a DOM change on the native
select; this is not an operating-system dropdown interaction check. Run drivers
sequentially on each browser's shared tab. Generated screenshots stay in temporary
storage; selected review evidence is retained explicitly in the
[Stage 5B record](verification/divisions/README.md).

The current lyric-entry and lyric-move drivers now supply required Stage 5A
collections; the vowel-alignment driver scopes its fieldset queries to lyric
alignment controls rather than the new Divisions fieldset. Continue running
these and measured-spacing/word-composition regressions. Foreground keyboard,
OS/browser zoom, IME, spoken output and detailed owner graphical acceptance
remain distinct Stage 5C responsibilities.

PR #48 review regressions additionally cover measured lyric/bar clearance on
both sides for long word/continuation syllables, active melismas, normal wrapping
and isolated oversized source units. The division driver checks rendered SVG
boxes and native pointer sides after horizontal scrolling to extended visual
staff ink; logical wrapping remains normal. Caret positions and midpoint pointer
intervals are tested separately so unequal lyric-driven gaps cannot reverse a
bar's insertion side.

## Stage 5C division acceptance

The [Stage 5C record](verification/divisions/stage-5c.md) maps existing pure and
browser coverage to the [owner checklist](verification/divisions/owner-acceptance.md),
records headless runs and qualitative foreground Firefox owner acceptance,
without inferring individual checklist results or environment/zoom details. The division driver
adds native Tab traversal to both explicit insertion-side buttons from
the focused kind select, at desktop and 320px; Chromium also checks Enter
activation. Firefox headless HTML activation remains unverified, as recorded
in the Stage 5C evidence. Run it sequentially with other
drivers sharing its tab. Owner foreground results, actual browser zoom, OS
popups, IME and spoken screen-reader testing remain separate from these checks.

## Stage 6A initial clefs

`update-clef.test.ts` covers all 64 C/F × line transitions across all seven neume
kinds, relative diatonic preservation, IDs/intervals, round trips, outside-staff
pitches, invalid/no-op exact references, malformed/unsafe pitch rejection and
atomic snapshot history. `clef-editing.test.ts` covers singleton selection/focus,
draft/tool/remembered-kind preservation and exclusive-mode guards.
`clef-geometry.test.ts` covers all eight glyph/line combinations, reference-line
anchors, occupied/padded bounds, empty/wrapped scores and musical clearance
when an outgoing reservation uses leftward room. Accessibility suites name the
current type and line.

Run `node docs/verification/clefs/browser-check.mjs` with Vite on port 5173 and
headless Chromium debugging on port 9230. The standalone driver mounts the real
StrictMode editor and checks all eight forms at desktop/320px, actual SVG ink
bounds, native pointer and keyboard line editing, selection versus Tab focus,
exact rendered displacement, undo/redo, dirty lyric drafts, repeated decorative
copies, empty scores and placement ownership. Native selects are changed with
DOM change events; this does not verify OS dropdown operation. Screenshots go
to temporary storage. The [Stage 6A record](verification/clefs/README.md) separates
actual checks, selected visual review evidence and remaining owner acceptance.
Continue running division, continuous-lyric, anchor-move, vowel-alignment,
measured-spacing and word-composition browser regressions sequentially on the
shared browser tab. Foreground focus/zoom/IME, spoken output and final clef
contour acceptance remain owner checks; see Stage 6B below for authored changes.

The [clef refinement review](verification/clefs/refinement/review.md) separately
checks visual fidelity against printed C/F examples at matched staff spacing.
Bounds tests alone do not assess typography. Refinement fixtures now fill the
larger musical region left by the reduced leading gap: exact-fit growth still
crosses the actual x=656 edge, and the shared et-lux split-span fixture keeps
its two same-syllable notes on opposite systems with a synthetic wider prefix.

## Stage 6B explicit clefs and custodes

`clef-changes.test.ts` covers mixed boundary split/merge/reanchor invariants,
non-global clef collection order, leading/trailing/empty/redundant events,
legacy/stale intent rejection, all C/F offset pairs, initial-clef scope and unsafe
positions. `clef-transactions.test.ts` covers transient final-value application,
one-shot policy choice, exact history, dirty lyric preservation and exclusive
pending ownership. `clef-changes-layout.test.ts` verifies outgoing-clef guide pitch,
leading substitution, separated bars, deterministic long mixed runs and slot IDs.
Existing exact-fit fixtures reserve the new system-end custos width.

Run `node docs/verification/mid-score-clefs/browser-check.mjs` with the standard
Vite/Chromium setup. `CHANT_FIREFOX_URL=ws://127.0.0.1:9234/session` selects Firefox
BiDi. The [Stage 6B record](verification/mid-score-clefs/README.md) records actual
results, source inspection, selected screenshots and manual owner checks.
Run the existing clef, division, continuous-lyrics, lyric-move, vowel-alignment,
lyric-spacing and word-composition drivers sequentially on each shared browser.

### PR #60 review follow-up

`clef-review-boundaries.test.ts` covers cross-boundary/slot rejection, identity
collisions across lyric/music/division/clef collections, actual-end I fallback,
clef-side shortcut feedback and placement guards. `clef-review-regressions.test.ts`
checks graphical insertion on both authored-clef sides (mid-staff, trailing and
system-leading), oversized staff/slot reachability, caret/guide clearance,
division-leading duplicate suppression, reclaimed guide spacing, and a continuation
system whose effective F clef differs from the initial C clef. Transaction tests
now distinguish a rejected melody translation from a valid notehead-preserving edit.

The existing mid-score-clef browser driver includes these interaction regressions
at desktop/320px, semantic dropdown persistence and target clearing, Escape from
a focused lyric field outside the dialog, focused-clef I feedback, policy-specific
overflow, and scrolled oversized insertion with a negative viewBox origin.

### Owner-approved graphical clef UX correction

`graphical-clef-placement.test.ts` covers C/F × four-line snapping and half-line
tolerance, out-of-band rejection, approved ghost geometry, every mixed slot,
empty/division-only placement, latest measured resolution, stale tools/IDs and
keyboard targets, direct redundant/trailing commits, preselected insertion policies,
exact undo/redo, transaction serialization, dirty drafts, remembered-neume I,
keyboard traversal and safe contextual draft overlays. Palette tests include
C/F roving navigation; the prior semantic/layout regression suites remain gates.

The mid-score-clef browser driver now targets the graphical workflow instead of
the removed insertion form: real C/F hover, all four lines, exact slot/line commit,
one-click selected policy, persistence across C/F, unsafe-policy rejection,
wrapping, adjacent division/clef sides,
contextual staged edits, native roving toolbar and keyboard-only insertion,
Escape/dirty drafts, history and desktop/320px containment. Screenshots include
visible insertion behavior, ghost, inserted result, selected-clef draft and
existing-clef pitch confirmation. Historical
form-driver results in the verification record do not describe the new UI.

### Shared pitch handling for existing-clef edits

`clef-transactions.test.ts` checks immediate Apply under both shared policies,
scoped unaffected passages, exact history, no-op/cancel, session persistence
across insertion/edit/insertion and overflow recovery by mode switch or draft
revision. Deletion retains its separate conditional-choice regressions. The
mid-score-clef browser driver exercises visible/enabled shared radios during
selection/drafts, keyboard-arrow editing, contextual C/F and line changes,
no-dialog Apply, both policies' measured displacement, later-clef scope,
undo/redo, no-op/cancellation, overflow/retry and unchanged deletion confirmation
in Chromium/Firefox at desktop/320px. Earlier edit-confirmation screenshots are
historical; current evidence is in the Stage 6B verification record.

### Custos ledger engraving

`custos-geometry.test.ts` covers staff/adjacent-space omissions, exact one/multiple
ledger positions above/below, glyph alignment, complete bounds and translation,
compact extreme-pitch geometry, unchanged guide formulas and whole-neume order,
oversized staff/canvas and reachable caret clearance. The mid-score-clef browser
driver renders representative positions and the approximate GABC reference in
the real editor at desktop/320px, checks SVG ink against derived geometry and
canvas bounds, and retains screenshots. The [focused record](verification/mid-score-clefs/custos-ledgers.md)
separates actual Gregorio output, editor evidence, and remaining owner review.

### Selected authored-clef vertical arrows

`clef-transactions.test.ts` covers first-press and consecutive draft steps, both
bounds, shared pitch outcomes, exact Apply/undo/redo, Cancel with redo/lyric
drafts, stale/exclusive targets and a measured reflow specimen. The real-editor
mid-score-clef driver verifies pointer/keyboard selection, six consecutive native
arrows without focus theft, current in-score preview/control line, unchanged
committed ink, inert Left/Right, Apply/Cancel/Escape, both modes, exact history
and focus after reflow in Chromium/Firefox at desktop/320px. Contextual-button
entry still focuses its controls; initial-clef and insertion keyboard checks
remain regression gates. See the Stage 6B verification record for actual runs.

## Local persistence verification (Stage 7A)

The codec/adapter unit suites cover full-document round trips, malformed payloads,
size limits, IDs/anchors/contours, corrupt cache protection, unavailable storage,
conflicts and undo/redo saves. The standalone [browser driver](verification/local-persistence/browser-check.mjs)
checks the actual production subpath editor in Chromium/CDP and Firefox/BiDi.
See its [record and manual checklist](verification/local-persistence/README.md)
for commands, scope and limits. Browser drivers remain outside CI/Vitest.

## Rhythmic note modifiers (Stage 8A)

The command, layout and persistence `note-modifiers` suites cover per-note
immutability, invalid/no-op identity, normalization/movement, exact history,
all seven kinds and marked interval matrices, full measured ink, staff-line
clearance, unchanged heads/anchors, wrapping, accessible descriptions, exact
baseline v1 decoding and guarded same-key v2 cache upgrade. Native v1 rejection
coverage remains in place; v2 adds strict optional modifier validation.
`porrectus-mora.test.ts` additionally checks conventional trailing clearance,
the adjacent-ascent second note's line/space exception, equal-pitch sign
preservation and double mora/episema without changing v2 note ownership.

Run `node docs/verification/note-modifiers/browser-check.mjs` against the production
repo-subpath preview with isolated Chromium/CDP on port 9230. Set
`CHANT_FIREFOX_URL=ws://127.0.0.1:9231/session` for isolated Firefox/BiDi.
Run the existing local-persistence driver sequentially on each shared browser;
Firefox exits when its session ends, so restart it between drivers. These drivers
use native pointer/keyboard actions plus DOM select/file events, capture SVG
bounds and screenshots, and remain outside CI. The [record and owner checklist](verification/note-modifiers/README.md)
separate actual automated/visual evidence from foreground acceptance.

# Contiguous selection verification

The [interaction guide](../../editor-interactions.md#active-syllable-and-selection)
owns the contract. Implementation follows the approved selection-only scope;
no new ADR, dependency, persistence schema or engraving geometry was introduced.

## Automated evidence (2026-11-15 UTC)

Linux, Node 24.12.0 (installed; `.nvmrc` requests 24.18.0), Chromium
157.0.8103.38, Firefox 146.0. Standard gate passed: format:check, lint,
93 Vitest files / 2,038 tests, build, and git diff --check. The production build
retains the existing large-chunk warning. All 28 verification-runner tests also
passed with localhost permissions (the sandboxed attempt failed).

The dedicated `contiguous-selection` runner driver uses native pointer and key
input with a deterministic 70-neume fixture (compound constituents, lyrics,
division, explicit clef and accidental), then loads bundled Kyrie XI through the
application example control. It checks promotion, directional extension,
contraction/reversal, Shift+Enter/Space and arrows, Tab independence, Escape,
cross-system endpoint focus/reveal, resize, disabled operations, focused
clef/division I guards, explicit L, exact saved bytes and Undo/Redo retention.
It also checks inert connected overlays, separate note/neume cues, and absence
of accidental native text selection after Shift-click. Pure tests cover semantic
bounds, stale IDs, endpoint normalization, interior changes, history identity,
missing endpoints, insertion/edit guards, lyric/clef transitions and overlay bounds.

Evidence is in ignored `.verification-runs/` directories, on implementation
working trees based on plan commit `9f25ad8`. Later documentation changes do not
change the tested application. Runs are separate evidence, not one all-green matrix:

| Run suffix             | Coverage                                                                                        | Result                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `06-27-05-147Z-A6qW42` | Full matrix, both browsers, concurrency 4                                                       | 24 passed, 14 failed, 6 unsupported; 247.6 s |
| `06-30-50-951Z-bzCbHh` | Ranges, compound directional neumes, extended Scandicus/Climacus, Pes subpunctis; both browsers | 6 passed, 2 baseline failures; 97.9 s        |
| `06-31-58-786Z-y4N5M3` | Ranges, continuous lyrics, accidentals, divisions                                               | 7 passed, 1 unsupported; 56.9 s              |
| `06-33-21-612Z-Sw2dA5` | Final application: ranges in both browsers and continuous lyrics Chromium                       | 3 passed, 1 unsupported; 47.6 s              |

All completed runs above cleaned up their owned processes/profiles/caches.
The full run preceded focused fixes to the new driver and the intended change
to three old whole-neume test setups. Those three drivers now explicitly select
the new constituent before Shift+Enter; every original movement assertion is
preserved. Compound directional and Pes subpunctis pass in both browsers.
Extended Scandicus/Climacus passes the revised movement assertions and reaches
an unrelated placement failure also present on baseline.

## Review follow-up (2026-11-15 UTC)

Addresses the four PR #87 review findings at `1105cec`; same environment as above.

- Lyric recovery: Shift activation again selects one whole neume (replacing,
  never extending) as the **Retry** target; Shift+Left/Right stays inert there.
  A pure test retries the preserved draft at that explicit target.
- Repartitioning: the driver mounts a 48-punctum fixture with three wide lyrics,
  selects `r1`–`r44`, then deletes `wide0` through its focused engraved lyric
  (Delete). At least one selected neume moves to an earlier system; the count
  stays 44; each system has at most one band, covering exactly the selected
  neumes it contains. Undo restores the original system membership and band
  geometry exactly; Redo restores the repartitioned bands and saved bytes.
  `repartitioned.png` is saved with the other screenshots.
- Overlay bounds test now uses lyric-bearing three-neume melismas with
  podatus ink descending into the lyric row and endpoints mid-melisma. It asserts
  member coverage, no overlap with unselected ink, bands within the compact
  `hitClip` midpoint shared with a dense neighbour, and lyric clearance. Mutating
  the padding past the clip or dropping the lyric clamp fails the test.
- Announcements: a document change that clears a range (for example Undo/Redo
  removing an endpoint) announces "Passage selection cleared."; a
  reconciliation count change announces the new count; arming a placement tool
  appends the clearing notice. Transitions that already announce are not
  overridden, and focus changes remain silent.

Standard gate passed: format:check, lint, 93 Vitest files / 2,040 tests, build
(existing large-chunk warning) and git diff --check. Browser runs:

| Run suffix             | Coverage                                     | Result           |
| ---------------------- | -------------------------------------------- | ---------------- |
| `06-52-46-243Z-f8n8mx` | Ranges, Chromium and Firefox                 | 2 passed; 12.7 s |
| `06-53-58-100Z-W0CP3f` | Continuous lyrics (recovery Retry), Chromium | 1 passed; 45.6 s |

The full matrix was not rerun; the changes are confined to range reducer
paths and the new driver scenario, and the baseline failures below are unchanged
in scope.

## Compact whole-neume outline (2026-11-15 UTC)

Foreground acceptance found the whole-neume dashed outline losing its right
edge on compact neighbours (predating this PR). The 5-unit padded rectangle was
clipped to the neume's `hitClip` ownership interval, which on compact pairs lies
only a few units from the ink, so the clip removed the right stroke and the
ends of the top and bottom strokes. The outline is now fitted inside that
interval, inset by half its 2.5 px stroke, and is not clipped. Padding stays 5
units where there is room and never shrinks inside the ink. Note targets,
ownership intervals, placement/move decorations, spacing and range overlays are
unchanged. The range overlay reuses the same padded-extent helper with
identical output.

`neume-selection-bounds.test.ts` covers compact three-neume melismas with
restriction on the left, right and both sides, plus an isolated neume. It checks
ink enclosure, the stroke inside ownership, clearance from neighbouring ink and
preserved padding. Restoring the old unclipped geometry or removing the stroke
inset fails it. The driver selects three melisma members and every Kyrie XI
neume with Shift+Enter. For each one it asserts that the outline has no
`clip-path`, encloses its ink and keeps its rendered stroke off neighbouring
ink. The rectangle is measured from its attributes through the screen CTM,
because Firefox's client rect includes the stroke and Chromium's does not. The
tightest Kyrie pair has about 2 units between the inks, so its outline falls
back to zero padding and the stroke still clears the neighbour by about 1.2 px
in both browsers. Visual inspection of
`kyrie-flat-whole-neume.png`, `kyrie-compact-whole-neume.png` and
`compact-whole-neume.png` (focus ring removed for review) confirms complete
dashed outlines on all four sides.

Standard gate passed: format:check, lint, 94 Vitest files / 2,042 tests, build
(existing large-chunk warning) and git diff --check. Ranges driver run
`07-10-31-929Z-hpYWBu`: Chromium and Firefox passed (31.3 s wall clock).

## Baseline failures, not waived

The following eight failures reproduce on an untouched detached worktree at
`9f25ad8`; no application modifications or changed assertions were used there:

- `lyric-move` Chromium: missing Move syllable button after pointer selection.
- `lyric-spacing` Chromium: Close note properties assertion.
- `lyric-spacing-selection-cue` Firefox: pointer target outside viewport.
- `word-composition` both: native accidental-selection assertion in the
  intra-syllable review.
- `note-modifiers` Chromium: export hook remains null at cached-source download.
- `extended-scandicus-climacus` both: missing placement ghost at the later
  narrow/zoom scenario.

Baseline evidence under `/tmp/chant-range-baseline/.verification-runs/`:
`run-2026-11-15T06-28-43-695Z-quvb6e` (five failures),
`run-2026-11-15T06-30-54-252Z-g0GAIK` (modifier failure), and
`run-2026-11-15T06-32-33-355Z-voN0GP` (two extended-neume failures).
All baseline runs cleaned up successfully. These failures remain unresolved;
the full suite is not reported as passing. Across full and focused runs, 30
supported driver/browser pairs passed and eight retain baseline failures;
six pairs are unsupported.

## Visual evidence and remaining acceptance

The final range jobs save `cross-system.png`, `kyrie-cross-system.png` and
`kyrie-narrow.png` beneath their `driver-tmp/chant-ranges-*` directories.
Screenshots are local diagnostics, not refreshed historical specimens.
Inspection confirmed pale-purple connected system bands, legible ink, untinted
lyrics, separate focus cues and no individual selected outlines on range members.

Owner foreground acceptance remains: dense and wrapped Kyrie XI passages,
keyboard usability and focus under real browser/OS zoom, horizontal overflow,
IME/draft recovery, native menus and spoken screen-reader feedback. Headless
runs do not establish those behaviors or final visual approval. Clipboard,
range deletion/movement/transposition and non-contiguous selection stay deferred.

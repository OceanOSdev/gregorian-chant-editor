# Plan: Stage 7A — Local document persistence and native JSON interchange

Branch: `feat/stage-7a-local-persistence`
Target: `master`

## Problem and user-visible goal

The deployed preview starts from `exampleDocument` on every load and says
"edits are lost on refresh." Enable authors to close or refresh the page and
resume their **committed** chant, and to export/import the full score as a
portable native JSON file. This is one active browser document, not a document
library or a cloud service.

Read `AGENTS.md`, `docs/ai-workflow.md`, `docs/architecture.md`,
`docs/domain-model.md`, `docs/commands-and-history.md`,
`docs/editor-interactions.md`, `docs/testing.md`, and proposed
[ADR 0016](../adrs/0016-persist-versioned-semantic-chant-documents.md).
The present `ChantEditor` initializes its session with
`createEditorSession(initialDocument)` via `useReducer`;
`history.present` is the committed `ChantDocument`. `App` supplies
`exampleDocument`. Preserve the current semantic → command → layout → SVG
architecture.

## Owner-agreed product direction

1. **Autosave/recovery.** Save the current committed semantic score in
   namespaced `localStorage` on meaningful document changes, including undo
   and redo. Load a valid cache once on startup. An ordinary refresh or new
   browser visit in the same origin/profile resumes the last score. Present
   clear saved/not saved/recovery status; no false "Saved" for drafts that
   have not been committed. Autosave timing is an implementation choice, but
   a refresh immediately after an accepted edit must not lose that edit.
2. **Native file export.** Download current committed document as UTF-8 JSON,
   with a predictable sanitized title-derived `.chant.json` filename
   (reasonable fallback if title blank). Preserve all supported semantic data.
   File export is not the same as `localStorage` or an OS live-linked file.
3. **Native file import.** Choose a `.chant.json` / JSON file, validate the
   whole payload, then replace the active document only after user
   confirmation; new document also asks before replacing existing work.
   Invalid, damaged, unsupported, or overlarge files must not alter the
   active document. Give actionable accessible error feedback.
4. **New.** Provide a blank, valid chant with sensible defaults (initial C
   clef; lyric language Latin; empty music/lyrics/divisions/clef changes),
   distinct from the demonstration example. Starting a new document resets
   selection, placement and undo/redo to a fresh session.
5. **Transparent UI.** Small Document controls (New / Import / Export) and
   unobtrusive autosave status; update the existing preview notice, which
   currently promises refresh data loss. Make browser-local limitations clear
   without misleadingly promising cloud backups.

## Versioned interchange/validation contract

- Introduce a browser-independent codec with a v1 envelope of roughly:

  ```json
  {
    "format": "gregorian-chant-editor",
    "version": 1,
    "document": {
      "title": "Salve Regina",
      "lyricLanguage": "la",
      "clef": { "type": "c", "staffLine": 3 },
      "neumes": [],
      "syllables": [],
      "divisions": [],
      "clefChanges": []
    }
  }
  ```

- Ensure imports, exports, and cached data traverse the **same** full
  validation pipeline, including runtime type checks rather than unsafe
  TypeScript assertions. Reuse existing validators where suitable, and
  explicitly cover exact document shape, required arrays, nested note kinds,
  tuple cardinalities and pitch order, integer staff positions, C/F clef
  values and lines, lyric text/anchors/order/boundaries, valid manual alignment
  grapheme indexes, division/clef slot anchors and ordering, and stable-ID
  uniqueness across **all** entity types. Preserve valid IDs and original
  semantic order. Reject non-finite/noninteger positions and invalid enum
  values. Permit empty scores.
- Reject unknown future schema versions clearly rather than importing
  partial structures, and define a small safe input-size bound before JSON
  parsing to reduce accidental resource exhaustion. Do not invent a
  migration from a pre-existing persisted format: none exists.
- Keep persisted payload free of history, hover, focus, selection, tool,
  pending prompts/drafts, derived layout, SVG, and browser references.
- No GABC parser/encoder is expected in Stage 7A. Native JSON is an editor
  interchange format, not a claim to Gregorian chant standardization.

## Persistence and destructive-action details

- Use a namespaced localStorage key so other GitHub Pages apps at the same
  origin are unaffected. Guard storage get/set/remove failures and privacy
  restrictions, show an accessible error/unsaved state, and retain in-memory
  edits even when saving fails.
- On initial load, distinguish **no cached value** from **invalid or
  unreadable cached value**. Never overwrite a malformed existing cache with
  the example on the initial render; give a recovery/discard path so the
  original bytes are not silently destroyed. Valid recovery creates a fresh
  history root and does not manufacture undo history.
- Avoid an initial effect that saves `exampleDocument` before hydration.
  Autosave follows actual `history.present` changes, not every React render.
  Prefer writes at committed edit boundaries or a lossless lifecycle-safe
  strategy: refresh immediately after edit must recover it.
- When a second tab modifies the same autosave, avoid silently stomping
  divergent scores. A conservative conflict warning with an explicit
  choice to reload or replace is sufficient; do not build a synchronization
  engine.
- New/import are whole-document replacements; they reset editor transient
  state, draft state, and history, and make the resulting document the active
  autosaved document. Canceled operations leave everything untouched.
- Explicitly resolve active dirty lyric drafts, staged clef transactions,
  and any other in-progress edits before New/Import/Export: guard against
  silent data loss or falsely implying draft contents were exported/saved.
  Prefer existing session prompt conventions; no broad workflow refactor.
- If imported content is valid but long enough to render unusual layouts,
  that is not an excuse for modifying semantic pitch/notes during load.
  Document current engraving limits rather than mutate imported scores.

## Implementation boundaries

Prefer small separable modules with pure codec/validation tests and a
browser storage adapter. Do **not** put serialization logic in `ScoreSvg`
or add mutable semantic state alongside `history.present`.
Determine precise UI/module placement from current code. Avoid new runtime
dependencies unless justified. Add or amend owning docs for the native file
format, browser recovery behavior, user-visible workflow, and compatibility
obligations.

ADR 0016 is currently **Proposed**. Obtain owner approval and update the ADR
status in the agreed review flow **before** implementing a conflicting
architecture or treating the proposed persistence contract as Accepted.
If approval is still pending when Codex begins, stop at that guard and ask.

## Acceptance criteria and verification

- First visit without cache shows expected initial score; an explicit New
  creates a blank valid score.
- Edit neumes, notes, lyrics (including language and manual alignment),
  divisions, and mid-score C/F clefs; refresh and verify exactly equivalent
  semantic content, IDs, and visible notation. Repeat after undo/redo.
- Export a realistic multi-system score; import after a New; compare complete
  semantic document equality and layout-relevant results, including lyric
  boundaries, divisions and clef changes. Test an empty score too.
- Import valid content with existing IDs without minting new IDs. Invalid
  files (broken JSON, unsupported version, malformed inner arrays,
  duplicated IDs, dangling anchors, invalid tuples/clefs/alignment,
  oversize) leave current document/history unchanged.
- Canceling New/Import and abandoning a file picker preserve current
  history, drafts, and autosave; accepted replacements reset history and
  transient UI. Export/new/import while a lyric draft or clef edit is
  pending follow an explicit, non-lossy, user-visible policy.
- Simulate unavailable/throwing/quota-exceeded storage and corrupt cached
  JSON; editor still runs, does not overwrite corrupt input silently,
  and accurately reports lack of persistence.
- Test cross-tab conflicting saves or document why an explicit warning
  cannot be provided and stop for owner approval before silently overwriting.
- Run `npm run format:check`, `npm run lint`, `npm test`,
  `npm run build` and relevant Chromium/Firefox browser drivers, plus
  owner-usable foreground manual check instructions. Verify production
  GitHub Pages repository-subpath loading and refresh recovery.
- Update README, roadmap, relevant guides/verification notes, and preview
  notice to match implemented behavior; distinguish automated browser
  verification from manual checks not run.

## Out of scope

- Multiple saved chants/document library and search.
- Account creation, backend, database, cloud sync, cross-device transfer,
  or automatic file-system synchronization.
- GABC import/export, PDF/audio export, playback, and new notation features.
- Persisting undo/redo history or per-tab cursor/focus/layout state.
- General file migration framework beyond version-1 detection and an
  explicit future-version rejection policy.
- Broad UI redesign or unrelated cleanup/refactors.

## Open questions and stop conditions

- Stop for the ADR 0016 acceptance gate above. Normal implementation
  details (e.g. module names, which accessible status surface, filename
  sanitizer and precise autosave mechanism) belong to Codex.
- If unavoidable compatibility/validation gaps or a significantly different
  multi-tab/draft policy emerge, report evidence and options instead of
  guessing, loosening validation, or sacrificing user data.

## Delivery

Follow `docs/ai-workflow.md`: implement on this branch after the ADR gate
is settled, commit, and open a PR targeting `master`. Do not merge.
Report real tests and browser evidence, any deviations, failure modes,
and an owner-friendly manual acceptance checklist. Keep this plan accurate
during review; close it out per the documented PR workflow.

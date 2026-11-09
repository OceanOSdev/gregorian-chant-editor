# Plan: Bundled Pater Noster example and Load Example control

Branch: `feat/bundled-pater-noster-example`
Target: `master`
Status: **Ready for Codex implementation; not owner-accepted.**

## Goal

Make a substantial, user-authored chant available to everyone as a bundled,
offline-capable example. An editor user chooses **Load example → Pater Noster**
from the document controls and receives an explicit confirmation before their
active score is replaced. The existing starter/example first-visit behavior,
native format and browser-local persistence contracts remain intact.

## Agreed decisions

- The owner-supplied, final corrected native v3 file is committed unmodified
  at `src/editor/examples/pater-noster.chant.json` on this branch. **Use this
  committed file as the canonical input**; do not regenerate from GregoBase,
  the original uploaded filename, the older typo versions, or newly inferred
  GABC. It contains 103 neumes (95 Punctum, 4 Clivis, 4 Podatus), 111 notes,
  103 lyric syllables, 13 divisions, ten mora marks and three horizontal
  episemata. Its last phrase reads “sed libera nos a malo.”
- This example was transcribed by the project owner using the
  [GregoBase Pater noster (A) reference](https://gregobase.selapa.net/chant.php?id=3326).
  GregoBase states its chant transcriptions are
  [CC0/public domain](https://gregobase.selapa.net/?page_id=2).
  Add a concise attribution/source link in documentation and, where natural,
  the example selector/help UI. Do not embed their score image. Note that
  our current editor cannot yet author some vertical episemata visible in the
  source; the bundled fixture intentionally contains only supported notation.
- Provide a compact, accessible **Load example** affordance alongside existing
  New / Import / Export controls; initially one selectable choice, **Pater
  Noster**, with a structure that can accommodate a few examples later.
  A native select or equivalently simple control is acceptable. A native
  confirmation must explicitly name the selected example and explain that
  the active score and undo/redo history will be replaced; advise Export
  before discarding work. Cancel is a strict no-op.
- On confirmation reuse the **existing document replacement path** and
  guarded synchronous autosave. Start a fresh editor session/history root,
  without clobbering cached bytes if existing conflict/invalid-cache recovery
  blocks saving. Make any unsaved status truthful; don't claim success merely
  because the in-memory score changed. Do not replace or clear the cache on
  startup, and do not alter the established single autosave key.
- Respect all current document-action guards: pending lyric drafts, clef
  transactions, lyric moves, pending history prompts, concurrent file reads,
  and cached-source recovery safeguards. Keep the title draft behavior
  consistent with the other document actions. Native keyboard operation and
  responsive wrapping at 320px are required.
- Keep the existing small initial fallback/example score for a first visit;
  **loading the bundled Pater Noster is always a deliberate user action**.
  Import remains the separate user-file workflow.

## Scope / exclusions

- Only bundle the owner-authored fixture; implement the Load example control
  and focused tests/documentation. Prefer existing `DocumentControls`,
  `usePersistedSession`, `decodeDocument` and `replace` interfaces.
  Validate the bundled JSON with the same v3 codec as user imports instead
  of introducing a parallel shape, conversion pipeline, or mutable global
  document singleton. Avoid unnecessary new dependencies.
- Do **not** change musical pitches, note IDs, words, syllable boundaries,
  divisions, rhythmic signs or their alignment just to make the fixture load.
- Do **not** implement vertical episema/ictus (planned as a separate Stage 8C),
  GABC import, a document library, cloud storage, backend, extra schema
  versions, automatic seeding/migration, or general persistence refactors.
- The earlier issue of insufficiently visible warnings when autosave is blocked
  stays a separate follow-up. Do not weaken error or cache-conflict safeguards.
  Small truthful status/confirmation improvements directly necessary for
  Load example are in scope.
- No ADR change is expected; stop with evidence if a proposed implementation
  conflicts with Accepted ADR 0016 or the persistence contract.

## Verification / acceptance

1. The committed source is valid strict native v3 JSON. Test through
   `decodeDocument` and, where useful, re-encoding to v3. Assert title,
   language, clef, counts, exact final phrase, sign counts and that note and
   neume IDs / division anchors survive loading. Protect the fixture from
   accidental truncation or alteration.
2. A user can select Pater Noster, see its name in the confirmation, cancel
   without any document/history/cache mutation, then choose again and load
   it. The old active score is replaced only after confirmation; after load,
   an immediate refresh recovers the Pater Noster unchanged from the
   existing cache key. Edits after loading remain undoable/autosaved normally.
3. Loading must not break New, Import, Export or title editing. Exporting the
   loaded example produces a valid native v3 snapshot that round-trips,
   including mora and horizontal episema. Subsequent New/Import operations
   still behave as before.
4. With an incompatible cached draft-v2 file or a cross-tab cache conflict,
   loading must not silently overwrite protected bytes or falsely claim the
   new score was saved. Exercise blocked states and the existing recovery
   choices on disposable browser profiles, without clearing owner data.
5. Verify keyboard activation/focus, narrow widths (320px), no accidental
   selection upon cancel and no ugly permanent toolbar overflow. Include
   Chromium and Firefox browser checks if available; test Vite dev and
   production preview at the project subpath where practical.
6. Run `npm run format:check`, `npm run lint`, `npm test`,
   `npm run build`, and `git diff --check`. Report exact outcomes and
   separately identify manual checks not run.

## Documentation

Update the authoritative native persistence/document-controls guide and
the concise README description. Link the example's GregoBase reference and
CC0 statement without implying it is an exact complete facsimile (vertical
episemata remain deferred). If touching the roadmap, correct its historical
stale sentence suggesting PR #65 still awaits merge; keep that edit tiny.

## Delivery

Implement and test on this branch; make focused commits and open a PR to
`master`. Include before/after UI screenshot(s), exact test results,
uncertainties, any deviation and a small manual acceptance checklist. Do
not merge. After owner acceptance/merge, Stage 8C vertical episemata can be
planned separately.

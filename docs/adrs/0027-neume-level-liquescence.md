# 27. Model liquescence as an authored appearance of Podatus and Clivis

Date: 2026-11-15

## Status

**Accepted — owner-approved 2026-11-15.** Stage 10B implementation is
authorized by the owner decisions on PR #89. Implementation and foreground
acceptance remain pending. This extends, not amends, Accepted ADRs
[0004](0004-use-explicit-neume-types-and-ordered-tuples.md),
[0017](0017-model-rhythmic-modifiers-on-notes.md)–[0021](0021-author-b-accidentals-at-neume-boundaries.md)
and [0007](0007-share-derived-neume-engraving-geometry.md). ADR 0019's scope
boundary already lists liquescence as excluded; acceptance of this record
supplies that separate decision without editing ADR 0019.

## Context

The owner's repertoire target, the Dominican _Salve Regina_ (GregoBase
#4577, _Completorium O.P._ 1949, pp. 119–120), cannot continue at _Ad te_
without liquescent neumes. The [research record](../verification/liquescent-notation/README.md)
inventories six two-note liquescences: three epiphonus, two cephalicus, one
augmentative pes (Eia). All are independent two-note neumes at a second.

Evidence that shapes the model:

- The Roman/Solesmes print labels the forms **“Epiphonus or liquescent
  Podatus”** and **“Cephalicus or liquescent clivis”** (_Liber Usualis_
  p. xxij). It treats liquescence as a qualification of the ordinary
  neume's whole figure.
- The printed constructions change the figure as a whole. The epiphonus
  has a curved lower body and a hooked terminal in place of a second head.
  The cephalicus has a reduced terminal and a narrower total width. Neither
  is an ordinary notehead scaled down.
- GABC marks liquescence once, “at the end of the neume”. Gregorio
  selects whole-figure glyphs (`PesOneDeminutus`, `FlexusOneDeminutus`,
  `PesQuadratum…Descendens`).
- Pitch contour, cardinality, stable note identity and lyric anchoring are
  identical to the ordinary Podatus/Clivis. The _Liber_ (§ IV.10) explicitly
  denies any change of duration.

## Options considered

1. **Note-level appearance** (`ChantNote.liquescence`, or a new `NoteForm`).
   This reuses the ADR 0019 whitelist machinery. However, it stores a
   figure-wide construction on one constituent, so the whitelist must forbid
   it on every note except a Podatus/Clivis terminal. Deletion and moves then
   leave a "surviving liquescent note" that has no figure. It collides with
   `form` (a NoteForm variant cannot coexist with the quilisma on the same
   tuple without a separate compatibility rule). A validated note-level field
   is possible, but the whole-figure property avoids a terminal-index whitelist.
2. **Neume-level appearance on the existing kinds** (accepted). One
   optional field on `PodatusNeume` and `ClivisNeume`. Kind, tuple, contour
   validation, IDs and anchors are unchanged. The name is derived:
   Podatus + diminutive = epiphonus, Clivis + diminutive = cephalicus.
   `mapNeumeNotes` already spreads Podatus/Clivis, so moves, clef
   translation, form/modifier edits and the clipboard preserve the field
   unchanged (audited).
3. **Dedicated kinds** (`epiphonus`, `cephalicus`, …). The topology is the
   same as Podatus/Clivis, so ADR 0004's reason for a kind (a distinct
   melodic contour) does not apply. ADR 0019 already rejected
   proliferating kinds for appearance (e.g. `QuilismaNeume`). Every kind
   switch (mora matrix, forms, deletion tables, geometry, palette,
   clipboard, codec) would have to be duplicated. Toggling would change
   `kind` and widen each command's surface. Its one advantage, exhaustive
   compile-time switching, can be recovered with exhaustive validity tables
   and tests.

## Decision

1. Add an optional, authored, neume-level field:

   ```ts
   /** Authored liquescent construction of a two-note neume (ADR 0027). */
   export type PodatusLiquescence = 'diminutive' | 'augmentative-descending';
   export type ClivisLiquescence = 'diminutive';

   export interface PodatusNeume {
     id: string;
     kind: 'podatus';
     notes: [ChantNote, ChantNote];
     liquescence?: PodatusLiquescence;
   }

   export interface ClivisNeume {
     id: string;
     kind: 'clivis';
     notes: [ChantNote, ChantNote];
     liquescence?: ClivisLiquescence;
   }
   ```

   Omission means ordinary. No `'none'` value and no derived name, width or
   path is persisted. The owner approved `'augmentative-descending'` on Podatus only (D2).
   This value selects the sourced Dominican offset pes with a thin descending
   terminal stroke, not the standard rounded Greciliae ending. No other kind
   carries the field.

2. **Validity** (enforced in `isValidNeume`, shared by commands, paste and
   decoding). The pitch contour is the existing strict Podatus/Clivis rule at
   any interval. The field may appear only on those two kinds, with an
   allowed value. **Product deferrals**: none of these is a historical
   prohibition.
   - No liquescence on a quilismatic Podatus. Gregorio can encode `gwi~`,
     but no print evidence was collected.
   - The liquescent second note carries no mora, horizontal episema or
     vertical episema.
   - The first note keeps its existing marks. Mora scope is restricted to
     `none` or `first`.

3. **Editing**. Toggling is one atomic command on the neume ID that changes
   only the field. It is rejected without history if the result is invalid
   (for example, marks on the second note); nothing is cleared silently.
   Note moves keep liquescence while the contour stays strict; inversion
   or unison is rejected as today. Clef translation, accidentals and lyric
   anchors are unchanged. Copy/paste preserves the field with fresh IDs
   under the existing pitch-conflict policy.

4. **Deletion** of either constituent (gate D5). The accepted policy is
   that the figure ceases to exist, so the survivor becomes an **ordinary
   Punctum**. This is a documented normalization in the same undoable
   transaction, with a status announcement. It is not a transfer of a
   note property, because the property belonged to the deleted two-note
   figure. Preserve the surviving note ID, pitch, compatible marks, neume ID
   and lyric anchor; ordinary accidental reconciliation applies to deletion.
   Three-to-two-note reductions never create liquescence.

5. **Engraving**. Use the Roman/Solesmes profile from the _Liber Usualis_
   table as the primary silhouette, with Gregorio's default Greciliae as a
   secondary check. Geometry is original measured SVG; no font outlines are
   copied. The geometry is shared by the ghost preview and the committed
   layout, as ADR 0007 requires. Each constituent keeps its own anchor,
   focus and hit target, and a reduced terminal gets an ordinary-sized
   target. The cephalicus is narrower than the clivis, and its advance,
   compaction, lyric centring and wrapping derive from measured ink. The
   augmentative Podatus is an offset pair of full heads with a thin descending
   terminal on the upper head, based on the Dominican print (Eia, p. 119) and
   Gregorio's op font as secondary evidence. Its wider ink and separate anchors
   are derived by the same shared geometry. This is a bounded exception to the
   Roman/Solesmes profile, not a document profile or a claim of universal
   augmentative notation.

6. **Persistence**. Native **v10** adds the optional key on Podatus/Clivis
   only. v1–v9 readers are unchanged and continue to reject the key under
   their own version tags. v10 writes it, so v9 documents (including the
   owner's fixture) load unchanged. Version handling otherwise follows the
   existing [persistence contract](../persistence.md), including automatic
   saving at accepted document replacement/import and committed semantic edits;
   cache hydration alone does not force a migration write.

7. There is no automatic liquescence from text, no playback or duration
   semantics, no GABC interchange, and no per-document notation profile.

## Consequences

- Positive: this is the smallest semantic change. Existing reconstruction
  paths preserve the field, and the ordinary/liquescent toggle is
  identity-safe.
- Negative: `isValidNeume`, deletion normalization, the codec and the
  mora/mark matrices all gain a neume-field dimension. Extending the field
  to Torculus/Porrectus/Scandicus/Climacus later would first require
  `mapNeumeNotes` to stop rebuilding those kinds as `{ id, kind, notes }`.
  The cephalicus's new width touches spacing regression baselines.
- Out of scope: single-note Dominican liquescents (_osténde_, _Virgo_),
  other augmentative forms, liquescent three-plus-note neumes,
  initio debilis, Scandicus subpunctis, compound grouping and Dominican bars.

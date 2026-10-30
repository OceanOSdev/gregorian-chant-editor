# Neume-anchored lyrics with continuous entry

Status: proposed implementation plan. No application changes implemented.

## Summary and architectural assessment

Reverse the relationship: neumes remain independent musical entities; syllables identify their starting neumes by stable ID. Infer membership from semantic order rather than storing associations on neumes.

Keep pure commands, document-snapshot history, shared engraving geometry, and ID-based selection/focus. Remove active-syllable constraints on music insertion.

The revised UX uses a visible Lyrics action and scoped L shortcut, persistent Lyrics mode, `_` skipping, commit-on-navigation, explicit existing-syllable editing, and insertion pausing at occupied anchors. Tab/Shift+Tab retain native focus traversal. Preserve order-constrained anchor correction and minimal engraving with music-only wrapping.

## Domain and editing contracts

```ts
interface LyricSyllable {
  id: string;
  text: string;
  startsAtNeumeId: string;
  boundaryBefore: 'word' | 'continuation';
}
```

Remove `lyricSyllableId` from every semantic neume type. Retain ordered neume and syllable arrays. Boundary metadata generates hyphens; do not introduce word entities, anchor tables, or persistent ownership caches.

Required anchors simplify this milestone. Future lyrics-first placement can extend this representation while retaining identity, text, boundary, and lyric order.

### Invariants

- Anchors reference existing neumes; at most one syllable anchors each neume.
- Syllable order strictly matches semantic anchor order.
- The first syllable starts a word.
- Committed text is nonblank and contains no whitespace.
- Empty documents, music without lyrics, and lyricless prefixes are valid.
- Membership comes from the nearest preceding anchor, including an anchor on the neume itself.
- Membership, span endpoints, coordinates, and system assignments are never persisted semantically.
- Invalid and unchanged commands return the exact input document reference.
- Preserve surviving IDs and share unaffected objects.

The final syllable extends to document end. Explicit lyricless passages after lyrics begin require a future extension. Provide small pure validation, lookup, and ownership helpers; derive maps during individual passes where useful.

### Music commands

Insert at any valid whole-neume boundary without changing anchors. Graphical placement uses the hovered system's actual boundary without syllable clamping. Contextual insertion follows the selected note's owning neume or selected whole neume; otherwise append. A selected syllable supplies its anchor neume as reference.

Resolve pitch from the selected note, selected neume's final note, or final document note; retain kind-specific empty-document fallbacks. Preserve contours, fit checks, previews, and persistent placement tools. Standardize boundary, identity, and contour validation, including Punctum insertion.

Deleting a neume atomically deletes its anchored syllable while preserving other neumes and anchors. Normalization preserves neume identity and its anchor; final-note deletion follows complete-neume deletion. Preserve unsupported-contour rejection.

### Lyric commands

Provide free-anchor creation, text update, deletion, boundary correction, reassignment, and atomic draft commit. Creation inserts at the corresponding lyric position and preserves existing boundaries; a new first syllable starts a word.

Reassignment stays strictly between neighboring anchors. Reject occupied, missing, and crossing targets; unchanged targets are no-ops. Never reorder lyrics, swap anchors, or change music.

On deletion, the successor starts a word if either its existing boundary or the deleted syllable's boundary started a word; otherwise it remains a continuation. A new first syllable starts a word. Lyric deletion never deletes music.

## Continuous entry UX

### Activation and lifetime

Unmodified L activates Lyrics only from focused notation in Select mode. Ignore editable fields, composition, and modifier chords. Retain I/T outside lyric input. The visible Lyrics control exposes active state.

Lyrics mode persists through commits, skips, and target clicks. Enter/Save commits without exiting. Done commits and exits. Escape cancels the current draft and exits, retaining previous commits. Starting Lyrics clears placement previews and selects the Select tool. Activating a music tool resolves drafts through Done's policy.

An empty score explains that music is needed first; create no placeholders.

### Explicit insertion and editing

Draft intent is either Insert at a free neume or Edit a specific syllable ID. An insert must never become an update because its target is occupied; revalidate against the reducer's latest document.

Opening Lyrics at occupied notation pauses with existing text and an explicit Edit syllable action. Single-clicking engraved text selects without editing or activating Lyrics. Double-clicking, Enter, or Edit opens existing text with a normal cursor; typing on a selected syllable starts replacement. Clicking notation requests insertion, not replacement. Ordinary editing never selects all text automatically.

### Draft resolution

Deliberate navigation includes target clicks, sequential advancement, Skip, and reassignment activation.

| Draft                   | Navigation policy                                                           |
| ----------------------- | --------------------------------------------------------------------------- |
| Valid changed text      | Commit once, then navigate.                                                 |
| Unchanged existing text | Navigate without history.                                                   |
| Empty new draft         | Navigate without creation.                                                  |
| Cleared existing text   | Preserve original, announce that clearing did not delete it, then navigate. |
| Nonempty invalid text   | Retain draft/target, explain error, and block score navigation.             |

Deletion is explicit: Delete/Backspace on a selected syllable and the Delete syllable button preserve all neumes, select the former anchor and focus its first note. They open no input and preserve whether Lyrics mode was active. Delete/Backspace inside an input remain native character deletion. Reselecting the current target preserves its draft. Blur neither commits nor discards. Tab/Shift+Tab traverse normally without changing the lyric target; mode and draft survive. Returning through Lyrics resumes entry. Escape explicitly cancels. Switching semantic workflows must resolve dirty drafts rather than silently discard them.

### Delimiters and skipping

Ignore command interpretation during composition and repeated navigation from autorepeat.

| Input                               | Behavior                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `-` after valid text                | Commit; target next neume with pending continuation.                                  |
| Space after valid text              | Commit; target next neume with pending word boundary.                                 |
| `-` on selected existing syllable   | Preserve text; begin continuation insertion after it.                                 |
| Space on selected existing syllable | Preserve text; begin new-word insertion after it.                                     |
| `_` on empty insertion target       | Skip that neume; target next, retaining pending boundary.                             |
| `_` after valid text                | Commit current text, skip following neume, target the one after it with continuation. |
| Enter/Save                          | Commit and remain at the selected committed syllable in Lyrics mode.                  |
| Tab/Shift+Tab                       | Native focus traversal, no lyric-target movement.                                     |

Example: `Al`, `-`, `_`, `le` anchors Al at neume 1 and le at neume 3; neume 2 belongs to Al. A visible Skip neume action follows `_` semantics.

After Enter/Save, typing intentionally edits the selected committed syllable; delimiters begin insertion after it. Repeated `-`/Space on an empty draft changes pending boundary without advancing or creating anything. `_` advances.

ASCII `-`, `_`, and whitespace are entry controls. Accents, Greek characters, and ordinary punctuation remain text. Reject pasted separators or whitespace with an explanation; do not split passages. Provide Starts word / Continues word controls, constraining the first syllable to word start.

### Occupied anchors

Sequential insertion pauses at an existing anchor without editing it. Display existing text and announce occupancy. Offer Edit syllable, Skip neume, or target selection. Typing must not replace content; explain that Edit is required.

`_` skips occupied notation without changing existing text, boundary, or anchor. Passing an existing anchor clears the incoming pending boundary; default subsequent insertion to word start, with continuation explicitly selectable. Pausing keeps Lyrics mode active and preserves earlier commits.

Clicking an arbitrary free target defaults to word start. Pending continuation follows sequential skipping, not arbitrary jumps.

### End of music

Commit valid current text and remain in a visible End of music state, retaining pending boundary. Create no syllable or neume placeholder. Clicking existing music continues entry. When music is appended while waiting, resume at the first newly available neume without reactivation. Notation shortcuts work with notation focus; letters inside lyric input remain text.

### Anchor correction

Move syllable anchor offers click targeting or Previous/Next and Left/Right browsing. Enter confirms; Escape cancels reassignment and restores the preceding Lyrics state. Resolve drafts before activation. Display only legal destinations between neighbors; announce occupied/crossing rejection. Commit once, preserving music and syllable identity.

## State, engraving, and history

One authoritative transient session workflow owns mode, target, insert/edit intent, draft/original values, pending boundary, occupied/end states, reassignment, and ID-based focus requests. No placeholders enter the document. Extend selection to syllables and remove active-syllable music constraints.

Use native input with stable focus across reflow. Engraved lyrics are named keyboard-accessible controls with visible focus/selection. Announce skips, occupancy, invalid navigation, reassignment, and end state.

If a dirty draft's target disappears or changes externally, preserve it in paused recovery with explicit retry-at-target or discard actions. Never apply stale edits to a different entity.

### Minimal engraving

Retain music-only advances/wrapping and existing whole-string, kind-specific alignment. Render each lyric once at its anchor's system.

Generate one centered hyphen before a continuation syllable when measured bounds permit the mark plus four layout units clearance on each side. Across systems, use an outgoing hyphen if it fits before staff end. Suppress marks that do not fit; add no incoming marks, repeated chains, or extenders.

A small browser adapter measures matching SVG fonts and supplies pure engraving calculations. Measurements stay outside semantics/history and never change wrapping. Existing lyric overlap remains documented.

### History

Keep DocumentHistory unchanged. Each commit, boundary correction, reassignment, deletion, or anchored-neume deletion is atomic. Skips/navigation only create history when first committing valid text.

Native input undo remains browser-owned. Explicit score Undo/Redo resolves dirty drafts through Save / Discard / Cancel before navigating semantic history. Reconcile transient targets by stable IDs; do not snapshot UI state in history.

## Implementation stages

1. **Anchor model and independent music:** types, invariants, helpers, commands, deletion, direct-anchor layout, fixtures, validation, ADR; remove insertion clamping/gating. Keep the app functional.
2. **Continuous entry:** scoped L, explicit insert/edit intent, delimiters, `_`, commit-on-navigation, occupied pause, end-of-music resumption, native traversal, recovery, history integration.
3. **Anchor correction:** constrained reassignment, candidate feedback, keyboard controls, draft integration.
4. **Hyphens and verification:** measurements, derived marks, responsive browser/accessibility verification, limitations.

Each stage includes tests and owning-guide updates. Avoid dual semantic models. Remove obsolete group insertion resolution, active-syllable fallbacks/existence checks, normalization association copying, first-associated-neume discovery, and no-syllable placement cancellation.

## Testing and migration

Cover invariants, membership, insertions around anchors, deletion/normalization for all kinds, boundary repair, constrained reassignment, identities/sharing/no-op references, and atomic history.

Workflow coverage includes L scope; continuous commits/clicks/skips/appended music; `_` on empty/valid/invalid/occupied/final targets; native Tab preserving drafts; valid navigation commits; empty insertion no-ops; cleared edits preserving originals; invalid navigation without focus trapping; insertion never overwriting occupied anchors, including stale events; intentional replacement; Escape; dirty-draft history resolution; target recovery; reflow focus; hyphen fit and unchanged music geometry.

Run formatting checks, lint, Vitest, and production build for implementation stages. Manually verify real input, focus, shortcuts, native undo, pointer targeting, accessibility, and narrow layouts.

No persistence currently exists, so no runtime migration/schema change is needed. Convert examples/fixtures explicitly: anchor valid legacy groups at their first neume, preserve IDs, deliberately resolve unassociated fixtures, and specify word boundaries without guessing from text. Future saved formats must be versioned.

## ADR and documentation

Add ADR 0008 covering anchored syllables, inferred spans, boundaries, deletion, and required anchors. Partially supersede ADR 0003's relationship direction while preserving identity. Retain ADRs 0002, 0004, 0005, and 0007.

Update domain, commands/history, interactions, layout/rendering, architecture, testing, glossary, and roadmap guides alongside implementation.

No automatic syllabification, bulk entry, persistence, internationalization framework, or expanded notation scope is included.

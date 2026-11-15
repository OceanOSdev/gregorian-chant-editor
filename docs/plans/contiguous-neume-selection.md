# Plan: Contiguous multi-neume selection

Branch: `feat/contiguous-neume-selection`
Target: `master`

Status: Implemented; automated verification recorded in
[contiguous selection verification](../verification/contiguous-selection/README.md).
Owner foreground acceptance and PR review pending.

## Goal and scope

Make it easy to select complete musical passages, including across systems and
long documents, as the foundation for a subsequent music-only copy/paste
milestone. The bundled Kyrie XI motivates the workflow. Build on the sticky
editing toolbar and division palette merged in PR #86.

The owner chose context-sensitive Shift-click, connected selection highlighting
per system, and selection only. Clipboard operations, range deletion, range
movement/transposition, non-contiguous selection, drag/marquee selection and
a new selection mode are out of scope. Do not start repertoire transcription,
engraving changes or vertical-spacing refinements.

## Architectural contract

Follow [editor interactions](../editor-interactions.md),
[commands and history](../commands-and-history.md), and accepted
[ADR 0002](../adrs/0002-separate-semantic-and-derived-state.md) and
[ADR 0003](../adrs/0003-use-stable-semantic-identities.md).

Extend the existing transient `EditorSelection` discriminated union with:

```ts
{
  kind: 'neume-range';
  anchorNeumeId: string;
  endpointNeumeId: string;
}
```

- Both endpoints are inclusive, stable neume IDs in `document.neumes`.
  The anchor stays fixed during extension; the endpoint can cross it.
  Resolve membership in ascending semantic document order, regardless of
  selection direction, staff position, system membership or graphical layout.
- Equal endpoints normalize to the existing single whole-neume selection.
  A range therefore contains at least two neumes. Invalid endpoints never
  produce a partial or guessed range. A stale event target must not create an
  invalid selection or accidentally edit the document.
- Use pure helpers for target-to-neume resolution, canonical inclusive
  membership and extension/reconciliation. Expose a useful shared semantic
  range resolver (ordered neumes/IDs and their document bounds) for rendering
  and future clipboard work. Exact helper names and result types are ordinary
  implementation decisions. Derive membership once per relevant document/
  selection, not by repeatedly scanning the document for every rendered note.
- Keep selection distinct from browser focus, semantic commands, document
  history, persistence and engraving. No system IDs, pixel coordinates,
  cached graphical selection membership, new document fields, schema changes,
  or new dependencies. A selection-only action must preserve the exact
  semantic document/history and must not trigger a save or invalidate redo.
- A range selects complete neumes including their constituent notes. It can
  cross lyric, division and clef-change boundaries; these do not stop
  selection. Lyrics, clefs, divisions, separately written accidentals and
  generated custodes are not individually selected. Do not settle what
  associated material will be copied later. Existing accidental ownership,
  placement and effective-pitch semantics are untouched.

## Pointer and keyboard interaction

All new range gestures apply only to enabled score-note controls in ordinary
Select mode, outside active lyric entry/move, pending history, clef transactions,
accidental anchor placement and other exclusive interaction modes. Preserve
existing transaction ownership, IME/editable-target exclusions, shortcut
scope, native Tab traversal and menu dismissal. Do not repurpose Ctrl/Meta/Alt
combinations or unrelated keys.

- Unmodified click, Enter or Space selects the constituent note, replacing
  any range. Existing whole-neume selection with Shift-click or
  Shift+Enter/Space is generalized as follows:
  - No musical selection (none, syllable, clef, division or accidental):
    select the target's complete neume.
  - Selected note: its owning neume supplies the anchor. If the target is in
    the same neume, promote to whole-neume selection; otherwise select the
    inclusive passage from the anchor to the target's neume.
  - Single selected neume: it supplies the anchor. Same-neume activation
    retains it; another neume creates a range.
  - Existing range: retain its anchor, move the endpoint to the target's
    owning neume. Contracting to the anchor normalizes to single-neume
    selection; the next extension can proceed in either direction.
  - This intentionally changes the previous Shift activation of a different
    neume from replacement to extension. Do not add a modifier or mode to
    restore the old replacement behavior; plain click then Shift-click
    can still select any single whole neume.
- Shift+Left/Right on an enabled score note moves the existing musical
  selection's endpoint by one neume in semantic order, not one constituent
  note, graphical staff position or system. A selected note or single
  neume supplies both initial endpoints; if there is no musical selection,
  the focused note's owning neume supplies the initial anchor/endpoint.
  Clamp at document bounds. With no range possible at a bound, normalize to
  whole-neume selection; an existing boundary selection remains unchanged.
  Permit repeated extension, contraction and direction reversal. Unmodified
  Left/Right remains unchanged. Do not broaden Up/Down pitch commands.
- For Shift activation of a target note, retain/request that invoking
  constituent as the focus destination as in current whole-neume selection.
  For Shift+Left/Right, request the new endpoint's first semantic note
  through existing focus-request/acknowledgement machinery. A no-op at a
  document boundary should not cause unnecessary focus/scroll changes.
- Tab/Shift+Tab changes focus, never range membership, and remains native.
  Use existing stable focus restore and sticky-toolbar-aware minimal reveal,
  including when the endpoint is in another system or the horizontal score
  viewport scrolls. Do not refocus the anchor on extension or reflow.
- Preserve existing lyric-mode navigation, dirty drafts, recovery and move
  behavior instead of attempting range gestures inside those modes.
  Clicking an explicit accidental/clef/division/lyric control selects that
  entity under its current rules, replacing the range when selection occurs.

## Lifecycle and operation safety

- Escape and a score background click clear a range in ordinary Select mode.
  Merely focusing a note, another notation entity, or a toolbar control,
  scrolling, zooming or reflowing must not change selection. Clicking the
  already-active Select tool retains its existing behavior.
- Successfully arming a placement tool (neume, clef or division) clears a
  range, without altering existing single-selection placement semantics or
  remembered-neume I/T behavior. Do not clear on a rejected mode transition.
- A range cannot implicitly supply a single lyric target. The global Lyrics
  button is unavailable while a range exists, with a discoverable explanation
  to select one target. The existing focused-note/syllable L shortcut is
  explicit intent: on successful lyric entry, leave the range and use that
  single target. Apply the same principle to explicit lyric-control activation.
  Preserve non-range selection/focus semantics and all existing draft guards.
- Undo/Redo remains document-history navigation, not selection history.
  Reconcile a range against the resulting document: keep its original object
  if both endpoints survive, clear it if either is missing. Interior insertion
  joins the interval, interior removal contracts it, unrelated edits and
  normalization of surviving endpoint neumes retain it. No guessing replacement
  endpoints, no restoring a cleared selection from history. Preserve existing
  stable focused-entity restoration, independently of range membership.
- New, import, example load, session/document replacement and recovery reload
  reset selection through the existing document replacement path.
- No range-level edit operations in this milestone. While a multi-neume range
  exists, Delete/Backspace or Up/Down on a score note must not delete/move one
  member, the whole passage or an unrelated note. Separate visual range
  membership from the existing single-note/whole-neume command eligibility
  flags. Existing note and neume editing works unchanged after explicit
  single selection (including contraction to one neume).
- Block the global Insert remembered neume button and I shortcut for ranges,
  with a clear instruction to choose a single insertion target. Guard in the
  reducer/resolver as well as UI/shortcut handling; the current insertion
  resolver falls back to append when no single target resolves. Do not let I
  silently append, insert at an arbitrary endpoint, or first replace a range
  with a merely focused division/clef and bypass the guard. Preserve T and
  the remembered neume/variant. Do not implicitly replace the range on
  pressing an unavailable operation.
- No single-note/accidental contextual properties or stale selected/last-
  focused division edit fieldset should be presented as range operations.
  Suppress division editing controls while a range is selected even if
  native focus has visited a division; explicit selection restores their
  normal behavior. Preserve existing explicitly targeted non-neume editing
  semantics outside range-level operations (e.g. a focused lyric/clef control
  with its documented direct edit shortcut); these act on their single
  target, never on range members. If such an edit requires entering a
  transaction, leave the range on successful entry; otherwise reconcile
  it as with other document changes.
- Audit every consumer of EditorSelection, including selection-to-syllable,
  selection-to-focus, toolbar insertion, lyric transitions, clef transactions,
  accidental placement and contextual property eligibility. No silent
  fall-through to a single-note target or end-of-document append. Do not
  weaken transaction guards or change established non-range operations.
  Prefer an explicit range branch over changing the meaning of existing
  single-selection helpers. Range-to-single-syllable resolution returns
  null; any fallback must be guarded at the caller.

## Visual and accessible presentation

- Use a connected pale-purple selection band for each affected derived
  system. The first and last affected system regions begin/end at selected
  neume bounds; complete intervening systems cover their selected neumes.
  Use existing system and neume geometry, with sensible padding and
  ownership boundaries to avoid implying adjacent unselected neumes are
  included. No separate individual-neume outline for every range member.
- Keep notation legible; draw behind musical ink, do not tint the lyric row
  or change staff, glyph, hit-target or layout geometry. Avoid extending
  beyond the selected neumes to system-edge clefs, custodes or unused staff.
  Interstitial division/clef signs may lie within a connected passage band
  but must not receive individual selected styling or semantics. Use
  existing derived geometry; do not introduce engraving fields solely
  for selection. Exact overlay geometry, padding, color and clipping are
  implementation choices subject to visual review.
- Overlay is decorative, aria-hidden, pointer-inert, no new Tab stops. Keep
  existing red note-selection and dashed whole-neume cues for those states;
  browser keyboard focus must remain independently visible inside a range.
- Add a compact visible "N neumes selected" status and Escape-to-clear hint
  within or adjacent to the sticky tools, without a significant toolbar
  redesign. Use existing live-announcement infrastructure to announce
  meaningful range selection/extension/clear transitions, not every focus
  or scroll event. A range member's accessible description should convey
  membership without falsely marking each constituent as individually
  selected or changing its single-note command semantics. Update existing
  score/palette keyboard instructions and help. No new ARIA roles that
  misrepresent the current controls.
- Reflow recalculates overlay regions from stable membership. Verify wide,
  narrow, dense melisma/compaction, long scroll and horizontal overflow
  cases, and ensure the count does not make sticky tools unusable.

## Verification and acceptance

Follow AGENTS.md and [testing](../testing.md). Prefer pure tests for selection
and reducer contracts and real browser actions for pointer/keyboard/focus.

Pure coverage:

- Same-neume promotion, no/nonmusical selection, forward/backward ranges,
  inclusive canonical order, constituent-note-to-neume resolution.
- Extend, contract, reverse direction, collapse to ordinary single neume,
  clamp at both boundaries, invalid/stale IDs and empty documents.
- Reconciliation on unrelated edits, normalization, interior insert/delete,
  missing endpoints and undo/redo; selection-only actions preserve document
  and history identity/redo. Explicit document replacement clears ranges.
- Range guards for insertion (including direct resolver/reducer paths),
  note/neume operations and lyric-entry behavior; existing single selection,
  explicit non-neume and exclusive-mode behavior remains intact.
- Where overlay segmentation is pure, test per-system membership/bounds,
  no unselected neighboring neumes, and forward/backward equivalence.

Browser coverage (Chromium and Firefox via the existing runner):

- Use a dedicated range-selection driver registered in the runner, or a
  clearly scoped extension of existing coverage. Use a deterministic
  multi-system fixture with varied neumes, lyrics, divisions, clefs and
  accidentals; also load the bundled Kyrie XI for realistic long-score
  cross-system authoring. Do not depend solely on synthetic helper calls.
- Actual click/Shift-click and keyboard Shift+Enter/Space, Shift+Left/Right,
  Tab/Shift+Tab, Escape, forward/backward extension, same-neume promotion,
  crossing/collapsing the anchor and native focus reveal across systems.
- Selection remains stable after scrolling and resize/reflow, connected
  overlays cover only the selected span on each system, and count/focus
  cues remain correct. Verify selection does not change exported/persisted
  document bytes or create a history entry; undo/redo reconcile as specified.
- Verify range membership does not enable note/neume Delete/Backspace or
  Up/Down or I insertion, including focused divisions/clefs, stale context
  controls, and non-selected note focus. Confirm normal single-neume
  edits and placement still work. Exercise lyric/clef/division/accidental
  guards, contextual panel availability and existing remembered-neume
  behavior. Ensure menus and sticky reveal still behave normally.
- Run the standard gate (format:check, lint, test, build, git diff --check)
  and relevant existing browser drivers in supported browsers, including
  lyric navigation/entry, placement/selection, divisions, mid-score clefs,
  accidentals/contextual controls, bundled examples and persistence.
  Inspect driver assumptions about the intentionally changed Shift-click
  case; update only affected expectations, preserve assertions for
  unchanged behavior. Given the shared interaction changes, a broader
  browser matrix is warranted if targeted results reveal broad regressions;
  record coverage accurately, including known unsupported browsers or
  existing failures. Do not claim foreground keyboard, real zoom or
  screen-reader testing from headless runs.
- Owner acceptance: visually review connected selection on dense and wrapped
  Kyrie XI passages, focus, keyboard usability, and selection lifecycle
  during actual editing in the foreground. Include screenshots or a short
  recording if practical, with actual verification evidence and caveats.

## Documentation and delivery

Update the owning interaction guide, relevant testing/roadmap documentation
and any durable rendering contract affected by the overlay. Existing ADRs
already support this design; no new ADR is expected unless implementation
discovers a genuine architectural conflict. Keep the plan available for
review; do not duplicate the authoritative contract across guides.

Read the implementation and affected tests before coding. Owner choices
above are settled; proceed directly, using focused implementation checks.
Stop and report options only for material conflicts or significant scope
expansion. Do not silently change the approved gestures, connected visual
feedback, or selection-only scope.

Commit and push to this branch, open a PR targeting master, and report the
implementation SHA, PR URL, verification actually performed, deviations,
limitations, and remaining owner acceptance checks. Do not merge.

Next separate milestone: design music-only clipboard semantics (including
pitch context, written accidental ownership/placement, structural events,
destination boundaries, new IDs and atomic undo). No clipboard implementation
or preliminary clipboard schema in this PR.

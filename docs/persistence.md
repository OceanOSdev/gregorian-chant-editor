# Native documents and browser recovery (Stage 7A)

[Accepted ADR 0016](adrs/0016-persist-versioned-semantic-chant-documents.md)
sets the architectural contract. The semantic model remains authoritative;
[history](commands-and-history.md) and [layout](layout-and-rendering.md) are not
saved. This guide owns native format compatibility and browser recovery.

## Native versions 1 and 2

`src/editor/persistence/native-document.ts` is the browser-independent codec.
The UTF-8 JSON envelope has exactly `format: "gregorian-chant-editor"`,
`version: 2`, and `document: ChantDocument`. The reader accepts v1 and v2. All seven document properties are
required, including empty `neumes`, `syllables`, `divisions`, and `clefChanges`
arrays. Optional syllable alignment is supported in both versions. V2 additionally accepts
optional note fields `mora: 1 | 2` and `episema: true`; absence means off.
Explicit zero/false/null, incorrect types and unknown fields reject. V1 retains
its exact original note shape (`id`, `staffPosition` only), rejecting modifiers.
Unknown fields at every object level, invalid enums, missing fields, invalid
note tuples/contours, positions outside JavaScript’s safe integer range, duplicate/nonblank-ID
violations, invalid lyric text/order/boundaries/alignment, and dangling or
mismatched slot anchors reject the entire payload. No coercion or ID reminting
occurs. Array order is preserved; divisions and clefs retain their documented
within-slot ordering, rather than being sorted globally.

Import, export and cache recovery use this same validation pipeline. Both file
size before reading and UTF-8 payload size before JSON parsing are bounded at
1 MiB. Export also enforces the limit, so every successful export can be read
by this reader. An oversized in-memory score remains editable, with an unsaved
status explaining export failure if necessary. Empty scores are valid. Valid
extreme pitches are retained even when current engraving exceeds fixed vertical
staff spacing; loading never transposes or repairs them.

Staff positions at the native boundary must satisfy `Number.isSafeInteger()`
(inclusive range −9,007,199,254,740,991 to 9,007,199,254,740,991), so imported
integers are represented exactly by JavaScript numbers. The reader rejects
out-of-range input rather than rounding or clamping. This validation also applies
to export and cache recovery; it does not expand engraving limits or change the
internal `StaffPosition` model.

The v1 schema is now a compatibility obligation. Future domain changes must
explicitly retain a v1 reader or introduce a versioned migration; unknown
versions and formats reject clearly. V1 decoding preserves every semantic value and ID with no signs; encoding
always writes v2. There is no reinterpretation of unknown versions. Native JSON is an editor format, not GABC or a notation standard.

## One active browser score

`browser-document.ts` guards storage access and owns the namespaced key
`gregorian-chant-editor:active-document:v1`. The literal key is deliberately
retained for Stage 8A: its suffix identifies the established single-score slot,
not the envelope version. Hydration leaves existing v1 bytes untouched. The next
successful committed save writes v2 into that same key, after comparing the
original observed bytes. No second slot, startup rewrite, removal or unguarded
migration write exists. Existing corrupt/foreign caches and cross-tab protection
retain their exact recovery policy. Older builds cannot read a v2 score, but
must present their existing explicit recovery path rather than overwrite it. `use-persisted-session.ts` reads
once per mounted editor initialization (development StrictMode may probe the
initializer twice without writes), then creates a fresh session/history root.
An absent cache shows the supplied example without writing it. A valid cache
restores the complete committed document. An invalid or unreadable cache leaves
the example usable with a visible unsaved recovery message; automatic writes
remain blocked until the user explicitly loads or replaces the cache.

The hook executes the existing pure session reducer once per dispatched action,
then synchronously saves when `history.present` changes, before publishing the
next React state. It uses a ref to serialize batched actions against the latest
session; that ref is the session itself, not a second semantic score. No effect
writes the initial example, and hover/focus/draft-only actions never write.
Accepted edits, undo and redo are recoverable on immediate refresh after the
action finishes. Storage/serialization failures retain in-memory edits and show
**Not saved**. Refresh can only recover the last successful committed save.
Undo history, selection, placement, pitch policy, drafts and layout reset on load.

Each save first compares current cache bytes with the last observed bytes.
Storage events and window focus also check for changes. A detected difference
blocks subsequent automatic writes and warns that another tab changed the cache.
The editor does not merge documents. **Load cached score** confirms replacing
this tab and its history; **Replace cache with this score / Retry save** confirms
replacing cached bytes with this tab's committed score. Export both versions
before choosing if both matter. Corrupt bytes are retained until explicit
replacement. Unavailable storage can be retried through the same controls.
Comparison is conservative best-effort conflict detection, not transactional
cross-tab synchronization: localStorage offers no atomic compare-and-set, so
truly simultaneous writes remain a platform limitation.

## Document controls

The compact document header sits directly above the score. The title is the
single visible heading, with secondary New / Import / Export actions aligned
right; narrow viewports wrap these into another row.

Activate the title by pointer or native button keyboard activation to edit it.
The heading becomes a focused text input with an accessible name and keyboard
instructions. Typing updates only a component-local draft. Enter or blur commits
one semantic title edit and synchronously attempts autosave; Escape cancels
without changing history, redo or cached bytes. Enter/Escape restore focus to
the heading button; blur follows the user's next focus target. Composition
Enter does not commit. Unchanged text creates no history entry. Document actions
also explicitly commit an open title before acting, so Export includes its
current text even if the browser did not deliver blur first. A canceled New or
Import does not undo a title already accepted by leaving the title editor.

Undo/Redo restores committed titles along with the rest of the document. Native
files and title-derived filenames use the committed title. Empty titles display
“Untitled chant” as an editing affordance and export as `untitled.chant.json`.
The title follows the same pending-workflow and file-reading guards as the
other Document controls. Refresh recovers the last committed title, not an
unfinished title draft.

Normal saved/recovered state is summarized as “✓ Saved locally.” The storage
adapter exposes this as an explicit saved-state flag rather than having the UI
parse status prose. Dirty title drafts, pending editor workflows and unsaved
states remain visible. Storage errors and conflicts retain detailed messages and
explicit recovery/retry actions. File errors remain in an alert; successful
file operations announce short confirmations to assistive technology without
adding permanent visual paragraphs. The storage limitations and backup advice
are available through the native keyboard-accessible **About local saving**
disclosure instead of a permanent disclaimer.

**New** confirms replacing work and creates a blank Latin chant with C clef on
line 3 and title “Untitled chant.” **Import** reads and validates the selected
JSON file before confirming replacement. Canceling a dialog, abandoning the
picker, or rejecting a file preserves the current document, history and drafts.
Accepted replacements start a fresh session/history and attempt autosave; if a
cache conflict is pending, the replacement stays in memory until explicit cache
resolution. File errors are announced through an accessible alert.

**Export** downloads only the committed score as JSON. The filename uses a
sanitized, bounded title plus `.chant.json`, falling back to `untitled.chant.json`.
An exported file is a portable snapshot, not an OS-linked file or cloud backup.

Dirty/recovery lyric drafts, clef transactions, lyric moves and pending history
prompts disable all document and cache-replacement operations. The adjacent
status explains how to proceed: finish or explicitly cancel the existing workflow
first. No draft is implicitly committed or discarded. Saved feedback distinguishes the **committed** score from pending unsaved edits. A clean
lyric context or armed placement tool can be replaced; the new session resets it.

Storage is origin/profile-specific, may be cleared, restricted or exhausted,
and provides neither a document library nor cross-device backup. Export files
for long-term retention. See [verification](verification/local-persistence/README.md)
for automated evidence and foreground acceptance steps.

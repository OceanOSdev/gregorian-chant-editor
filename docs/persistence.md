# Native documents and browser recovery (Stage 7A)

[Accepted ADR 0016](adrs/0016-persist-versioned-semantic-chant-documents.md)
sets the architectural contract. The semantic model remains authoritative;
[history](commands-and-history.md) and [layout](layout-and-rendering.md) are not
saved. This guide owns native format compatibility and browser recovery.

## Native version 1

`src/editor/persistence/native-document.ts` is the browser-independent codec.
The UTF-8 JSON envelope has exactly `format: "gregorian-chant-editor"`,
`version: 1`, and `document: ChantDocument`. All seven document properties are
required, including empty `neumes`, `syllables`, `divisions`, and `clefChanges`
arrays. Optional syllable alignment is the only optional semantic field.
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
versions and formats reject clearly. There is no older persisted format to
migrate. Native JSON is an editor format, not GABC or a notation standard.

## One active browser score

`browser-document.ts` guards storage access and owns the namespaced key
`gregorian-chant-editor:active-document:v1`. `use-persisted-session.ts` reads
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

**Title** is a labeled text field bound directly to the committed semantic title.
Each input change creates one ordinary history entry and synchronously attempts
autosave; unchanged values create no history entry. There is no separate title
draft or Apply step. Undo/Redo restores title changes along with the rest of the
semantic document. The heading, recovered score, native export content and
sanitized export filename all use that same title. Empty titles are allowed and
export as `untitled.chant.json`. The field follows the same pending-workflow
and file-reading guards as the other Document controls.

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
first. No draft is implicitly committed or discarded. Saved status always names
the **committed** score and separately explains pending unsaved edits. A clean
lyric context or armed placement tool can be replaced; the new session resets it.

Storage is origin/profile-specific, may be cleared, restricted or exhausted,
and provides neither a document library nor cross-device backup. Export files
for long-term retention. See [verification](verification/local-persistence/README.md)
for automated evidence and foreground acceptance steps.

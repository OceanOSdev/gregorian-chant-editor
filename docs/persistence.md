# Native documents and browser recovery (Stage 7A)

[Accepted ADR 0016](adrs/0016-persist-versioned-semantic-chant-documents.md)
sets the architectural contract. The semantic model remains authoritative;
[history](commands-and-history.md) and [layout](layout-and-rendering.md) are not
saved. This guide owns native format compatibility and browser recovery.

## Native versions 1–8

`src/editor/persistence/native-document.ts` is the browser-independent codec.
The UTF-8 JSON envelope has exactly `format: "gregorian-chant-editor"`,
`version: 8`, and `document: ChantDocument`. The reader accepts exact v1–v8. The original seven document properties are
required, including empty `neumes`, `syllables`, `divisions`, and `clefChanges`
arrays. Optional syllable alignment is supported in every version. V2–v8 additionally accept
optional note fields `mora: 1` and `episema: true`; absence means off.
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
always writes v8. There is no reinterpretation of unknown versions. Native JSON is an editor format, not GABC or a notation standard.

## One active browser score

`browser-document.ts` guards storage access and owns the namespaced key
`gregorian-chant-editor:active-document:v1`. The literal key is deliberately
retained for Stage 9B-2: its suffix identifies the established single-score slot,
not the envelope version. Hydration leaves existing v1–v7 bytes untouched. The next
successful committed save writes v8 into that same key, after comparing the
original observed bytes. No second slot, startup rewrite, removal or unguarded
migration write exists. Existing corrupt/foreign caches and cross-tab protection
retain their exact recovery policy. Older builds cannot be assumed to read a v8 score, but
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
single visible heading, with secondary New / Import / Export / Load example actions aligned
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

## Finalized Stage 8A v2 and withdrawn draft recovery

[ADR 0018](adrs/0018-conventional-mora-patterns.md) finalizes the unmerged v2:
only mora presence (`1`) in the supported neume patterns is canonical. V1
remains exact; compatible draft-v2 scores load normally. Old strict v2 syntax
is validated separately before incompatible counts/patterns receive a
resolution-required error naming affected notes. Malformed data is still
rejected; permissive legacy syntax never enters canonical state.

No value is clamped, discarded or assigned to another note. Failed imports
leave score/history intact and offer the original File bytes for download.
Cached strings remain untouched under the existing key and block automatic
saving. **Download original cached source** preserves the original source,
including whitespace, independently of the fallback score's **Export**.
Existing confirmed reload/replacement, pending-workflow and cross-tab guards
remain. Source download does not commit edits or require resolving pending work.
Explicit replacement warns users to retain source and current work separately.
There is no automatic converter; revise unsupported intent in a compatible
editor or retain the original for later resolution.

## Authored forms in native v3 (Stage 8B)

V3–v5 additionally permit optional note `form` with exact values `virga`,
`inclinatum` and `quilisma`. The shared within-neume whitelist and strict pitch
contour checks reject unsupported configurations. Explicit default/null/false,
unknown strings/types and unknown fields reject before document replacement.
V1/v2 field whitelists remain unchanged; they reject all form fields. V2's
separate full old-syntax validation and withdrawn-draft recovery are retained.

Importing/hydrating v1/v2 never synthesizes forms or changes note identities,
marks, lyrics or event order. Hydration does not write; the next committed edit,
including undo/redo, saves v5 through the same cache key and byte conflict guard.
Exports and confirmed imports write v5. Failed imports and unreadable caches
retain their existing original-source download/replacement safeguards. Older
app versions cannot be assumed to import v3. See the
[migration and browser record](verification/note-shapes/implementation.md).

## Bundled examples

**Load example** deliberately replaces the active score after a
native confirmation naming the example, warning that undo/redo history is reset,
and advising Export first. Cancel leaves the score, history and cache unchanged
(apart from a title already committed by leaving its editor, as with New/Import).
The selector resets so the same example can be chosen again. It shares all pending
workflow and file-reading guards. Loading decodes the bundled native JSON through
the import codec, creates a fresh session and attempts guarded synchronous autosave.
Recovery/conflict protection remains in force: an in-memory load is not proof of
saving; consult the local saving status and existing recovery choices. Startup
still uses the small fallback score and never seeds the cache with this example.

Adding a `.chant.json` file directly to `src/editor/examples/` automatically
registers it through `import.meta.glob()`. IDs retain the relative file paths;
display names come from codec-validated document titles and are sorted by name.
Invalid files are omitted with a console error identifying the path and validation
failure, so they cannot block startup. Tests validate every discovered source
independently and fail for invalid examples before deployment. Keep source bytes
unchanged and record verified provenance and licensing when adding a file.

De Profundis Antiphon is also bundled. Its source and licensing are not documented
in the repository; the owner must supply verified provenance and reuse terms.
Pater Noster's CC0 attribution below does not establish De Profundis's license.

The project owner transcribed the supported notation from
[GregoBase Pater noster (A)](https://gregobase.selapa.net/chant.php?id=3326), whose
transcriptions are [CC0/public domain](https://gregobase.selapa.net/?page_id=2).
The bundled native v4 source includes five owner-authored vertical episemata; it
is not a complete facsimile of the printed edition.

## Vertical episema in native v4 (Stage 8C)

Stage 8C introduced **version 4**. Its note shape adds only optional
`verticalEpisema: true`, independently of v3's fields. Explicit false, zero,
null, strings, objects and unknown keys reject. V1, finalized v2 and v3 retain
exact field whitelists and reject the v4-only field. Shared validation still
rejects malformed nested objects, unsupported forms/contours, invalid IDs and
anchors, unknown envelopes and payloads exceeding 1 MiB. Withdrawn draft-v2
classification continues only after complete legacy-syntax validation.

Hydration of an untouched v1/v2/v3 cache never rewrites its bytes. The next
committed edit/undo/redo writes v5 through the same established storage key,
byte conflict guard and synchronous save path. No conversion invents signs,
forms or IDs. Failed imports, corrupt caches, storage failures and conflicts
retain the original-source recovery and confirmed-replacement protections.
The bundled owner-authored Pater Noster is now an exact committed **v4 source**,
including five vertical episemata. Historical v3 documents remain readable;
older builds reject v4 through their existing recovery path. See [compatibility evidence](verification/vertical-episemata/README.md).

## B accidentals in native v5 (Stage 8D)

The current writer emits **version 5**. Its required eighth document property is
`accidentals`, an array of exact `{ id, kind, ownerNoteId, placement? }` entities.
`kind` is `flat` or `natural`; optional placement is exactly
`{ kind: 'above-note', noteId: string }`. Global ID uniqueness, existing canonical
B ownership, one sign per neume/register and written-location constraints are
validated. Explicit null, malformed/unknown fields, invalid owners and invalid
placements reject the entire import; import never performs editing repair.

Exact v1–v4 field whitelists remain unchanged and reject v5 accidentals. They
hydrate an empty in-memory collection without rewriting original bytes. The next
successful commit/export writes v5 through the existing cache key and byte
conflict guard. Unknown future versions, malformed data, write failures and
cross-tab conflicts retain the established protected recovery behavior. The
bundled owner Pater Noster remains its original v4 source, unchanged.

## Native v6 repeated-note kinds (Stage 9A)

New saves/exports write version **6**, adding `bistropha` and `tristropha` with
exact two/three-note cardinality, equal written pitches and distinct global IDs.
Both accept independent horizontal/vertical episemata and no authored alternate
form or mora. Reject every nonempty mora subset, unknown field, invalid count,
unequal pitch, duplicate identity, invalid sign/anchor and unsupported version.

Exact v1–v5 readers retain their original kind and field whitelists; both new
kinds reject even if encoded with otherwise valid older-version fields. Legacy
hydration preserves original bytes and writes no automatic upgrade. All new
commits write v6 using the unchanged cache key and existing source recovery,
withdrawn draft-v2 protection, synchronous saves and cross-tab guards. There is
no new migration that rewrites IDs, signs, lyric or clef/division data.

## Native v7 Pes subpunctis (Stage 9B-1)

New saves/exports write version **7**, adding the `pes-subpunctis` kind. Its
`notes` array has exactly four (Pes subbipunctis) or five (Pes subtripunctis)
notes with distinct global IDs and the contour p0 < p1 > p2 > p3 (> p4). There
is no count or variant field: the array length is the only cardinality, and
any extra neume field (for example `count` or `variant`) is rejected. Notes
accept independent horizontal/vertical episemata and a mora on the final note
only (the owner-approved none/final matrix); authored forms and every other
nonempty mora subset are rejected.
Other lengths are rejected, never truncated or padded.

Exact v1–v6 readers retain their original kind and field whitelists and reject
the new kind even when its notes use otherwise valid older-version fields.
Legacy hydration preserves original bytes and writes no automatic upgrade. The
cache key, withdrawn draft-v2 recovery, original-source download, size limit
and cross-tab conflict guard are unchanged. Older builds cannot read v7 files,
including v7 files that contain only older kinds.

## Native v8 extended Scandicus and Climacus (Stage 9B-2)

Version 8 lets the existing `scandicus` and `climacus` kinds carry three, four
or five notes
([proposed ADR 0024](adrs/0024-bounded-tuple-union-for-scandicus-and-climacus.md)).
Because the kind names are old, the reader decides by envelope version:

- **Exact v1–v7 readers** keep the original three-note contract. They reject a
  four- or five-note instance with "Three-note neume requires three notes",
  while three-note instances still read unchanged.
- **v8** builds the bounded tuple with `monotonicNotes`. It rejects other
  lengths and then validates the strict contour, count-aware note forms (no
  quilisma on longer groups) and the count-aware mora matrix (none-only for
  longer groups until the owner approves another).

No count, variant or grouping field exists, and an entry-variant name such as
`scandicus-5` is not a valid kind. Every other v7 rule, including Pes
subpunctis, is unchanged. Hydration does not rewrite. The cache key, legacy
draft-v2 recovery, original-source protection and cross-tab guard are
unchanged. Older builds cannot read v8 files, including v8 files that contain
only older kinds.

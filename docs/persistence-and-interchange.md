# Persistence and interchange

## Scope

This guide owns the experimental probe's local document formats, validation,
recovery and interchange boundaries. [Domain model](domain-model.md) owns musical
invariants; [commands and history](commands-and-history.md) owns editing and
session replacement. These formats are implemented on `one-shot-test`; they are
not a promise of a stable public format.

## Chant JSON version 1

Save chant downloads a UTF-8 `.chant.json` file with this envelope:

```json
{
  "format": "gregorian-chant-editor",
  "version": 1,
  "document": {
    "title": "Untitled chant",
    "lyricLanguage": "la",
    "clef": { "type": "c", "staffLine": 3 },
    "syllables": [],
    "neumes": []
  }
}
```

`document` contains the semantic fields described in the domain guide, including
stable neume, note and syllable IDs, word boundaries, explicit lyric language and
any manual alignment segments. JSON is the lossless format for this supported
semantic model. It does not contain layout, view settings, selection, undo/redo
stacks, lyric drafts or browser focus. Opening a file creates a new editor session
instead of appending a semantic history action.

`persistence/chant-file.ts` is the untyped-data boundary. It constructs fresh typed
records, checks the envelope/version, title and language, disallowed control characters, C-clef line, global ID
uniqueness, fixed neume cardinalities/contours, integer pitches, lyric text,
ordered unique anchors and grapheme ranges. Unknown fields do not become part of
the canonical document. There is no migration from an older persisted format;
unsupported versions fail explicitly.

The current file boundaries limit UTF-8 input and formatted output to 2,000,000
bytes. Document collections are limited to 10,000 entries, IDs to 200 characters,
titles to 200 characters, syllable text to 1,000 characters and absolute staff
positions to 1,024. These are file-boundary limits, not guarantees of responsive
editing at those sizes. Typed semantic commands still define their own invariants;
an unsavable document produces a visible file error rather than a partial save.

The file UI validates the candidate's complete saved representation before
replacing the open score. A compact JSON input that expands beyond the formatted
output limit must also fail before replacement. Malformed or unsupported input
leaves the existing document and history intact. A replacement choice warns when
current work, a title draft or a lyric draft would otherwise be discarded. Treat browser download
initiation as a request to save a copy; the app cannot verify the user's eventual
filesystem destination.

## Browser recovery

The app stores one versioned semantic copy in `localStorage` under
`gregorian-chant-editor.document.v1`, approximately 400 ms after a semantic change.
Startup validates that copy through the same parser. With no stored copy the app
opens its Kyrie specimen; an explicit New chant starts blank, with Latin lyric
rules and a C clef on line 3.

Uncommitted lyric drafts and history are deliberately not recovered. The UI names
a dirty lyric draft and blocks file save/export until it is resolved. Browser
close/reload warnings cover pending title/lyric drafts, unsavable documents and work without an available saved
copy; those warnings remain subject to the browser's own restrictions.

A malformed or inaccessible stored copy pauses automatic saving instead of
immediately replacing the stored bytes with the specimen. The UI can download the
browser copy and resume saving explicitly. Quota/security failures are reported,
and file downloads remain the fallback. A storage event from another tab also
pauses this tab's writes, with an explicit resume choice. This is conflict
protection for a single recovery slot, not synchronization, a document library,
a backup service or collaborative editing. Clearing site data can remove it.

## GABC subset

`interchange/gabc.ts` is an adapter around `ChantDocument`, never a replacement
for it. Import requires a header ending in `%%` and one initial `(c1)` through
`(c4)` clef. Supported headers are `name`, `language`, `comment` and `generated-by`;
only title and supported language choices enter the semantic model. Unknown
headers are rejected. GABC input is additionally limited to 1,000,000 JavaScript
string units before parsing, and imported data must pass chant validation and
the UI's complete saved-size check.

The body supports plain lyric syllables and the seven modeled neumes. The
lyric vocabulary is Unicode letters, marks and numbers with apostrophes and
limited sentence punctuation (comma, period, exclamation and question marks);
GABC control/formatting syntax is rejected. A slash
separates successive neumes under one syllable; whitespace between syllabic groups
starts a word, while adjacent groups continue it. Pitches `a` through `m` map to
staff positions −3 through 9 (`d` is the bottom staff line), independently of clef.
Lowercase one-, two- and three-note contours map to the supported square-neume
kinds; Climacus uses a lowercase initial note followed by two uppercase inclinata.
Unsupported repeated pitches, descending all-lowercase triples, bars, ornaments,
text markup, clef changes and longer compounds fail visibly. Many real-world GABC
files consequently require a broader importer than this probe provides.

Export emits the corresponding supported syntax and rejects pitches or text that
cannot be represented. Header titles cannot contain semicolons, percent signs or
line breaks. A GABC round trip preserves the supported musical values,
lyric anchors/order and word boundaries, but regenerates entity IDs. It omits
manual lyric alignment and unmodeled metadata. Keep a chant JSON copy when those
editorial preferences or exact identities matter. The notation reference used for
pitch letters and shapes is the [Gregorio GABC introduction](https://gregorio-project.github.io/gabc/index.html).

## SVG and browser printing

SVG export clones the current score, removes editing overlays, interaction
attributes/targets and instructional descriptions, and adds a self-contained
notation style and document title. It exports a passive vector image, not an
editable semantic score. Text uses the declared local serif font stack rather
than embedded font outlines, so another computer can render metrics differently.

`PrintScore` separately renders passive SVG systems from the same current layout.
Print CSS hides the editor controls and lets the browser paginate between complete
systems, with the score title at the start. Oversized horizontal content is fitted
to the page width; there are no authored page breaks or a dedicated PDF engraving
engine. The operating system/browser may offer Save as PDF in its print dialog.

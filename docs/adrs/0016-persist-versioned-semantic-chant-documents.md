# 16. Persist only versioned semantic chant documents locally

Date: 2026-11-08

## Status

Accepted (owner-approved 2026-11-08)

## Context

The public preview always initializes from `exampleDocument`; refreshing or closing
the page discards committed changes. The canonical `ChantDocument` already
contains lyrics, neumes, divisions, initial and authored clefs, and stable IDs.
`EditorSession` additionally holds undo/redo, selection, focus, hover,
placement state, and unfinished lyric drafts. No persistence format or migration
contract exists yet.

Authors need both automatic same-browser recovery and portable files, without
a backend or accounts. Persisting the entire editor session would couple the
saved format to transient UI implementation, and treating unchecked JSON as a
TypeScript `ChantDocument` would allow invalid runtime data into commands/layout.

## Decision

- Define a native, versioned JSON envelope with a format identifier, integer
  schema version beginning at 1, and the canonical semantic `ChantDocument`.
  File import/export and browser autosave use the same codec and validation.
- Persist the **complete committed semantic document only**. Exclude undo/redo
  history, selections, focus, tools, hover/ghosts, layout, SVG, and unfinished
  editor drafts. Hydrating or importing creates a fresh `EditorSession` with a
  new history root; imported IDs that pass validation are preserved.
- Explicit import validates the entire envelope and document at runtime before
  changing the current document. Reject malformed/oversized payloads, unsupported
  versions, invalid neume and lyric invariants, duplicate/dangling IDs, invalid
  clef/division boundaries, and invalid alignment metadata; report the reason
  without partially replacing the score. Do not coerce bad data into a valid
  score or silently upgrade unknown formats.
- Use browser `localStorage` for **one active document**, with a namespaced
  key and guarded browser-access/error handling. Load once during initialization
  and autosave committed changes, including undo/redo, with no stale or initial
  example write racing ahead of successful hydration. Do not automatically
  overwrite an unreadable cached payload with the example document.
- Provide explicit user actions to create a blank document, import native JSON,
  and export native JSON. New/import require protection for the document being
  replaced; pending lyric drafts must not be silently lost or falsely marked
  saved. Storage failures and conflicts are visible; an exported file is a
  separately portable backup, not an automatically synchronized file.
- Existing architectural boundaries remain: semantic document → pure commands
  → derived layout → SVG. No document-level layout coordinates, general
  persisted score event stream, or backend is introduced.

Schema evolution after version 1 requires an explicit compatible reader or a
versioned migration, not blind type assertions. Browser recovery is best-effort:
private/incognito sessions, browser storage removal, quota limits, and multiple
tabs can affect it. At minimum, another tab's write must not silently overwrite
locally edited content.

## Consequences

### Positive

- Refresh/reopen can restore work while maintaining semantic/layout separation.
- Native exports provide sharable, inspectable, offline backups.
- One validated codec is testable without a browser and can support future
  document upgrades and a separate GABC adapter.
- Import/new start from a clear history boundary rather than replaying stale
  transient state.

### Negative

- The first persisted schema becomes a compatibility obligation.
- `localStorage` is not durable backup, cross-device sync, or multi-document
  storage; it has quota and availability constraints.
- Validation must be maintained whenever the domain expands.
- One active document and explicit replacement prompts are less convenient
  than a future document library; simultaneous tabs require a conflict policy.

## Scope note

This ADR does not commit to multiple stored documents, autosaving undo history,
user accounts, cloud sync, GABC interoperability, or OS-native file handles.

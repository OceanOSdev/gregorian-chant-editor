import type { ChantDocument, LyricSyllable } from '../domain/chant-document';
import { findSyllableAtNeume, isValidLyricText } from '../domain/lyrics';
import { createLyricSyllable } from '../commands/create-lyric-syllable';
import { updateLyricSyllableText } from '../commands/update-lyric-syllable';
import { deleteLyricSyllable } from '../commands/delete-lyric-syllable';
import { updateLyricBoundary } from '../commands/reassign-lyric-syllable';

type Boundary = LyricSyllable['boundaryBefore'];
export interface LyricDraft {
  kind: 'draft';
  neumeId: string;
  original: LyricSyllable | null;
  text: string;
  boundaryBefore: Boundary;
}
export type LyricEntry =
  | LyricDraft
  | { kind: 'ready'; neumeId: string }
  | { kind: 'occupied' | 'selected'; syllableId: string }
  | {
      kind: 'end';
      afterNeumeId: string | null;
      remainingSkips: number;
      boundaryBefore: Boundary;
    }
  | { kind: 'recovery'; draft: LyricDraft };

export type LyricAction =
  | { type: 'start'; neumeId: string | null }
  | { type: 'navigate'; neumeId: string }
  | { type: 'select'; syllableId: string }
  | { type: 'edit'; syllableId: string; replacement?: string }
  | { type: 'text'; text: string }
  | { type: 'advance'; key: '-' | ' ' | '_' }
  | { type: 'save' | 'done' | 'cancel' | 'delete' | 'discard' }
  | { type: 'boundary'; boundaryBefore: Boundary }
  | { type: 'retry'; neumeId: string }
  | { type: 'error'; message: string };

export interface LyricTransition {
  document: ChantDocument;
  entry: LyricEntry | null;
  message: string;
  focus: boolean;
}

export function lyricTargetId(
  document: ChantDocument,
  entry: LyricEntry | null,
): string | null {
  if (!entry) return null;
  if (entry.kind === 'draft' || entry.kind === 'ready') return entry.neumeId;
  if (entry.kind === 'selected' || entry.kind === 'occupied')
    return (
      document.syllables.find((s) => s.id === entry.syllableId)
        ?.startsAtNeumeId ?? null
    );
  return null;
}

export function isDirtyLyricEntry(entry: LyricEntry | null): boolean {
  if (entry?.kind === 'recovery') return true;
  return (
    entry?.kind === 'draft' &&
    (entry.original
      ? entry.text !== entry.original.text ||
        entry.boundaryBefore !== entry.original.boundaryBefore
      : entry.text !== '')
  );
}

function atNeume(
  document: ChantDocument,
  neumeId: string,
  boundaryBefore: Boundary,
): LyricEntry {
  const occupied = findSyllableAtNeume(document, neumeId);
  return occupied
    ? { kind: 'occupied', syllableId: occupied.id }
    : { kind: 'draft', neumeId, original: null, text: '', boundaryBefore };
}

function stale(document: ChantDocument, draft: LyricDraft): boolean {
  if (!document.neumes.some((n) => n.id === draft.neumeId)) return true;
  const current = findSyllableAtNeume(document, draft.neumeId);
  return draft.original
    ? !current ||
        current.id !== draft.original.id ||
        current.text !== draft.original.text ||
        current.boundaryBefore !== draft.original.boundaryBefore
    : Boolean(current);
}

/** Transient drafts survive semantic edits; end-of-music resumes only beyond the previous tail. */
export function reconcileLyricEntry(
  document: ChantDocument,
  entry: LyricEntry | null,
): LyricEntry | null {
  if (!entry || entry.kind === 'recovery') return entry;
  if (entry.kind === 'draft' && stale(document, entry)) {
    return isDirtyLyricEntry(entry)
      ? { kind: 'recovery', draft: entry }
      : document.neumes.some((n) => n.id === entry.neumeId)
        ? atNeume(document, entry.neumeId, entry.boundaryBefore)
        : null;
  }
  if (
    entry.kind === 'ready' &&
    !document.neumes.some((n) => n.id === entry.neumeId)
  )
    return null;
  if (entry.kind === 'end') {
    const after =
      entry.afterNeumeId === null
        ? -1
        : document.neumes.findIndex((n) => n.id === entry.afterNeumeId);
    if (entry.afterNeumeId !== null && after < 0)
      return { ...entry, afterNeumeId: document.neumes.at(-1)?.id ?? null };
    const next = document.neumes[after + 1 + entry.remainingSkips];
    return next ? atNeume(document, next.id, entry.boundaryBefore) : entry;
  }
  if (
    (entry.kind === 'selected' || entry.kind === 'occupied') &&
    !document.syllables.some((s) => s.id === entry.syllableId)
  )
    return null;
  return entry;
}

export function transitionLyrics(
  document: ChantDocument,
  entry: LyricEntry | null,
  action: LyricAction,
  newId: string,
): LyricTransition {
  const result = (
    next = entry,
    message = '',
    nextDocument = document,
    focus = true,
  ): LyricTransition => ({
    document: nextDocument,
    entry: next,
    message,
    focus,
  });
  const target = (
    doc: ChantDocument,
    neumeId: string,
    boundary: Boundary,
  ): LyricTransition => {
    const next = atNeume(doc, neumeId, boundary);
    return result(
      next,
      next.kind === 'occupied'
        ? 'This neume already starts a syllable. Choose Edit syllable or Skip neume.'
        : 'Enter a syllable.',
      doc,
    );
  };
  if (action.type === 'cancel')
    return result(null, 'Lyrics canceled. Earlier commits are preserved.');
  if (action.type === 'error')
    return result(entry, action.message, document, false);
  if (action.type === 'discard') return result(null, 'Draft discarded.');
  if (action.type === 'start') {
    if (entry?.kind === 'ready') return target(document, entry.neumeId, 'word');
    if (entry) return result();
    const neumeId = action.neumeId ?? document.neumes[0]?.id;
    return neumeId && document.neumes.some((n) => n.id === neumeId)
      ? target(document, neumeId, 'word')
      : result(null, 'Add music before entering lyrics.');
  }
  if (!entry) return result();
  if (entry.kind === 'recovery') {
    if (action.type !== 'retry')
      return result(
        entry,
        'Draft target changed. Select a free neume and Retry, or discard the draft.',
      );
    if (
      !document.neumes.some((n) => n.id === action.neumeId) ||
      findSyllableAtNeume(document, action.neumeId)
    )
      return result(entry, 'Select an unoccupied neume to retry.');
    return result(
      { ...entry.draft, neumeId: action.neumeId, original: null },
      'Draft restored at the selected neume.',
    );
  }
  if (entry.kind === 'draft' && stale(document, entry))
    return result(
      { kind: 'recovery', draft: entry },
      'Draft target changed. Retry at a free neume or discard.',
    );
  if (action.type === 'text')
    return entry.kind === 'draft'
      ? result({ ...entry, text: action.text }, '', document, false)
      : result(entry, 'Choose Edit syllable before typing.', document, false);
  if (action.type === 'boundary') {
    if (entry.kind === 'draft')
      return result(
        { ...entry, boundaryBefore: action.boundaryBefore },
        '',
        document,
        false,
      );
    if (entry.kind === 'end')
      return result(
        { ...entry, boundaryBefore: action.boundaryBefore },
        '',
        document,
        false,
      );
    if (entry.kind === 'selected')
      return result(
        entry,
        '',
        updateLyricBoundary(document, entry.syllableId, action.boundaryBefore),
        false,
      );
    return result(
      entry,
      'Choose Edit syllable to change its boundary.',
      document,
      false,
    );
  }
  if (
    action.type === 'navigate' &&
    entry.kind !== 'ready' &&
    lyricTargetId(document, entry) === action.neumeId
  )
    return result(entry);
  if (
    action.type === 'edit' &&
    entry.kind === 'draft' &&
    entry.original?.id === action.syllableId &&
    action.replacement === undefined
  )
    return result(entry);
  // A single commit policy owns Save, navigation, delimiter advancement and mode exit.
  let nextDocument = document;
  let saved: LyricEntry = entry;
  let message = '';
  if (entry.kind === 'draft') {
    if (entry.text !== '' && !isValidLyricText(entry.text))
      return result(
        entry,
        'Enter one syllable without whitespace, hyphens, or underscores.',
      );
    if (entry.text === '') {
      if (entry.original) {
        saved = { kind: 'selected', syllableId: entry.original.id };
        message = 'Empty edit canceled; the original syllable was preserved.';
      }
    } else {
      if (entry.original) {
        nextDocument = updateLyricSyllableText(
          document,
          entry.original.id,
          entry.text,
        );
        nextDocument = updateLyricBoundary(
          nextDocument,
          entry.original.id,
          entry.boundaryBefore,
        );
      } else {
        if (!newId)
          return result(entry, 'Save the lyric draft before changing tools.');
        nextDocument = createLyricSyllable(document, {
          id: newId,
          text: entry.text,
          startsAtNeumeId: entry.neumeId,
          boundaryBefore: entry.boundaryBefore,
        });
        if (nextDocument === document)
          return result(
            entry,
            'Cannot create a syllable here. Existing lyrics were preserved.',
          );
      }
      saved = { kind: 'selected', syllableId: entry.original?.id ?? newId };
    }
  }
  if (action.type === 'save')
    return result(
      saved,
      message ||
        (saved.kind === 'draft' ? 'No syllable created.' : 'Syllable saved.'),
      nextDocument,
    );
  if (action.type === 'done')
    return result(null, message || 'Lyrics finished.', nextDocument);
  if (action.type === 'navigate') {
    if (!nextDocument.neumes.some((n) => n.id === action.neumeId))
      return result(entry, 'That neume no longer exists.');
    const next = target(nextDocument, action.neumeId, 'word');
    return message ? { ...next, message: `${message} ${next.message}` } : next;
  }
  if (action.type === 'select') {
    const syllable = nextDocument.syllables.find(
      (s) => s.id === action.syllableId,
    );
    return syllable
      ? result(
          { kind: 'selected', syllableId: syllable.id },
          message || 'Syllable selected.',
          nextDocument,
        )
      : result(entry, 'That syllable no longer exists.');
  }
  if (action.type === 'edit') {
    const syllable = nextDocument.syllables.find(
      (s) => s.id === action.syllableId,
    );
    if (!syllable) return result(entry, 'That syllable no longer exists.');
    return result(
      {
        kind: 'draft',
        neumeId: syllable.startsAtNeumeId,
        original: syllable,
        text: action.replacement ?? syllable.text,
        boundaryBefore: syllable.boundaryBefore,
      },
      message,
      nextDocument,
    );
  }
  if (action.type === 'delete') {
    if (entry.kind !== 'selected' && entry.kind !== 'occupied')
      return result(entry, 'Select a syllable to delete it.');
    const neumeId = lyricTargetId(document, entry);
    const deleted = deleteLyricSyllable(document, entry.syllableId);
    return neumeId
      ? result(
          { kind: 'ready', neumeId },
          'Syllable deleted; music preserved.',
          deleted,
        )
      : result(null);
  }
  if (action.type === 'advance') {
    if (entry.kind === 'end')
      return result(
        entry,
        'End of music. Add a neume or select music to continue.',
      );
    if (entry.kind === 'occupied' && action.key !== '_')
      return result(
        entry,
        'Choose Edit syllable or Skip neume. Existing lyrics were preserved.',
      );
    const boundary: Boundary =
      entry.kind === 'occupied'
        ? 'word'
        : action.key === ' '
          ? 'word'
          : action.key === '-' || (entry.kind === 'draft' && entry.text !== '')
            ? 'continuation'
            : entry.kind === 'draft'
              ? entry.boundaryBefore
              : 'continuation';
    if (
      entry.kind === 'draft' &&
      entry.text === '' &&
      !entry.original &&
      action.key !== '_'
    )
      return result({ ...entry, boundaryBefore: boundary }, '', document);
    const neumeId = lyricTargetId(document, entry);
    const index = nextDocument.neumes.findIndex((n) => n.id === neumeId);
    const steps =
      action.key === '_' &&
      entry.kind !== 'occupied' &&
      !(entry.kind === 'draft' && entry.text === '')
        ? 2
        : 1;
    const nextIndex = index + steps;
    const following = nextDocument.neumes[nextIndex];
    if (following) {
      const next = target(nextDocument, following.id, boundary);
      return {
        ...next,
        message:
          message ||
          (action.key === '_' && next.entry?.kind !== 'occupied'
            ? 'Neume skipped.'
            : next.message),
      };
    }
    return result(
      {
        kind: 'end',
        afterNeumeId: nextDocument.neumes.at(-1)?.id ?? null,
        remainingSkips: Math.max(0, nextIndex - nextDocument.neumes.length),
        boundaryBefore: boundary,
      },
      'End of music. Add a neume or select music to continue.',
      nextDocument,
    );
  }
  return result(entry);
}

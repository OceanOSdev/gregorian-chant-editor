import {
  canonicalBOwner,
  pitchContexts,
  resolveEffectivePitches,
} from '../domain/accidentals';
import type { ChantDocument } from '../domain/chant-document';

/** Why the selected B sounds as it does. */
export type EffectiveBSource = 'written' | 'inherited' | 'default';

/** Accidental facts about the selected note, for the note properties toolbar. */
export interface SelectedNoteAccidental {
  /**
   * The sign written for this B in its own neume (on the canonical owner,
   * the neume's first note at this B), or undefined when none is written.
   */
  writtenKind: 'flat' | 'natural' | undefined;
  /** How the B sounds, which may come from an earlier sign. */
  effectiveB: 'flat' | 'natural';
  /**
   * `written` when this neume writes a sign for the B. `inherited` when an
   * earlier sign still applies. `default` when no sign applies.
   */
  source: EffectiveBSource;
  /** Toolbar wording, for example `Effective B-flat (inherited).` */
  description: string;
}

/**
 * Project the accidental state of one note. Returns null when the note is not
 * a B, or when the document has no derivable pitch order.
 */
export function projectSelectedNoteAccidental(
  document: ChantDocument,
  noteId: string,
): SelectedNoteAccidental | null {
  const pitch = resolveEffectivePitches(document)?.get(noteId);
  const contexts = pitchContexts(document);
  const owner = contexts ? canonicalBOwner(contexts, noteId) : null;
  if (!owner || !pitch) return null;
  const written = document.accidentals.find(
    (a) => a.ownerNoteId === owner.note.id,
  );
  const effectiveB = pitch.alteration === -1 ? 'flat' : 'natural';
  const source: EffectiveBSource = written
    ? 'written'
    : pitch.sourceAccidentalId
      ? 'inherited'
      : 'default';
  return {
    writtenKind: written?.kind,
    effectiveB,
    source,
    description: `Effective B-${effectiveB} (${source}).`,
  };
}

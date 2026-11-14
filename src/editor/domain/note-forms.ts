import type { Neume, NoteForm } from './chant-document';

export function isNoteForm(value: unknown): value is NoteForm {
  return value === 'virga' || value === 'inclinatum' || value === 'quilisma';
}

export const noteFormLabels = {
  default: 'Default form',
  virga: 'Virga',
  inclinatum: 'Punctum inclinatum',
  quilisma: 'Quilisma',
} as const;

/**
 * The Stage 8B product profile; pitch ordering is checked by isValidNeume.
 * Cardinality-aware (ADR 0024): only the ordinary three-note Scandicus offers
 * a quilisma, so a longer group can never inherit three-note form geometry.
 */
export function allowedNoteForms(
  kind: Neume['kind'],
  index: number,
  noteCount: number,
): readonly NoteForm[] {
  if (kind === 'punctum' && index === 0) return ['virga', 'inclinatum'];
  if (
    (kind === 'podatus' && index === 0) ||
    (kind === 'scandicus' && noteCount === 3 && index === 1)
  )
    return ['quilisma'];
  return [];
}

export function hasValidNoteForms(neume: Neume): boolean {
  return neume.notes.every(
    (note, index) =>
      note &&
      (!('form' in note) ||
        (isNoteForm(note.form) &&
          allowedNoteForms(neume.kind, index, neume.notes.length).includes(
            note.form,
          ))),
  );
}

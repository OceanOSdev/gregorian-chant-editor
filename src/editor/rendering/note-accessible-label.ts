import { noteFormLabels } from '../domain/note-forms';
import type { NoteAppearance, Neume } from '../domain/chant-document';
import { neumeDisplayName } from '../domain/neume';

const ordinals = ['first', 'second', 'third', 'fourth', 'fifth'] as const;

export function getNoteAccessibleLabel(
  kind: Neume['kind'],
  noteIndex: number,
  noteCount = 0,
): string {
  if (
    kind === 'pes-subpunctis' ||
    ((kind === 'scandicus' || kind === 'climacus') && noteCount > 3)
  )
    return `Select ${ordinals[noteIndex]} note of ${neumeDisplayName(kind, noteCount)}`;

  if (kind === 'podatus') {
    return noteIndex === 0
      ? 'Select lower note of podatus'
      : 'Select upper note of podatus';
  }

  if (kind === 'clivis') {
    return noteIndex === 0
      ? 'Select upper note of clivis'
      : 'Select lower note of clivis';
  }

  if (kind === 'scandicus') {
    if (noteIndex === 0) {
      return 'Select lowest note of scandicus';
    }

    return noteIndex === 1
      ? 'Select middle note of scandicus'
      : 'Select highest note of scandicus';
  }

  if (kind === 'torculus') {
    if (noteIndex === 0) {
      return 'Select first note of torculus';
    }

    return noteIndex === 1
      ? 'Select second note of torculus'
      : 'Select third note of torculus';
  }

  if (kind === 'bistropha' || kind === 'tristropha')
    return `Select ${['first', 'second', 'third'][noteIndex]} note of ${kind}`;
  if (kind === 'porrectus') {
    if (noteIndex === 0) {
      return 'Select first note of porrectus';
    }

    return noteIndex === 1
      ? 'Select second note of porrectus'
      : 'Select third note of porrectus';
  }

  if (kind === 'climacus') {
    if (noteIndex === 0) {
      return 'Select highest note of climacus';
    }

    return noteIndex === 1
      ? 'Select middle note of climacus'
      : 'Select lowest note of climacus';
  }

  return 'Select punctum';
}

export const wholeNeumeSelectionInstruction =
  'Shift plus Enter or Space selects the whole neume.';

export function getSelectedNeumeDescription(
  kind: Neume['kind'],
  isSelected: boolean,
  noteCount = 0,
): string | null {
  if (!isSelected) {
    return null;
  }

  return `Whole ${neumeDisplayName(kind, noteCount)} selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.`;
}

export function getNoteModifierDescription(
  note: NoteAppearance,
  paired = false,
): string {
  return (
    (note.form ? '. ' + noteFormLabels[note.form] : '') +
    (note.mora
      ? paired
        ? '. Punctum mora, part of auctum duplex affecting final two notes'
        : '. Punctum mora'
      : '') +
    (note.episema ? '. Horizontal episema' : '') +
    (note.verticalEpisema ? '. Vertical episema' : '')
  );
}

import { isValidLyricText } from '../domain/lyrics';
import type { ChantDocument } from '../domain/chant-document';

export function updateLyricSyllableText(
  document: ChantDocument,
  syllableId: string,
  text: string,
): ChantDocument {
  const syllableIndex = document.syllables.findIndex(
    (syllable) => syllable.id === syllableId,
  );
  const syllable = document.syllables[syllableIndex];

  if (!isValidLyricText(text) || !syllable || syllable.text === text) {
    return document;
  }

  const syllables = [...document.syllables];
  const { alignment: _alignment, ...rest } = syllable;
  syllables[syllableIndex] = { ...rest, text };

  return { ...document, syllables };
}

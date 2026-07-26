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

  if (!syllable || syllable.text === text) {
    return document;
  }

  const syllables = [...document.syllables];
  syllables[syllableIndex] = { ...syllable, text };

  return { ...document, syllables };
}

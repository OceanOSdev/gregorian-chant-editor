import type { ChantDocument, LyricSyllable } from './chant-document';

export function isValidLyricText(text: string): boolean {
  return text.length > 0 && !/[\s_-]/u.test(text);
}

export function findSyllableAtNeume(
  document: ChantDocument,
  neumeId: string,
): LyricSyllable | null {
  return document.syllables.find((s) => s.startsAtNeumeId === neumeId) ?? null;
}

export function findSyllableForNeume(
  document: ChantDocument,
  neumeId: string,
): LyricSyllable | null {
  const index = document.neumes.findIndex((n) => n.id === neumeId);
  if (index < 0) return null;
  let result: LyricSyllable | null = null;
  for (const syllable of document.syllables) {
    const at = document.neumes.findIndex(
      (n) => n.id === syllable.startsAtNeumeId,
    );
    if (at < 0 || at > index) break;
    result = syllable;
  }
  return result;
}

export function hasValidLyricAnchors(document: ChantDocument): boolean {
  let previous = -1;
  const ids = new Set<string>();
  return document.syllables.every((s, i) => {
    const at = document.neumes.findIndex((n) => n.id === s.startsAtNeumeId);
    if (
      ids.has(s.id) ||
      at <= previous ||
      !isValidLyricText(s.text) ||
      (s.boundaryBefore !== 'word' && s.boundaryBefore !== 'continuation') ||
      (i === 0 && s.boundaryBefore !== 'word')
    )
      return false;
    previous = at;
    ids.add(s.id);
    return true;
  });
}

import { expect, it } from 'vitest';
import { nextSyllableId } from './syllable-navigation';

const ids = ['Ky', 'ri', 'e'];
it('browses left/right with wrapping and jumps to either end', () => {
  expect(nextSyllableId(ids, 'Ky', 'ArrowRight')).toBe('ri');
  expect(nextSyllableId(ids, 'ri', 'ArrowLeft')).toBe('Ky');
  expect(nextSyllableId(ids, 'Ky', 'ArrowLeft')).toBe('e');
  expect(nextSyllableId(ids, 'e', 'ArrowRight')).toBe('Ky');
  expect(nextSyllableId(ids, 'ri', 'Home')).toBe('Ky');
  expect(nextSyllableId(ids, 'ri', 'End')).toBe('e');
});
it('leaves activation, Tab and unrelated keys native and handles absent targets', () => {
  for (const key of ['Tab', 'Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown']) {
    expect(nextSyllableId(ids, 'ri', key)).toBeNull();
  }
  expect(nextSyllableId([], 'Ky', 'Home')).toBeNull();
  expect(nextSyllableId(ids, 'missing', 'ArrowRight')).toBeNull();
  expect(nextSyllableId(['Ky'], 'Ky', 'ArrowRight')).toBe('Ky');
  expect(ids).toEqual(['Ky', 'ri', 'e']);
});

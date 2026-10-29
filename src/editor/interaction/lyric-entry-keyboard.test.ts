import { expect, it } from 'vitest';
import {
  isLyricEntryShortcut,
  type LyricKeyEvent,
} from './lyric-entry-keyboard';
const key: LyricKeyEvent = {
  key: 'l',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
};
it('scopes L to notation in Select', () => {
  expect(isLyricEntryShortcut(key, true, false)).toBe(true);
  expect(isLyricEntryShortcut(key, false, false)).toBe(false);
  expect(isLyricEntryShortcut(key, true, true)).toBe(false);
  for (const flag of [
    'ctrlKey',
    'metaKey',
    'altKey',
    'shiftKey',
    'repeat',
    'isComposing',
  ] as const)
    expect(isLyricEntryShortcut({ ...key, [flag]: true }, true, false)).toBe(
      false,
    );
  expect(isLyricEntryShortcut({ ...key, key: 'i' }, true, false)).toBe(false);
});

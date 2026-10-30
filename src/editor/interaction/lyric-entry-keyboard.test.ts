import { expect, it } from 'vitest';
import {
  isLyricEntryShortcut,
  getSyllableKeyAction,
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

it('allows deletion directly from focus while retaining Space selection for entry', () => {
  expect(getSyllableKeyAction({ ...key, key: ' ' }, false, false)).toEqual({
    type: 'select',
  });
  for (const deletion of ['Delete', 'Backspace']) {
    expect(
      getSyllableKeyAction({ ...key, key: deletion }, false, false),
    ).toEqual({ type: 'delete' });
    expect(
      getSyllableKeyAction({ ...key, key: deletion }, true, false),
    ).toEqual({ type: 'delete' });
  }
  expect(getSyllableKeyAction({ ...key, key: ' ' }, true, false)).toEqual({
    type: 'advance',
    key: ' ',
  });
});
it('distinguishes selected replacement, cursor editing, and continuation', () => {
  expect(getSyllableKeyAction({ ...key, key: 'Enter' }, false, false)).toEqual({
    type: 'edit',
  });
  expect(getSyllableKeyAction({ ...key, key: 'K' }, true, false)).toEqual({
    type: 'replace',
    text: 'K',
  });
  expect(getSyllableKeyAction({ ...key, key: 'K' }, false, false)).toBeNull();
  expect(getSyllableKeyAction({ ...key, key: '-' }, true, false)).toEqual({
    type: 'advance',
    key: '-',
  });
  expect(getSyllableKeyAction({ ...key, key: 'Tab' }, true, false)).toBeNull();
});
it('guards lyric keyboard commands during placement, composition, modifiers and repeat', () => {
  for (const value of [' ', '-', '_', 'Enter', 'Delete', 'Backspace']) {
    const event = { ...key, key: value };
    expect(getSyllableKeyAction(event, true, true)).toBeNull();
    for (const flag of [
      'ctrlKey',
      'metaKey',
      'altKey',
      'isComposing',
      'repeat',
    ] as const)
      expect(
        getSyllableKeyAction({ ...event, [flag]: true }, true, false),
      ).toBeNull();
  }
});

it('leaves Tab and Shift+Tab entirely browser-owned without changing selection', () => {
  for (const selected of [false, true]) {
    for (const shiftKey of [false, true])
      expect(
        getSyllableKeyAction({ ...key, key: 'Tab', shiftKey }, selected, false),
      ).toBeNull();
  }
});

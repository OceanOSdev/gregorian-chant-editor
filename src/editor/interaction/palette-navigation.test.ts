import { describe, expect, it } from 'vitest';
import {
  getNotationShortcut,
  nextPaletteTool,
  paletteTools,
} from './palette-navigation';

const event = {
  key: 'i',
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
  isComposing: false,
  repeat: false,
  defaultPrevented: false,
};
describe('palette focus navigation', () => {
  it.each(paletteTools)(
    'wraps focus from %s without activating a tool',
    (tool) => {
      const next = nextPaletteTool(tool, 'ArrowRight');
      expect(next && nextPaletteTool(next, 'ArrowLeft')).toBe(tool);
      expect(nextPaletteTool(tool, 'Home')).toBe('select');
      expect(nextPaletteTool(tool, 'End')).toBe('porrectus');
      expect(nextPaletteTool(tool, 'ArrowDown')).toBe(next);
      expect(nextPaletteTool(tool, 'Enter')).toBeNull();
      expect(nextPaletteTool(tool, ' ')).toBeNull();
    },
  );
  it('routes only unmodified, non-repeating notation shortcuts', () => {
    expect(getNotationShortcut(event, true)).toBe('insert');
    expect(getNotationShortcut({ ...event, key: 'T' }, true)).toBe(
      'focus-palette',
    );
    expect(getNotationShortcut(event, false)).toBeNull();
    for (const flag of [
      'ctrlKey',
      'altKey',
      'metaKey',
      'shiftKey',
      'isComposing',
      'repeat',
      'defaultPrevented',
    ] as const)
      expect(getNotationShortcut({ ...event, [flag]: true }, true)).toBeNull();
    expect(getNotationShortcut({ ...event, key: 'Enter' }, true)).toBeNull();
  });
});

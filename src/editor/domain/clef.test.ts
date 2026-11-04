import { expect, it } from 'vitest';
import { clefName, isValidClef } from './clef';

it('validates all supported initial clefs and names them consistently', () => {
  for (const type of ['c', 'f'] as const)
    for (const staffLine of [1, 2, 3, 4] as const) {
      const clef = { type, staffLine };
      expect(isValidClef(clef)).toBe(true);
      expect(clefName(clef)).toBe(type === 'c' ? 'C (do)' : 'F (fa)');
    }
});

it('rejects malformed clefs at UI and command boundaries', () => {
  for (const value of [
    null,
    undefined,
    'c',
    {},
    { type: 'g', staffLine: 3 },
    { type: 'c' },
    { staffLine: 3 },
    { type: 'c', staffLine: '3' },
    { type: 'f', staffLine: 0 },
    { type: 'f', staffLine: 5 },
    { type: 'c', staffLine: 2.5 },
    { type: 'c', staffLine: NaN },
  ])
    expect(isValidClef(value)).toBe(false);
});

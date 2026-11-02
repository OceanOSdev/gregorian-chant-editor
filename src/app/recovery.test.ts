import { expect, it } from 'vitest';
import { readRecovery, recoveryKey } from './recovery';
import { demoDocument } from './demo-document';
import { serializeChant } from '../editor/persistence/chant-file';

it('restores a versioned browser copy and otherwise starts with the specimen', () => {
  const copy = { ...demoDocument, title: 'Recovered' };
  expect(
    readRecovery({
      getItem: (key) => (key === recoveryKey ? serializeChant(copy) : null),
    }),
  ).toEqual({ document: copy, warning: '' });
  expect(readRecovery({ getItem: () => null })).toEqual({
    document: demoDocument,
    warning: '',
  });
});
it('never writes or discards malformed, unsupported, or inaccessible browser data', () => {
  for (const raw of ['{bad', '{"version":99}', 'null']) {
    const result = readRecovery({ getItem: () => raw });
    expect(result.document).toBe(demoDocument);
    expect(result.warning).toContain('paused');
  }
  expect(
    readRecovery({
      getItem: () => {
        throw Error('Storage blocked');
      },
    }).warning,
  ).toContain('paused');
});

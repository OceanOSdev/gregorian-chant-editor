import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import { layoutChant, type GraphicalNeumeKind } from '../layout/layout-chant';
import { resolveGraphicalNeumePlacement } from './resolve-graphical-neume-placement';

function punctum(id: string): Neume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    notes: [{ id: `note-${id}`, staffPosition: staffPosition(2) }],
  };
}

function documentWith(neumes: Neume[] = []): ChantDocument {
  return {
    title: 'Test',
    clef: { type: 'c', staffLine: 3 },
    syllables: [],
    neumes,
  };
}

function resolveOn(
  document: ChantDocument,
  systemIndex: number,
  kind: GraphicalNeumeKind = 'punctum',
  x = 300,
) {
  const layout = layoutChant(document);
  const system = layout.systems[systemIndex];
  const bottom = system
    ? Math.max(...system.staffLines.map((line) => line.y))
    : undefined;

  if (!system || bottom === undefined) {
    throw new Error('Missing system');
  }

  return resolveGraphicalNeumePlacement(layout, kind, {
    x,
    y: bottom - 24,
  });
}

describe('resolveGraphicalNeumePlacement', () => {
  it.each([
    ['punctum', [2]],
    ['podatus', [2, 3]],
    ['clivis', [2, 1]],
    ['scandicus', [2, 3, 4]],
    ['torculus', [2, 4, 3]],
    ['climacus', [2, 1, 0]],
    ['porrectus', [2, 0, 1]],
  ] as const)('returns a coupled %s result and preview', (kind, positions) => {
    const result = resolveOn(documentWith(), 0, kind);

    expect(result).toMatchObject({
      kind,
      staffPositions: positions,
      insertionIndex: 0,
      preview: { kind },
    });
  });

  it('hits first, middle, and final systems and rejects gaps/outside', () => {
    const document = documentWith(
      Array.from({ length: 30 }, (_, index) => punctum(`${index}`)),
    );
    const layout = layoutChant(document);

    expect(layout.systems.length).toBeGreaterThan(2);
    expect(resolveOn(document, 0)).not.toBeNull();
    expect(resolveOn(document, 1)).not.toBeNull();
    expect(resolveOn(document, layout.systems.length - 1)).not.toBeNull();

    const first = layout.systems[0];
    const second = layout.systems[1];

    if (!first || !second) {
      throw new Error('Missing systems');
    }

    expect(
      resolveGraphicalNeumePlacement(layout, 'punctum', {
        x: 300,
        y: (first.y + first.height + second.y) / 2,
      }),
    ).toBeNull();
    expect(
      resolveGraphicalNeumePlacement(layout, 'punctum', { x: 300, y: -1 }),
    ).toBeNull();
    expect(
      resolveGraphicalNeumePlacement(layout, 'punctum', {
        x: 300,
        y: layout.height + 1,
      }),
    ).toBeNull();
  });

  it('keeps resolving long documents without a global capacity', () => {
    const document = documentWith(
      Array.from({ length: 100 }, (_, index) => punctum(`${index}`)),
    );
    const finalIndex = layoutChant(document).systems.length - 1;

    for (const kind of [
      'punctum',
      'podatus',
      'clivis',
      'scandicus',
      'torculus',
    ] as const) {
      expect(resolveOn(document, finalIndex, kind, 656)).not.toBeNull();
    }
  });
});

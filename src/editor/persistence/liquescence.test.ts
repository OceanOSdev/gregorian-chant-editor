import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import {
  blankDocument,
  decodeDocument,
  encodeDocument,
} from './native-document';
import { BrowserDocument } from './browser-document';
import { insertNeume } from '../commands/insert-neume';
import { updateNeumeLiquescence } from '../commands/update-neume-liquescence';
import wip from '../../../docs/verification/liquescent-notation/fixtures/salve-regina-dominican-wip.chant.json?raw';
import acceptance from '../../../docs/verification/liquescent-notation/fixtures/salve-regina-liquescent-acceptance.chant.json?raw';
import { liquescentFigure } from '../domain/liquescence';

const p = staffPosition;
const envelope = (document: unknown, version: number) =>
  JSON.stringify({ format: 'gregorian-chant-editor', version, document });
const one = (neume: object): ChantDocument =>
  ({ ...blankDocument(), neumes: [neume] }) as unknown as ChantDocument;
const appearances = [
  {
    id: 'e',
    kind: 'podatus',
    liquescence: 'diminutive',
    notes: [
      { id: 'e1', staffPosition: 2 },
      { id: 'e2', staffPosition: 3 },
    ],
  },
  {
    id: 'a',
    kind: 'podatus',
    liquescence: 'augmentative-descending',
    notes: [
      { id: 'a1', staffPosition: 2, mora: 1, episema: true },
      { id: 'a2', staffPosition: 5 },
    ],
  },
  {
    id: 'c',
    kind: 'clivis',
    liquescence: 'diminutive',
    notes: [
      { id: 'c1', staffPosition: 4, verticalEpisema: true },
      { id: 'c2', staffPosition: 3 },
    ],
  },
] as const;

function adapter(initial: string | null) {
  const state = { bytes: initial, writes: 0 };
  const storage = new BrowserDocument(() => ({
    getItem: () => state.bytes,
    setItem: (_key, value) => {
      state.bytes = value;
      state.writes++;
    },
  }));
  return { storage, state };
}

describe('native v10 liquescent appearance (ADR 0027)', () => {
  it.each(appearances)(
    'round trips $kind $liquescence exactly as v10',
    (neume) => {
      const document = one(neume);
      const text = encodeDocument(document);
      expect(JSON.parse(text).version).toBe(10);
      expect(JSON.parse(text).document.neumes[0].liquescence).toBe(
        neume.liquescence,
      );
      expect(decodeDocument(text)).toEqual(document);
    },
  );

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'exact v%s rejects the field under its own version tag',
    (version) => {
      const neume = {
        id: 'e',
        kind: 'podatus',
        liquescence: 'diminutive',
        notes: [
          { id: 'e1', staffPosition: 2 },
          { id: 'e2', staffPosition: 3 },
        ],
      };
      const document = { ...one(neume) };
      const legacy =
        version < 5
          ? (({ accidentals: _a, ...rest }) => rest)(document)
          : document;
      expect(() => decodeDocument(envelope(legacy, version))).toThrow(
        'Unsupported neume appearance for this schema version.',
      );
      // The same file without the field is still exactly readable.
      const plain = {
        ...legacy,
        neumes: [{ ...neume, liquescence: undefined }],
      };
      delete (plain.neumes[0] as { liquescence?: unknown }).liquescence;
      expect(
        decodeDocument(envelope(plain, version)).neumes[0],
      ).not.toHaveProperty('liquescence');
    },
  );

  it.each([
    [
      { kind: 'clivis', liquescence: 'augmentative-descending' },
      'Unknown liquescent appearance',
    ],
    [{ kind: 'podatus', liquescence: null }, 'Unknown liquescent appearance'],
    [{ kind: 'podatus', liquescence: 'none' }, 'Unknown liquescent appearance'],
    [
      { kind: 'podatus', liquescence: 'ascending' },
      'Unknown liquescent appearance',
    ],
    [{ kind: 'podatus', liquescence: 0 }, 'Unknown liquescent appearance'],
  ])('rejects %j', (patch, message) => {
    const pitches = patch.kind === 'clivis' ? [4, 3] : [2, 3];
    const neume = {
      id: 'x',
      notes: pitches.map((s, i) => ({ id: `x${i}`, staffPosition: s })),
      ...patch,
    };
    expect(() => decodeDocument(envelope(one(neume), 10))).toThrow(message);
  });

  it('rejects the key on every other kind and invalid D7/D8 combinations', () => {
    const others = [
      { kind: 'punctum', notes: [2] },
      { kind: 'bistropha', notes: [2, 2] },
      { kind: 'scandicus', notes: [2, 3, 4] },
      { kind: 'torculus', notes: [2, 4, 3] },
    ];
    for (const { kind, notes } of others)
      expect(() =>
        decodeDocument(
          envelope(
            one({
              id: 'x',
              kind,
              liquescence: 'diminutive',
              notes: notes.map((s, i) => ({ id: `x${i}`, staffPosition: s })),
            }),
            10,
          ),
        ),
      ).toThrow('Only a Podatus or Clivis may be liquescent.');
    for (const notes of [
      [{ staffPosition: 2, form: 'quilisma' }, { staffPosition: 3 }],
      [{ staffPosition: 2 }, { staffPosition: 3, mora: 1 }],
      [{ staffPosition: 2 }, { staffPosition: 3, episema: true }],
      [{ staffPosition: 2 }, { staffPosition: 3, verticalEpisema: true }],
      [{ staffPosition: 3 }, { staffPosition: 3 }],
    ])
      expect(() =>
        decodeDocument(
          envelope(
            one({
              id: 'x',
              kind: 'podatus',
              liquescence: 'diminutive',
              notes: notes.map((n, i) => ({ id: `x${i}`, ...n })),
            }),
            10,
          ),
        ),
      ).toThrow();
    expect(() => decodeDocument(envelope(one(appearances[0]), 11))).toThrow(
      'This editor reads versions 1, 2, 3, 4, 5, 6, 7, 8, 9 and 10.',
    );
  });

  it('hydrates v10 bytes without writing, and writes the current version only on commit', () => {
    const bytes = encodeDocument(one(appearances[1]));
    const { storage, state } = adapter(bytes);
    const loaded = storage.load(blankDocument());
    expect(loaded.neumes[0]).toMatchObject({
      liquescence: 'augmentative-descending',
    });
    expect(state.writes).toBe(0);
    storage.save(updateNeumeLiquescence(loaded, 'a', 'diminutive'));
    expect(state.writes).toBe(1);
    expect(decodeDocument(state.bytes ?? '').neumes[0]).toMatchObject({
      liquescence: 'diminutive',
    });
  });
});

describe("owner's Dominican Salve Regina WIP (GregoBase #4577)", () => {
  const parsed = JSON.parse(wip);

  it('decodes the committed v9 fixture with no semantic change', () => {
    expect(parsed.version).toBe(9);
    const document = decodeDocument(wip);
    expect(document).toEqual(parsed.document);
    expect(document.neumes).toHaveLength(35);
    expect(document.neumes.flatMap((n) => n.notes)).toHaveLength(62);
    expect(document.syllables).toHaveLength(24);
    expect(document.divisions).toHaveLength(6);
    expect(document.clef).toEqual({ type: 'c', staffLine: 4 });
  });

  it('hydrates the v9 cache without writing, then continues at Ad te and saves v10', () => {
    const { storage, state } = adapter(wip);
    const loaded = storage.load(blankDocument());
    expect(state.writes).toBe(0);
    expect(state.bytes).toBe(wip);
    // Ad(d/fg~) te(h ;3): punctum d, epiphonus f–g (same syllable), punctum h.
    // After the fixture's final maior division ("salve." :) at the score end.
    const add = (document: ChantDocument, neume: Neume) => {
      const result = insertNeume(document, neume, {
        beforeNeumeId: null,
        beforeDivisionId: null,
      });
      expect(result).not.toBe(document);
      return result;
    };
    let next = add(loaded, {
      id: 'ad-1',
      kind: 'punctum',
      notes: [{ id: 'ad-1a', staffPosition: p(0) }],
    });
    next = add(next, {
      id: 'ad-2',
      kind: 'podatus',
      liquescence: 'diminutive',
      notes: [
        { id: 'ad-2a', staffPosition: p(2) },
        { id: 'ad-2b', staffPosition: p(3) },
      ],
    });
    next = add(next, {
      id: 'te',
      kind: 'punctum',
      notes: [{ id: 'te-a', staffPosition: p(4) }],
    });
    next = {
      ...next,
      syllables: [
        ...next.syllables,
        {
          id: 's-ad',
          text: 'Ad',
          startsAtNeumeId: 'ad-1',
          boundaryBefore: 'word',
        },
        {
          id: 's-te',
          text: 'te',
          startsAtNeumeId: 'te',
          boundaryBefore: 'word',
        },
      ],
    };
    // The epiphonus belongs to Ad: no syllable starts at it.
    expect(next.syllables.some((s) => s.startsAtNeumeId === 'ad-2')).toBe(
      false,
    );
    storage.save(next);
    expect(state.writes).toBe(1);
    const saved = JSON.parse(state.bytes ?? '');
    expect(saved.version).toBe(10);
    expect(saved.document.neumes.slice(0, 35)).toEqual(parsed.document.neumes);
    expect(saved.document.neumes.slice(35)).toEqual([
      {
        id: 'ad-1',
        kind: 'punctum',
        notes: [{ id: 'ad-1a', staffPosition: 0 }],
      },
      {
        id: 'ad-2',
        kind: 'podatus',
        notes: [
          { id: 'ad-2a', staffPosition: 2 },
          { id: 'ad-2b', staffPosition: 3 },
        ],
        liquescence: 'diminutive',
      },
      { id: 'te', kind: 'punctum', notes: [{ id: 'te-a', staffPosition: 4 }] },
    ]);
    expect(decodeDocument(state.bytes ?? '')).toEqual(next);
  });
});

describe('Salve Regina liquescent acceptance fixture (research record §2)', () => {
  it('is canonical v10 and holds the exact six inventory figures', () => {
    const document = decodeDocument(acceptance);
    expect(encodeDocument(document)).toBe(acceptance.replace(/\n$/, ''));
    const figures = document.neumes.flatMap((n) => {
      const figure = liquescentFigure(n);
      return figure
        ? [[n.id, figure, n.notes.map((x) => x.staffPosition)] as const]
        : [];
    });
    // Ad(d/fg~) ×2, E(fg>), er(gh~), cór(…hg~), dul(gf~) under C4, d = 0.
    expect(figures).toEqual([
      ['ad1e', 'epiphonus', [2, 3]],
      ['ad2e', 'epiphonus', [2, 3]],
      ['eia', 'augmentative-pes', [2, 3]],
      ['er', 'epiphonus', [3, 4]],
      ['cor', 'cephalicus', [4, 3]],
      ['dul', 'cephalicus', [3, 2]],
    ]);
    // Each Ad epiphonus continues its syllable; no syllable starts on it.
    for (const id of ['ad1e', 'ad2e'])
      expect(document.syllables.some((s) => s.startsAtNeumeId === id)).toBe(
        false,
      );
  });
});

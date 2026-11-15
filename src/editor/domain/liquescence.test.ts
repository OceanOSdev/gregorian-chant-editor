import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type ClivisNeume,
  type Neume,
  type PodatusNeume,
} from './chant-document';
import {
  allowedLiquescences,
  hasValidLiquescence,
  isLiquescenceFor,
  liquescenceRejection,
  liquescentFigure,
  liquescentNoteRestriction,
} from './liquescence';
import { getMoraScope, moraChoices } from './mora';
import {
  allowsNotePatch,
  isValidNeume,
  mapNeumeNotes,
  neumeAppearanceName,
  normalizeNeumeAfterNoteDeletion,
} from './neume';
import { resolveEffectivePitches } from './accidentals';
import { updateNeumeLiquescence } from '../commands/update-neume-liquescence';
import {
  updateMoraScope,
  updateNoteModifiers,
} from '../commands/update-note-modifiers';
import { updateNoteForm } from '../commands/update-note-form';
import { deleteNoteResult } from '../commands/delete-note';
import { deleteNeumeResult } from '../commands/delete-neume';
import { moveNoteVerticallyResult } from '../commands/move-note';
import { moveNeumeVerticallyResult } from '../commands/move-neume';
import { updateAccidental } from '../commands/update-accidental';
import { preserveClefMelodyResult } from '../commands/edit-clef-change';
import {
  copyMusicalPassage,
  pasteIdCount,
  pasteMusicalPassage,
} from '../commands/musical-passage-clipboard';
import { insertEditorNeume } from '../interaction/insert-editor-neume';
import { createNeumeEntryPitches } from '../neume-entry-pitches';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import { undoDocumentEdit } from '../state/document-history';
import {
  clivisFamily,
  neumeFamilyMembers,
  podatusFamily,
} from '../state/editor-tool';
import { paletteTools } from '../interaction/palette-navigation';
import { entryName } from '../state/editor-session';

const p = staffPosition;
const n = (id: string, position: number, extra = {}): ChantNote => ({
  id,
  staffPosition: p(position),
  ...extra,
});
const podatus = (
  liquescence?: PodatusNeume['liquescence'],
  notes: [ChantNote, ChantNote] = [n('lo', 2), n('hi', 3)],
): PodatusNeume => ({
  id: 'pes',
  kind: 'podatus',
  notes,
  ...(liquescence ? { liquescence } : {}),
});
const clivis = (
  liquescence?: ClivisNeume['liquescence'],
  notes: [ChantNote, ChantNote] = [n('hi', 4), n('lo', 3)],
): ClivisNeume => ({
  id: 'cl',
  kind: 'clivis',
  notes,
  ...(liquescence ? { liquescence } : {}),
});
const doc = (
  neumes: Neume[],
  more: Partial<ChantDocument> = {},
): ChantDocument => ({
  title: 'Liquescence',
  lyricLanguage: 'la',
  clef: { type: 'c', staffLine: 3 },
  accidentals: [],
  divisions: [],
  clefChanges: [],
  syllables: [],
  neumes,
  ...more,
});
const variants = [
  ['epiphonus', () => podatus('diminutive')],
  ['augmentative pes (Dominican)', () => podatus('augmentative-descending')],
  ['cephalicus', () => clivis('diminutive')],
] as const;
const raw = (value: object) => value as unknown as Neume;

describe('accepted ADR 0027 validity matrix', () => {
  it('pairs exact values with Podatus and Clivis only', () => {
    expect(allowedLiquescences('podatus')).toEqual([
      'diminutive',
      'augmentative-descending',
    ]);
    expect(allowedLiquescences('clivis')).toEqual(['diminutive']);
    for (const kind of [
      'punctum',
      'scandicus',
      'torculus',
      'climacus',
      'porrectus',
      'bistropha',
      'tristropha',
      'pes-subpunctis',
      'torculus-resupinus',
    ] as const)
      expect(allowedLiquescences(kind)).toEqual([]);
    expect(isLiquescenceFor('clivis', 'augmentative-descending')).toBe(false);
    for (const value of [undefined, null, 'none', 'auctus', 1, ''])
      expect(isLiquescenceFor('podatus', value)).toBe(false);
  });

  it.each(variants)('%s is valid in every strict contour', (_name, make) => {
    const neume = make();
    expect(isValidNeume(neume)).toBe(true);
    for (const distance of [1, 2, 3, 4, 5, 9]) {
      const [a, b] = neume.notes;
      const dir = neume.kind === 'podatus' ? 1 : -1;
      const wide = mapNeumeNotes(neume, (note, i) =>
        i === 1
          ? { ...b, staffPosition: p(a.staffPosition + dir * distance) }
          : note,
      );
      expect(wide && isValidNeume(wide)).toBe(true);
    }
    const unison = mapNeumeNotes(neume, (note, i) =>
      i === 1 ? { ...note, staffPosition: neume.notes[0].staffPosition } : note,
    );
    expect(unison && isValidNeume(unison)).toBe(false);
  });

  it('rejects unsupported keys, values and kinds at runtime', () => {
    for (const value of [undefined, null, 'none', 'ascending', 'augmentative'])
      expect(isValidNeume(raw({ ...podatus(), liquescence: value }))).toBe(
        false,
      );
    expect(
      isValidNeume(
        raw({ ...clivis(), liquescence: 'augmentative-descending' }),
      ),
    ).toBe(false);
    expect(
      isValidNeume(
        raw({
          id: 'x',
          kind: 'punctum',
          notes: [n('a', 2)],
          liquescence: 'diminutive',
        }),
      ),
    ).toBe(false);
    expect(
      isValidNeume(
        raw({
          id: 'x',
          kind: 'torculus',
          notes: [n('a', 2), n('b', 4), n('c', 3)],
          liquescence: 'diminutive',
        }),
      ),
    ).toBe(false);
  });

  it.each(variants)(
    '%s: first note keeps marks; second note takes none; no quilisma (D7/D8)',
    (_name, make) => {
      const neume = make();
      const [first, second] = neume.notes;
      const with0 = (extra: object) =>
        raw({ ...neume, notes: [{ ...first, ...extra }, second] });
      const with1 = (extra: object) =>
        raw({ ...neume, notes: [first, { ...second, ...extra }] });
      for (const mark of [
        { mora: 1 },
        { episema: true },
        { verticalEpisema: true },
      ]) {
        expect(isValidNeume(with0(mark))).toBe(true);
        expect(isValidNeume(with1(mark))).toBe(false);
      }
      expect(
        isValidNeume(with0({ mora: 1, episema: true, verticalEpisema: true })),
      ).toBe(true);
      expect(isValidNeume(with0({ form: 'quilisma' }))).toBe(false);
      expect(
        moraChoices(neume.kind, 2, neume.liquescence).map((c) => c.value),
      ).toEqual(['none', 'first']);
      expect(getMoraScope(with0({ mora: 1 }))).toBe('first');
      expect(allowsNotePatch(neume, 1, { episema: true })).toBe(false);
      expect(allowsNotePatch(neume, 0, { episema: true })).toBe(true);
      expect(hasValidLiquescence(neume)).toBe(true);
    },
  );

  it('derives display names and keeps ordinary names unchanged', () => {
    expect(variants.map(([, make]) => neumeAppearanceName(make()))).toEqual([
      'epiphonus',
      'augmentative pes (Dominican)',
      'cephalicus',
    ]);
    expect(neumeAppearanceName(podatus())).toBe('podatus');
    expect(liquescentFigure(clivis())).toBeNull();
  });
});

describe('appearance transitions', () => {
  const withMarks = doc([
    podatus(undefined, [n('lo', 2, { mora: 1, episema: true }), n('hi', 3)]),
  ]);

  it('changes only the neume field, preserving IDs, pitches, marks and identity', () => {
    const order: (PodatusNeume['liquescence'] | undefined)[] = [
      'diminutive',
      'augmentative-descending',
      'diminutive',
      undefined,
    ];
    let current = withMarks;
    for (const value of order) {
      const next = updateNeumeLiquescence(current, 'pes', value);
      expect(next).not.toBe(current);
      const neume = next.neumes[0];
      expect(neume.kind).toBe('podatus');
      expect(neume.notes).toEqual(withMarks.neumes[0].notes);
      expect(neume.id).toBe('pes');
      expect('liquescence' in neume).toBe(value !== undefined);
      if (value) expect(neume).toMatchObject({ liquescence: value });
      current = next;
    }
    expect(current).toEqual(withMarks);
  });

  it('is a no-op (same object) when unchanged, unknown or invalid', () => {
    const plain = doc([podatus(), clivis()]);
    expect(updateNeumeLiquescence(plain, 'pes', undefined)).toBe(plain);
    expect(updateNeumeLiquescence(plain, 'missing', 'diminutive')).toBe(plain);
    expect(updateNeumeLiquescence(plain, 'cl', 'augmentative-descending')).toBe(
      plain,
    );
    const on = updateNeumeLiquescence(plain, 'cl', 'diminutive');
    expect(updateNeumeLiquescence(on, 'cl', 'diminutive')).toBe(on);
    const quilisma = doc([
      podatus(undefined, [n('lo', 2, { form: 'quilisma' }), n('hi', 3)]),
    ]);
    expect(updateNeumeLiquescence(quilisma, 'pes', 'diminutive')).toBe(
      quilisma,
    );
    expect(liquescenceRejection(quilisma.neumes[0], 'diminutive')).toMatch(
      /quilismatic pes cannot also be an epiphonus.*Form to default/,
    );
    for (const mark of [
      { mora: 1 },
      { episema: true },
      { verticalEpisema: true },
    ]) {
      const marked = doc([
        podatus(undefined, [n('lo', 2), n('hi', 3, mark)]),
        clivis(undefined, [n('h', 4), n('l', 3, mark)]),
      ]);
      expect(
        updateNeumeLiquescence(marked, 'pes', 'augmentative-descending'),
      ).toBe(marked);
      expect(updateNeumeLiquescence(marked, 'cl', 'diminutive')).toBe(marked);
      expect(liquescenceRejection(marked.neumes[1], 'diminutive')).toMatch(
        /second note of a cephalicus.*Remove marks from the second note first/,
      );
    }
  });

  it('rejects later second-note marks, mora scopes and forms atomically', () => {
    for (const [, make] of variants) {
      const neume = make();
      const d = doc([neume]);
      const [first, second] = neume.notes;
      for (const kind of ['episema', 'verticalEpisema'] as const)
        expect(updateNoteModifiers(d, second.id, { kind, value: true })).toBe(
          d,
        );
      expect(
        updateNoteModifiers(d, second.id, { kind: 'mora', value: 1 }),
      ).toBe(d);
      for (const scope of ['second', 'both'] as const)
        expect(updateMoraScope(d, d.neumes[0].id, scope)).toBe(d);
      expect(
        updateMoraScope(d, d.neumes[0].id, 'first').neumes[0].notes[0].mora,
      ).toBe(1);
      expect(
        updateNoteModifiers(d, first.id, {
          kind: 'verticalEpisema',
          value: true,
        }).neumes[0].notes[0].verticalEpisema,
      ).toBe(true);
      expect(updateNoteForm(d, first.id, 'quilisma')).toBe(d);
      expect(liquescentNoteRestriction(d.neumes[0], 1)).toMatch(
        /cannot carry a mora or episema/,
      );
    }
  });
});

describe('deletion, moves and clef translation', () => {
  it.each(variants)(
    '%s: deleting either constituent leaves an ordinary Punctum (D5)',
    (_name, make) => {
      const marked = mapNeumeNotes(make(), (note, i) =>
        i === 0 ? { ...note, mora: 1, episema: true } : note,
      ) as Neume;
      for (const [index, survivorIndex] of [
        [0, 1],
        [1, 0],
      ]) {
        const deleted = marked.notes[index].id;
        const survivor = marked.notes[survivorIndex];
        const d = doc([marked], {
          syllables: [
            {
              id: 's',
              text: 'Ad',
              startsAtNeumeId: marked.id,
              boundaryBefore: 'word',
            },
          ],
        });
        const result = deleteNoteResult(d, deleted).document;
        expect(result.neumes).toEqual([
          { id: marked.id, kind: 'punctum', notes: [survivor] },
        ]);
        expect(result.syllables).toEqual(d.syllables);
        expect(
          normalizeNeumeAfterNoteDeletion(marked, deleted),
        ).not.toHaveProperty('liquescence');
      }
      expect(
        deleteNeumeResult(doc([make()]), make().id).document.neumes,
      ).toEqual([]);
    },
  );

  it('applies ordinary accidental reconciliation to D5 deletion (no sign transfer)', () => {
    // C3: position 3 is B. The flat belongs to the epiphonus's lower B.
    const base = updateAccidental(
      doc([podatus('diminutive', [n('lo', 3), n('hi', 4)])]),
      'lo',
      'flat',
      'flat-1',
    );
    expect(base.accidentals).toEqual([
      { id: 'flat-1', kind: 'flat', ownerNoteId: 'lo' },
    ]);
    const keepOwner = deleteNoteResult(base, 'hi').document;
    expect(keepOwner.neumes).toEqual([
      { id: 'pes', kind: 'punctum', notes: [n('lo', 3)] },
    ]);
    expect(keepOwner.accidentals).toEqual(base.accidentals);
    const dropOwner = deleteNoteResult(base, 'lo').document;
    expect(dropOwner.neumes).toEqual([
      { id: 'pes', kind: 'punctum', notes: [n('hi', 4)] },
    ]);
    expect(dropOwner.accidentals).toEqual([]);
  });

  it('keeps liquescence through note and neume moves; rejects inversion', () => {
    for (const [, make] of variants) {
      const neume = make();
      const d = doc([neume]);
      const away = neume.kind === 'podatus' ? 1 : -1;
      const toward = neume.kind === 'podatus' ? -1 : 1;
      const wider = moveNoteVerticallyResult(
        d,
        neume.notes[1].id,
        away,
      ).document;
      expect(wider.neumes[0]).toMatchObject({ liquescence: neume.liquescence });
      expect(wider.neumes[0].notes.map((x) => x.id)).toEqual(
        neume.notes.map((x) => x.id),
      );
      expect(
        moveNoteVerticallyResult(d, neume.notes[1].id, toward).document,
      ).toBe(d);
      const moved = moveNeumeVerticallyResult(d, neume.id, 2).document;
      expect(moved.neumes[0]).toEqual({
        ...neume,
        notes: neume.notes.map((x) => ({
          ...x,
          staffPosition: p(x.staffPosition + 2),
        })),
      });
    }
  });

  it('keeps liquescence and written B signs through melody-preserving clef edits', () => {
    // C3: position 3 is B. A flat on the epiphonus's lower B.
    const base = doc([podatus('diminutive', [n('lo', 3), n('hi', 4)])]);
    const signed = updateAccidental(base, 'lo', 'flat', 'flat-1');
    expect(signed.accidentals).toHaveLength(1);
    const candidate = {
      ...signed,
      clef: { type: 'c' as const, staffLine: 4 as const },
    };
    const { document } = preserveClefMelodyResult(signed, candidate);
    expect(document?.neumes[0]).toMatchObject({
      id: 'pes',
      liquescence: 'diminutive',
      notes: [
        { id: 'lo', staffPosition: 5 },
        { id: 'hi', staffPosition: 6 },
      ],
    });
    expect(document?.accidentals).toEqual(signed.accidentals);
    const pitch = (d: ChantDocument) => {
      const value = resolveEffectivePitches(d)?.get('lo');
      return value && { degree: value.degree, alteration: value.alteration };
    };
    expect(pitch(document as ChantDocument)).toEqual(pitch(signed));
    expect(pitch(signed)).toEqual({ degree: -1, alteration: -1 });
  });
});

describe('musical clipboard', () => {
  it('copies every appearance between documents and clefs with fresh IDs and equal effective pitches', () => {
    const source = doc([
      podatus('diminutive', [n('a1', 2), n('a2', 3)]),
      {
        ...podatus('augmentative-descending', [n('b1', 2), n('b2', 3)]),
        id: 'aug',
      },
      clivis('diminutive', [n('c1', 4), n('c2', 3)]),
    ]);
    const copied = copyMusicalPassage(source, {
      kind: 'neume-range',
      anchorNeumeId: 'pes',
      endpointNeumeId: 'cl',
    });
    expect(copied.clipboard).not.toBeNull();
    const target = doc([{ id: 't', kind: 'punctum', notes: [n('t1', 1)] }], {
      clef: { type: 'f', staffLine: 3 },
    });
    let serial = 0;
    const clipboard = copied.clipboard;
    if (!clipboard) throw Error('copy failed');
    const ids = Array.from(
      { length: pasteIdCount(clipboard) },
      () => `f${++serial}`,
    );
    const pasted = pasteMusicalPassage(
      target,
      { kind: 'neume', neumeId: 't' },
      clipboard,
      ids,
    ).document;
    if (!pasted) throw Error('paste failed');
    const added = pasted.neumes.slice(1);
    expect(added.map((x) => [x.kind, liquescentFigure(x)])).toEqual([
      ['podatus', 'epiphonus'],
      ['podatus', 'augmentative-pes'],
      ['clivis', 'cephalicus'],
    ]);
    const used = added.flatMap((x) => [x.id, ...x.notes.map((y) => y.id)]);
    expect(new Set(used).size).toBe(used.length);
    expect(used.every((id) => id.startsWith('f'))).toBe(true);
    const before = resolveEffectivePitches(source);
    const after = resolveEffectivePitches(pasted);
    const effective = (
      value: { degree: number; alteration: number } | undefined,
    ) => value && { degree: value.degree, alteration: value.alteration };
    source.neumes.forEach((neume, i) =>
      neume.notes.forEach((note, j) =>
        expect(effective(after?.get(added[i].notes[j].id))).toEqual(
          effective(before?.get(note.id)),
        ),
      ),
    );
  });
});

describe('direct entry and session behaviour', () => {
  it.each([
    ['epiphonus', 'podatus', 'diminutive'],
    ['augmentative-pes', 'podatus', 'augmentative-descending'],
    ['cephalicus', 'clivis', 'diminutive'],
  ] as const)('%s inserts one %s with %s', (entry, kind, liquescence) => {
    const pitches = createNeumeEntryPitches(entry, p(2));
    const inserted = insertEditorNeume(
      doc([]),
      {
        kind: entry,
        staffPositions: pitches.staffPositions,
        insertionIndex: 0,
        boundary: { beforeNeumeId: null, beforeDivisionId: null },
      } as Parameters<typeof insertEditorNeume>[1],
      { neumeId: 'new', noteIds: ['x', 'y', 'z'] },
    );
    expect(inserted.neumes).toEqual([
      {
        id: 'new',
        kind,
        liquescence,
        notes: [
          { id: 'x', staffPosition: pitches.staffPositions[0] },
          { id: 'y', staffPosition: pitches.staffPositions[1] },
        ],
      },
    ]);
  });

  it('extends the Podatus family and adds a Clivis family, keeping existing options', () => {
    expect(podatusFamily).toEqual([
      'podatus',
      'pes-subbipunctis',
      'pes-subtripunctis',
      'epiphonus',
      'augmentative-pes',
    ]);
    expect(clivisFamily).toEqual(['clivis', 'cephalicus']);
    expect(neumeFamilyMembers.clivis).toBe(clivisFamily);
    expect(paletteTools.indexOf('clivis-menu')).toBe(
      paletteTools.indexOf('clivis') + 1,
    );
    expect(
      ['epiphonus', 'augmentative-pes', 'cephalicus'].map((k) =>
        entryName(k as 'epiphonus'),
      ),
    ).toEqual(['Epiphonus', 'Augmentative pes (Dominican)', 'Cephalicus']);
  });

  it.each([
    ['epiphonus', 'diminutive', [2, 3]],
    ['augmentative-pes', 'augmentative-descending', [2, 3]],
    ['cephalicus', 'diminutive', [2, 1]],
  ] as const)(
    'arms %s for one-click graphical placement and remembered I insertion',
    (entry, liquescence, positions) => {
      let state = reduceEditorSession(createEditorSession(doc([])), {
        type: 'arm',
        tool: { kind: `place-${entry}` },
      });
      expect(state.announcement.text).toBe(`Placing ${entryName(entry)}.`);
      state = reduceEditorSession(state, {
        type: 'place',
        kind: entry,
        point: { x: 300, y: 100 },
        ids: { neumeId: 'g', noteIds: ['g1', 'g2', 'g3'] },
      });
      expect(state.history.present.neumes[0]).toMatchObject({
        id: 'g',
        liquescence,
        notes: positions.map((s, i) => ({ id: `g${i + 1}`, staffPosition: s })),
      });
      expect(state.rememberedKind).toBe(entry);
      expect(state.history.past).toHaveLength(1);
      state = reduceEditorSession(state, { type: 'select-tool' });
      state = reduceEditorSession(state, {
        type: 'insert',
        ids: { neumeId: 'i', noteIds: ['i1', 'i2', 'i3'] },
      });
      expect(state.history.present.neumes.at(-1)).toMatchObject({
        id: 'i',
        liquescence,
      });
    },
  );

  it('explains rejected appearance edits without history, and records valid ones once', () => {
    const marked = doc([
      podatus(undefined, [n('lo', 2), n('hi', 3, { episema: true })]),
    ]);
    const state = createEditorSession(marked);
    const rejection =
      liquescenceRejection(marked.neumes[0], 'diminutive') ?? '';
    const rejected = reduceEditorSession(state, {
      type: 'engraving-edit',
      edit: (d) => updateNeumeLiquescence(d, 'pes', 'diminutive'),
      rejection,
    });
    expect(rejected.history).toBe(state.history);
    expect(rejected.noteFormError).toBe(rejection);
    // One announcement: the visible role="alert" reason, not the live region.
    expect(rejected.announcement).toEqual(state.announcement);
    expect(rejected.noteFormErrorSequence).toBe(1);
    const plain = createEditorSession(doc([podatus()]));
    const changed = reduceEditorSession(plain, {
      type: 'engraving-edit',
      edit: (d) => updateNeumeLiquescence(d, 'pes', 'augmentative-descending'),
      announcement: 'Appearance changed to augmentative pes (Dominican).',
    });
    expect(changed.history.past).toHaveLength(1);
    expect(changed.history.present.neumes[0]).toMatchObject({
      liquescence: 'augmentative-descending',
    });
    expect(changed.announcement.text).toMatch(/augmentative pes/);
    const repeated = reduceEditorSession(changed, {
      type: 'engraving-edit',
      edit: (d) => updateNeumeLiquescence(d, 'pes', 'augmentative-descending'),
    });
    expect(repeated.history).toBe(changed.history);
    expect(undoDocumentEdit(changed.history).present).toEqual(
      plain.history.present,
    );
  });

  it('rejects from whole-neume selection once, keeping document, history and appearance', () => {
    const marked = doc([
      podatus(undefined, [n('lo', 2), n('hi', 3, { episema: true })]),
    ]);
    let state = reduceEditorSession(createEditorSession(marked), {
      type: 'select',
      selection: { kind: 'neume', neumeId: 'pes' },
    });
    const before = state;
    const rejection = liquescenceRejection(marked.neumes[0], 'diminutive');
    expect(rejection).toMatch(/Remove marks from the second note first/);
    const attempt = () =>
      reduceEditorSession(state, {
        type: 'engraving-edit',
        edit: (d) => updateNeumeLiquescence(d, 'pes', 'diminutive'),
        rejection: rejection ?? undefined,
      });
    state = attempt();
    expect(state.history).toBe(before.history);
    expect(state.history.present).toBe(marked);
    expect(state.history.present.neumes[0]).not.toHaveProperty('liquescence');
    expect(state.selection).toEqual({ kind: 'neume', neumeId: 'pes' });
    expect(state.noteFormError).toBe(rejection);
    expect(state.announcement).toEqual(before.announcement);
    // A repeated identical rejection gets a fresh alert key to be re-announced.
    const sequence = state.noteFormErrorSequence;
    state = attempt();
    expect(state.noteFormErrorSequence).toBe(sequence + 1);
    expect(state.history).toBe(before.history);
  });

  it('announces D5 deletion normalization in one undoable edit', () => {
    const state = createEditorSession(doc([podatus('diminutive')]));
    const deleted = reduceEditorSession(state, {
      type: 'edit',
      formDeletionNoteId: 'hi',
      edit: (d) => deleteNoteResult(d, 'hi'),
    });
    expect(deleted.history.present.neumes).toEqual([
      { id: 'pes', kind: 'punctum', notes: [n('lo', 2)] },
    ]);
    expect(deleted.announcement.text).toBe(
      'Note deleted from the epiphonus. The remaining note is now an ordinary punctum. Undo restores the epiphonus.',
    );
    expect(deleted.history.past).toHaveLength(1);
    expect(undoDocumentEdit(deleted.history).present).toEqual(
      state.history.present,
    );
  });
});

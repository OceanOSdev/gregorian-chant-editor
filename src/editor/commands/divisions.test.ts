import { createLyricSyllable } from './create-lyric-syllable';
import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ChantDivision,
  type PunctumNeume,
} from '../domain/chant-document';
import { deriveScoreOrder, hasValidDivisions } from '../domain/divisions';
import { insertPunctum } from './insert-punctum';
import {
  insertDivision,
  updateDivisionKind,
  deleteDivision,
} from './edit-division';
import { deleteNeume } from './delete-neume';
import { deleteNote } from './delete-note';
import { moveNoteVertically } from './move-note';
import {
  applyDocumentEdit,
  createDocumentHistory,
  undoDocumentEdit,
  redoDocumentEdit,
} from '../state/document-history';

const note = (id: string): PunctumNeume => ({
  id,
  kind: 'punctum',
  notes: [{ id: `${id}-note`, staffPosition: staffPosition(0) }],
});
const division = (id: string, beforeNeumeId: string | null): ChantDivision => ({
  id,
  kind: 'minima',
  beforeNeumeId,
});
const boundary = (
  beforeNeumeId: string | null,
  beforeDivisionId: string | null = null,
) => ({ beforeNeumeId, beforeDivisionId });
function fixture(): ChantDocument {
  return {
    title: '',
    clef: { type: 'c', staffLine: 4 },
    lyricLanguage: 'la',
    neumes: [note('A'), note('B')],
    clefChanges: [],
    divisions: [division('D', 'B')],
    syllables: [
      { id: 'lyric', text: 'la', startsAtNeumeId: 'B', boundaryBefore: 'word' },
    ],
  };
}
const order = (d: ChantDocument) =>
  deriveScoreOrder(d)?.map((item) => item.entity.id);

describe('explicit ordered score boundaries', () => {
  it.each(['minima', 'minor', 'maior', 'finalis'] as const)(
    'supports %s independently of pitch',
    (kind) => {
      const d = fixture();
      const result = insertDivision(
        d,
        { ...division('E', 'A'), kind },
        boundary('A'),
      );
      expect(order(result)).toEqual(['E', 'A', 'D', 'B']);
      expect(result.neumes).toBe(d.neumes);
    },
  );

  it('restores reanchored punctuation and lyrics through insertion/deletion history', () => {
    const d = fixture();
    const inserted = applyDocumentEdit(createDocumentHistory(d), (doc) =>
      insertPunctum(doc, note('X'), boundary('B')),
    );
    expect(order(inserted.present)).toEqual(['A', 'D', 'X', 'B']);
    expect(undoDocumentEdit(inserted).present).toBe(d);
    expect(redoDocumentEdit(undoDocumentEdit(inserted)).present).toBe(
      inserted.present,
    );
    const removed = applyDocumentEdit(inserted, (doc) => deleteNeume(doc, 'B'));
    expect(removed.present.syllables).toEqual([]);
    expect(undoDocumentEdit(removed).present).toBe(inserted.present);
    expect(redoDocumentEdit(undoDocumentEdit(removed)).present).toBe(
      removed.present,
    );
  });

  it.each([
    ['D', ['A', 'X', 'D', 'B']],
    [null, ['A', 'D', 'X', 'B']],
  ])('inserts at slot %s without moving lyrics', (slot, expected) => {
    const d = fixture();
    const result = insertPunctum(d, note('X'), boundary('B', slot));
    expect(order(result)).toEqual(expected);
    expect(result.syllables).toBe(d.syllables);
    expect(result.neumes[0]).toBe(d.neumes[0]);
    expect(order(d)).toEqual(['A', 'D', 'B']);
  });

  it('distinguishes every slot among adjacent divisions', () => {
    const d = fixture();
    d.divisions.push(division('E', 'B'));
    expect(order(insertPunctum(d, note('X'), boundary('B', 'E')))).toEqual([
      'A',
      'D',
      'X',
      'E',
      'B',
    ]);
    expect(
      order(insertDivision(d, division('F', 'B'), boundary('B', 'E'))),
    ).toEqual(['A', 'D', 'F', 'E', 'B']);
    expect(insertPunctum(d, note('X'), 1)).toBe(d);
  });

  it('supports leading, trailing, empty and post-finalis insertion', () => {
    const d = fixture();
    d.neumes = [];
    d.syllables = [];
    d.divisions = [];
    const finalis = { ...division('F', null), kind: 'finalis' as const };
    const emptyWithDivision = insertDivision(d, finalis, boundary(null));
    expect(
      order(insertPunctum(emptyWithDivision, note('X'), boundary(null, 'F'))),
    ).toEqual(['X', 'F']);
    const after = insertPunctum(emptyWithDivision, note('X'), boundary(null));
    expect(order(after)).toEqual(['F', 'X']);
    expect(order(insertPunctum(after, note('Y'), boundary(null)))).toEqual([
      'F',
      'X',
      'Y',
    ]);
    expect(order(insertPunctum(d, note('X'), 0))).toEqual(['X']);
  });

  it('merges converging divisions in score order, regardless of storage order', () => {
    const d = fixture();
    d.divisions = [
      division('end', null),
      division('D', 'B'),
      division('start', 'A'),
    ];
    const removedA = deleteNeume(d, 'A');
    expect(order(removedA)).toEqual(['start', 'D', 'B', 'end']);
    expect(removedA.syllables).toBe(d.syllables);
    const removedB = deleteNote(removedA, 'B-note');
    expect(order(removedB)).toEqual(['start', 'D', 'end']);
    expect(removedB.syllables).toEqual([]);
    expect(hasValidDivisions(removedB)).toBe(true);
  });

  it('preserves divisions through pitch movement and normalization with stable neume ID', () => {
    const d = fixture();
    d.neumes[1] = {
      id: 'B',
      kind: 'podatus',
      notes: [
        { id: 'lower', staffPosition: staffPosition(0) },
        { id: 'upper', staffPosition: staffPosition(2) },
      ],
    };
    const normalized = deleteNote(d, 'upper');
    expect(normalized.divisions).toBe(d.divisions);
    expect(normalized.syllables).toBe(d.syllables);
    expect(order(normalized)).toEqual(['A', 'D', 'B']);
    expect(moveNoteVertically(normalized, 'lower', 1).divisions).toBe(
      d.divisions,
    );
  });

  it('changes kind and removes only the division, with atomic exact history restoration', () => {
    const d = fixture();
    const h = createDocumentHistory(d);
    const inserted = applyDocumentEdit(h, (doc) =>
      insertDivision(doc, division('E', null), boundary(null)),
    );
    const changed = applyDocumentEdit(inserted, (doc) =>
      updateDivisionKind(doc, 'D', 'finalis'),
    );
    expect(changed.present.divisions[0]?.id).toBe('D');
    expect(order(changed.present)).toEqual(['A', 'D', 'B', 'E']);
    const removed = applyDocumentEdit(changed, (doc) =>
      deleteDivision(doc, 'D'),
    );
    expect(order(removed.present)).toEqual(['A', 'B', 'E']);
    expect(removed.present.neumes).toBe(d.neumes);
    expect(removed.present.syllables).toBe(d.syllables);
    expect(undoDocumentEdit(removed).present).toBe(changed.present);
    expect(redoDocumentEdit(undoDocumentEdit(removed)).present).toBe(
      removed.present,
    );
    expect(undoDocumentEdit(inserted).present).toBe(d);
    expect(
      applyDocumentEdit(h, (doc) => updateDivisionKind(doc, 'D', 'minima')),
    ).toBe(h);
  });

  it('rejects malformed runtime data and invalid or stale intents exactly', () => {
    const d = fixture();
    for (const candidate of [
      division('', 'B'),
      division('D', 'B'),
      division('A', 'B'),
      division('A-note', 'B'),
      division('lyric', 'B'),
      division('E', 'missing'),
      { ...division('E', 'B'), kind: 'virgula' },
      { ...division('E', 'B'), notes: [] },
    ]) {
      expect(insertDivision(d, candidate as ChantDivision, boundary('B'))).toBe(
        d,
      );
    }
    for (const intent of [
      boundary('missing'),
      boundary('A', 'D'),
      boundary('B', 'missing'),
    ]) {
      expect(insertPunctum(d, note('X'), intent)).toBe(d);
      expect(insertDivision(d, division('E', 'B'), intent)).toBe(d);
    }
    expect(updateDivisionKind(d, 'D', 'bad' as ChantDivision['kind'])).toBe(d);
    expect(deleteDivision(d, 'missing')).toBe(d);
    expect(
      createLyricSyllable(d, {
        id: 'D',
        text: 'a',
        startsAtNeumeId: 'A',
        boundaryBefore: 'word',
      }),
    ).toBe(d);
    expect(insertPunctum(d, note('D'), boundary(null))).toBe(d);
    for (const divisions of [
      undefined,
      null,
      {},
      [division('D', 'missing')],
      [division('D', 'B'), division('D', null)],
    ]) {
      const invalid = { ...d, divisions } as ChantDocument;
      expect(hasValidDivisions(invalid)).toBe(false);
      expect(deriveScoreOrder(invalid)).toBeNull();
      expect(insertPunctum(invalid, note('X'), 0)).toBe(invalid);
      expect(deleteNeume(invalid, 'A')).toBe(invalid);
    }
  });
});

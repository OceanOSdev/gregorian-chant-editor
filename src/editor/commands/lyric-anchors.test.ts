import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type LyricSyllable,
  type Neume,
} from '../domain/chant-document';
import { findSyllableForNeume, hasValidLyricAnchors } from '../domain/lyrics';
import { createLyricSyllable } from './create-lyric-syllable';
import { deleteLyricSyllable } from './delete-lyric-syllable';
import {
  reassignLyricSyllable,
  updateLyricBoundary,
} from './reassign-lyric-syllable';
import { deleteNeume } from './delete-neume';
import { deleteNote } from './delete-note';
import { insertPunctum } from './insert-punctum';
import { updateLyricSyllableText } from './update-lyric-syllable';
import {
  applyDocumentEdit,
  createDocumentHistory,
  undoDocumentEdit,
  redoDocumentEdit,
} from '../state/document-history';
import { layoutChant } from '../layout/layout-chant';

function syllable(
  id: string,
  startsAtNeumeId: string,
  boundaryBefore: LyricSyllable['boundaryBefore'] = 'word',
): LyricSyllable {
  return { id, text: id, startsAtNeumeId, boundaryBefore };
}
function punctum(id: string): Neume & { kind: 'punctum' } {
  return {
    id,
    kind: 'punctum',
    notes: [{ id: `${id}-note`, staffPosition: staffPosition(2) }],
  };
}
function fixture(): ChantDocument {
  return {
    title: 'Anchors',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: 25 }, (_, i) => punctum(`n${i}`)),
    syllables: [
      syllable('Al', 'n1'),
      syllable('le', 'n4', 'continuation'),
      syllable('lu', 'n20', 'continuation'),
    ],
  };
}

describe('anchored lyrics', () => {
  it('validates anchors and derives ownership across systems and lyricless prefixes', () => {
    const doc = fixture();
    expect(hasValidLyricAnchors(doc)).toBe(true);
    expect(findSyllableForNeume(doc, 'missing')).toBeNull();
    expect(findSyllableForNeume(doc, 'n0')).toBeNull();
    expect(findSyllableForNeume(doc, 'n1')?.id).toBe('Al');
    expect(findSyllableForNeume(doc, 'n19')?.id).toBe('le');
    expect(findSyllableForNeume(doc, 'n24')?.id).toBe('lu');
    const layout = layoutChant(doc);
    expect(
      layout.systems.flatMap((s) => s.lyrics).map((s) => s.syllableId),
    ).toEqual(['Al', 'le', 'lu']);
    expect(layout.systems[2].lyrics[0].syllableId).toBe('lu');
    expect(hasValidLyricAnchors({ ...doc, syllables: [] })).toBe(true);
  });
  it.each([
    [syllable('a', 'missing')],
    [syllable('a', 'n1'), syllable('b', 'n1')],
    [syllable('a', 'n2'), syllable('b', 'n1')],
    [syllable('a', 'n1'), syllable('a', 'n2')],
    [syllable('a', 'n1', 'continuation')],
    [{ ...syllable('a', 'n1'), text: 'two words' }],
    [{ ...syllable('a', 'n1'), text: '' }],
  ])('rejects invalid lyric sequence %#', (...syllables) => {
    expect(hasValidLyricAnchors({ ...fixture(), syllables })).toBe(false);
  });
  it.each([0, 1, 3, 4, 25])(
    'inserts music at boundary %i without touching anchors',
    (index) => {
      const doc = fixture();
      const next = insertPunctum(doc, punctum('new'), index);
      expect(next.syllables).toBe(doc.syllables);
      expect(hasValidLyricAnchors(next)).toBe(true);
      expect(findSyllableForNeume(next, 'new')?.id ?? null).toBe(
        index <= 1 ? null : index <= 4 ? 'Al' : 'lu',
      );
    },
  );
  it('creates in semantic order without overwriting occupied anchors', () => {
    const doc = fixture(),
      newSyllable = syllable('new', 'n3', 'continuation');
    const next = createLyricSyllable(doc, newSyllable);
    expect(next.syllables.map((s) => s.id)).toEqual(['Al', 'new', 'le', 'lu']);
    expect(next.neumes).toBe(doc.neumes);
    expect(next.syllables[0]).toBe(doc.syllables[0]);
    expect(createLyricSyllable(doc, syllable('new', 'n1'))).toBe(doc);
    expect(createLyricSyllable(doc, syllable('Al', 'n3'))).toBe(doc);
    expect(createLyricSyllable(doc, syllable('new', 'missing'))).toBe(doc);
    expect(createLyricSyllable(doc, { ...newSyllable, text: '' })).toBe(doc);
    expect(
      createLyricSyllable(doc, syllable('first', 'n0', 'continuation'))
        .syllables[0].boundaryBefore,
    ).toBe('word');
  });
  it('moves anchors only between neighbors without changing music or identity', () => {
    const doc = fixture(),
      moved = reassignLyricSyllable(doc, 'le', 'n10');
    expect(moved.neumes).toBe(doc.neumes);
    expect(moved.syllables[1]).toEqual({
      ...doc.syllables[1],
      startsAtNeumeId: 'n10',
    });
    for (const id of ['n0', 'n1', 'n20', 'n24', 'missing', 'n4'])
      expect(reassignLyricSyllable(doc, 'le', id)).toBe(doc);
    expect(updateLyricBoundary(doc, 'Al', 'continuation')).toBe(doc);
    expect(
      updateLyricBoundary(doc, 'le', 'word').syllables[1].boundaryBefore,
    ).toBe('word');
    expect(updateLyricSyllableText(doc, 'Al', '')).toBe(doc);
  });
  it('deletes anchors atomically and preserves every other anchor', () => {
    const doc = fixture();
    const history = applyDocumentEdit(createDocumentHistory(doc), (d) =>
      deleteNeume(d, 'n1'),
    );
    expect(history.past).toHaveLength(1);
    expect(history.present.syllables.map((s) => s.startsAtNeumeId)).toEqual([
      'n4',
      'n20',
    ]);
    expect(history.present.syllables[0].boundaryBefore).toBe('word');
    expect(history.present.syllables[1]).toBe(doc.syllables[2]);
    expect(undoDocumentEdit(history).present).toBe(doc);
    expect(redoDocumentEdit(undoDocumentEdit(history)).present).toBe(
      history.present,
    );
    expect(deleteNote(doc, 'n1-note')).toEqual(history.present);
    expect(deleteNeume(doc, 'n2').syllables).toBe(doc.syllables);
  });
  it('preserves word boundaries across deletion without changing music', () => {
    const doc = fixture();
    expect(deleteLyricSyllable(doc, 'le').syllables[1].boundaryBefore).toBe(
      'continuation',
    );
    const withWord = updateLyricBoundary(doc, 'le', 'word');
    const next = deleteLyricSyllable(withWord, 'le');
    expect(next.syllables[1].boundaryBefore).toBe('word');
    expect(next.neumes).toBe(doc.neumes);
    expect(deleteLyricSyllable(doc, 'missing')).toBe(doc);
  });
  it('preserves an anchor through compound normalization and removes it with the final note', () => {
    const doc = fixture();
    doc.neumes[1] = {
      id: 'n1',
      kind: 'podatus',
      notes: [
        { id: 'low', staffPosition: staffPosition(2) },
        { id: 'high', staffPosition: staffPosition(3) },
      ],
    };
    const next = deleteNote(doc, 'low');
    expect(next.syllables).toBe(doc.syllables);
    expect(next.neumes[1].id).toBe('n1');
    expect(deleteNote(next, 'high').syllables.map((s) => s.id)).toEqual([
      'le',
      'lu',
    ]);
  });
  it('rejects invalid Punctum insertion without false history', () => {
    const doc = fixture();
    for (const index of [-1, 26, 0.5, NaN])
      expect(insertPunctum(doc, punctum('new'), index)).toBe(doc);
    expect(insertPunctum(doc, punctum('n1'), 0)).toBe(doc);
    expect(
      insertPunctum(
        doc,
        {
          ...punctum('new'),
          notes:
            doc.neumes[0].kind === 'punctum'
              ? doc.neumes[0].notes
              : [punctum('new').notes[0]],
        },
        0,
      ),
    ).toBe(doc);
  });
});

it('graphical insertion stays on the hovered system despite remote lyric anchors', () => {
  const doc = fixture();
  const layout = layoutChant(doc);
  const system = layout.systems[2];
  const placement = resolveGraphicalNeumePlacement(layout, 'punctum', {
    x: 64,
    y: Math.max(...system.staffLines.map((l) => l.y)) - 24,
  });
  expect(placement?.insertionIndex).toBe(system.startNeumeIndex);
  expect(placement?.preview.caret.systemIndex).toBe(2);
});

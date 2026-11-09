import { describe, expect, it } from 'vitest';
import { fixture, change, punctum } from '../clef-change.test-cases';
import { createLyricSyllable } from './create-lyric-syllable';
import { insertNeume } from './insert-neume';
import { insertDivision } from './edit-division';
import { insertClefChange } from './edit-clef-change';
import {
  deriveScoreOrder,
  resolveScoreBoundary,
  hasValidDivisions,
} from '../domain/divisions';
import {
  resolveEditorToolbarInsertion,
  insertEditorNeume,
} from '../interaction/insert-editor-neume';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import type {
  ChantDocument,
  ScoreInsertionBoundary,
} from '../domain/chant-document';

const insertionIds = { neumeId: 'X', noteIds: ['x1', 'x2', 'x3'] as const };
describe('PR 60 identity and boundary regressions', () => {
  it.each(['C', 'note-A', 'A', 'D', 's'])(
    'rejects a lyric ID colliding with %s across semantic collections',
    (id) => {
      const d = {
        ...fixture(),
        clefChanges: [change('C')],
        divisions: [{ id: 'D', kind: 'minor' as const, beforeNeumeId: 'B' }],
        syllables: [
          {
            id: 's',
            text: 'Al',
            startsAtNeumeId: 'A',
            boundaryBefore: 'word' as const,
          },
        ],
      };
      expect(
        createLyricSyllable(d, {
          id,
          text: 'le',
          startsAtNeumeId: 'B',
          boundaryBefore: 'continuation',
        }),
      ).toBe(d);
      expect(hasValidDivisions(d)).toBe(true);
    },
  );
  it('rejects music, division and clef identities colliding across collections', () => {
    const d = {
      ...fixture(),
      clefChanges: [change('C')],
      divisions: [{ id: 'D', kind: 'minor' as const, beforeNeumeId: 'B' }],
      syllables: [
        {
          id: 's',
          text: 'Al',
          startsAtNeumeId: 'A',
          boundaryBefore: 'word' as const,
        },
      ],
    };
    const boundary = {
      beforeNeumeId: 'B',
      beforeDivisionId: null,
      beforeClefId: null,
    };
    expect(insertNeume(d, punctum('C'), boundary)).toBe(d);
    expect(
      insertNeume(
        d,
        {
          id: 'X',
          kind: 'punctum',
          notes: [{ ...punctum('X').notes[0], id: 'C' }],
        },
        boundary,
      ),
    ).toBe(d);
    expect(
      insertDivision(
        d,
        { id: 'C', kind: 'minor', beforeNeumeId: 'B' },
        boundary,
      ),
    ).toBe(d);
    for (const id of ['note-A', 'A', 'D', 's'])
      expect(insertClefChange(d, change(id), boundary)).toBe(d);
  });
  it('rejects division and clef references from another neume boundary or another division slot', () => {
    const d = {
      ...fixture(),
      divisions: [
        { id: 'D1', kind: 'minor' as const, beforeNeumeId: 'B' },
        { id: 'D2', kind: 'finalis' as const, beforeNeumeId: 'E' },
      ],
      clefChanges: [change('C1', 'B', 'D1'), change('C2', 'B')],
    };
    const invalid: ScoreInsertionBoundary[] = [
      { beforeNeumeId: 'B', beforeDivisionId: 'D2', beforeClefId: null },
      { beforeNeumeId: 'E', beforeDivisionId: 'D2', beforeClefId: 'C1' },
      { beforeNeumeId: 'B', beforeDivisionId: 'D1', beforeClefId: 'C2' },
      { beforeNeumeId: 'B', beforeDivisionId: null, beforeClefId: 'C1' },
    ];
    for (const boundary of invalid) {
      expect(resolveScoreBoundary(d, boundary)).toBeNull();
      expect(insertNeume(d, punctum('X'), boundary)).toBe(d);
    }
  });
  it('uses the actual score end for I without selection, including trailing divisions and clefs', () => {
    const d = {
      ...fixture(),
      divisions: [{ id: 'D', kind: 'minor' as const, beforeNeumeId: null }],
      clefChanges: [change('C', null)],
    };
    const intent = resolveEditorToolbarInsertion(
      d,
      { kind: 'none' },
      'punctum',
    );
    expect(intent?.boundary).toEqual({
      beforeNeumeId: null,
      beforeDivisionId: null,
      beforeClefId: null,
    });
    if (!intent) throw Error('Missing intent');
    expect(
      deriveScoreOrder(insertEditorNeume(d, intent, insertionIds))?.map(
        (i) => i.entity.id,
      ),
    ).toEqual(['A', 'B', 'E', 'D', 'C', 'X']);
    const contextual = resolveEditorToolbarInsertion(
      d,
      { kind: 'neume', neumeId: 'E' },
      'punctum',
    );
    expect(contextual?.boundary.beforeDivisionId).toBe('D');
  });
  it('announces explicit clef-side choices instead of silently swallowing I', () => {
    const d = { ...fixture(), clefChanges: [change('C')] };
    let s = reduceEditorSession(createEditorSession(d), {
      type: 'select',
      selection: { kind: 'clef-change', clefChangeId: 'C' },
    });
    s = reduceEditorSession(s, { type: 'insert', ids: insertionIds });
    expect(s.history.present).toBe(d);
    expect(s.announcement.text).toContain(
      'Insert before clef or Insert after clef',
    );
  });
  it('does not start a clef transaction during persistent placement', () => {
    let s = reduceEditorSession(createEditorSession(fixture()), {
      type: 'arm',
      tool: { kind: 'place-punctum' },
    });
    expect(
      reduceEditorSession(s, {
        type: 'start-clef-change',
        id: 'C',
        boundary: { beforeNeumeId: 'B', beforeDivisionId: null },
      }),
    ).toBe(s);
  });
  it('rejects invalid raw noteheads for the selected policy without history mutation', () => {
    const d: ChantDocument = fixture();
    // A runtime fractional position must not become valid through a clef edit.
    Object.assign(d.neumes[1].notes[0], { staffPosition: 1.5 });
    let s = reduceEditorSession(createEditorSession(d), {
      type: 'start-clef-change',
      id: 'C',
      boundary: { beforeNeumeId: 'B', beforeDivisionId: null },
    });
    s = reduceEditorSession(s, {
      type: 'draft-clef-change',
      clef: { type: 'f', staffLine: 1 },
    });
    s = reduceEditorSession(s, { type: 'apply-clef-change' });
    expect(s.clefTransaction?.candidate).toBeNull();
    expect(s.history.present).toBe(d);
  });
});

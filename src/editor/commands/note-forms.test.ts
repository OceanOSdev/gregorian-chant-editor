import { describe, expect, it } from 'vitest';
import type { ChantDocument, ChantNote, Neume } from '../domain/chant-document';
import { staffPosition } from '../domain/chant-document';
import { allowedNoteForms } from '../domain/note-forms';
import { isValidNeume, normalizeNeumeAfterNoteDeletion } from '../domain/neume';
import {
  blankDocument,
  decodeDocument,
  encodeDocument,
} from '../persistence/native-document';
import { BrowserDocument, autosaveKey } from '../persistence/browser-document';
import v1Source from '../../../docs/verification/note-modifiers/baseline-v1.chant.json?raw';
import v2Source from '../../../docs/verification/note-modifiers/conventional/editor-cases.chant.json?raw';
import { updateNoteForm } from './update-note-form';
import { updateMoraScope, updateNoteModifiers } from './update-note-modifiers';
import { deleteNote } from './delete-note';
import { moveNoteVertically } from './move-note';
import { moveNeumeVertically } from './move-neume';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import { layoutChant } from '../layout/layout-chant';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { entryAppearance } from '../state/editor-tool';
import { buildNeumeGeometry } from '../layout/neume-geometry';

const n = (id: string, pitch: number): ChantNote => ({
  id,
  staffPosition: staffPosition(pitch),
});
const examples: Neume[] = [
  { id: 'p', kind: 'punctum', notes: [n('p0', 2)] },
  { id: 'pes', kind: 'podatus', notes: [n('pes0', 1), n('pes1', 3)] },
  { id: 'cli', kind: 'clivis', notes: [n('cli0', 4), n('cli1', 2)] },
  {
    id: 'sca',
    kind: 'scandicus',
    notes: [n('sca0', 1), n('sca1', 3), n('sca2', 5)],
  },
  {
    id: 'tor',
    kind: 'torculus',
    notes: [n('tor0', 1), n('tor1', 3), n('tor2', 2)],
  },
  {
    id: 'clim',
    kind: 'climacus',
    notes: [n('clim0', 5), n('clim1', 3), n('clim2', 1)],
  },
  {
    id: 'por',
    kind: 'porrectus',
    notes: [n('por0', 4), n('por1', 1), n('por2', 3)],
  },
];
const document = (): ChantDocument => ({
  ...blankDocument(),
  neumes: structuredClone(examples),
  syllables: [
    { id: 's', text: 'la', startsAtNeumeId: 'sca', boundaryBefore: 'word' },
  ],
});

describe('authored form validation and immutable commands', () => {
  for (const neume of examples)
    for (const [index, note] of neume.notes.entries())
      for (const form of ['virga', 'inclinatum', 'quilisma'] as const) {
        it(`${neume.kind} note ${index} ${form}: exact whitelist`, () => {
          const doc = document();
          const result = updateNoteForm(doc, note.id, form);
          if (
            allowedNoteForms(neume.kind, index, neume.notes.length).includes(
              form,
            )
          ) {
            expect(result).not.toBe(doc);
            expect(result.syllables).toBe(doc.syllables);
            expect(
              result.neumes.find((n) => n.id === neume.id)?.notes[index],
            ).toEqual({ ...note, form });
            expect(updateNoteForm(result, note.id, form)).toBe(result);
            expect(updateNoteForm(result, note.id, undefined)).toEqual(doc);
            expect(decodeDocument(encodeDocument(result))).toEqual(result);
          } else expect(result).toBe(doc);
        });
      }
  it('preserves all signs, identities, pitches, kind and lyrics across form/move/history', () => {
    let doc = document();
    doc = updateMoraScope(doc, 'sca', 'final-two');
    doc = updateNoteModifiers(doc, 'sca1', { kind: 'episema', value: true });
    const marked = doc;
    const session = createEditorSession(doc);
    const changed = reduceEditorSession(session, {
      type: 'engraving-edit',
      edit: (d) => updateNoteForm(d, 'sca1', 'quilisma'),
    });
    const shaped = changed.history.present;
    expect(shaped.neumes[3].notes).toEqual(
      marked.neumes[3].notes.map((n) =>
        n.id === 'sca1' ? { ...n, form: 'quilisma' } : n,
      ),
    );
    expect(changed.history.past).toEqual([marked]);
    expect(
      reduceEditorSession(changed, {
        type: 'engraving-edit',
        edit: (d) => updateNoteForm(d, 'sca1', 'quilisma'),
      }),
    ).toBe(changed);
    const undo = reduceEditorSession(changed, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(undo.history.present).toBe(marked);
    expect(
      reduceEditorSession(undo, {
        type: 'history',
        direction: 'redo',
        focusedNoteId: null,
      }).history.present,
    ).toBe(shaped);
    const moved = moveNeumeVertically(shaped, 'sca', 1);
    expect(moved.neumes[3].notes[1]).toEqual({
      ...shaped.neumes[3].notes[1],
      staffPosition: 4,
    });
    expect(moveNoteVertically(shaped, 'sca1', 1).neumes[3].notes[1]?.form).toBe(
      'quilisma',
    );
    const once = moveNoteVertically(shaped, 'sca1', 1);
    expect(moveNoteVertically(once, 'sca1', 1)).toBe(once);
  });
  it('keeps unrelated no-op edits canonical while a shaped note is selected', () => {
    const doc = updateNoteForm(document(), 'p0', 'virga');
    const session = {
      ...createEditorSession(doc),
      selection: { kind: 'note' as const, noteId: 'p0' },
    };
    expect(reduceEditorSession(session, { type: 'edit', edit: (d) => d })).toBe(
      session,
    );
    expect(
      reduceEditorSession(session, {
        type: 'engraving-edit',
        edit: (d) => updateNoteForm(d, 'p0', 'virga'),
      }),
    ).toBe(session);
  });
  it('preserves exclusive lyric/history guards when arming authored tools', () => {
    const session = createEditorSession(document());
    const draft = {
      ...session,
      lyrics: {
        kind: 'draft' as const,
        neumeId: 'p',
        original: null,
        text: 'bad text',
        boundaryBefore: 'word' as const,
      },
    };
    const rejected = reduceEditorSession(draft, {
      type: 'arm',
      tool: { kind: 'place-punctum', form: 'virga' },
      lyricCommitId: 'new-lyric',
    });
    expect(rejected.history).toBe(draft.history);
    expect(rejected.lyrics).toEqual(draft.lyrics);
    expect(rejected.activeTool).toEqual(draft.activeTool);
    const pending = {
      ...session,
      pendingHistory: { direction: 'undo' as const, focusedNoteId: null },
    };
    expect(
      reduceEditorSession(pending, {
        type: 'arm',
        tool: { kind: 'place-scandicus', form: 'quilisma' },
      }),
    ).toBe(pending);
  });
  it('rejects invalid surviving forms on every relevant deletion branch without retargeting', () => {
    const doc = updateNoteForm(document(), 'sca1', 'quilisma');
    expect(deleteNote(doc, 'sca2')).toBe(doc);
    const lowerDeleted = deleteNote(doc, 'sca0');
    expect(lowerDeleted.neumes[3]).toEqual({
      id: 'sca',
      kind: 'podatus',
      notes: doc.neumes[3].notes.slice(1),
    });
    expect(deleteNote(lowerDeleted, 'sca2')).toBe(lowerDeleted);
    expect(deleteNote(lowerDeleted, 'sca1').neumes[3].notes[0]).toBe(
      doc.neumes[3].notes[2],
    );
    expect(deleteNote(doc, 'sca1').neumes[3].notes.map((n) => n.form)).toEqual([
      undefined,
      undefined,
    ]);
    for (const neume of examples)
      for (const note of neume.notes) {
        const result = normalizeNeumeAfterNoteDeletion(neume, note.id);
        if (result) expect(isValidNeume(result)).toBe(true);
      }
    const state = {
      ...createEditorSession(doc),
      selection: { kind: 'note' as const, noteId: 'sca2' },
    };
    const rejected = reduceEditorSession(state, {
      type: 'edit',
      formDeletionNoteId: 'sca2',
      edit: (d) => deleteNote(d, 'sca2'),
    });
    expect(rejected.history).toBe(state.history);
    expect(rejected.announcement.text).toContain('Edit rejected');
  });
});

describe('atomic direct insertion and matching ghost', () => {
  it.each([
    ['punctum', 'virga'],
    ['punctum', 'inclinatum'],
    ['podatus', 'quilisma'],
    ['scandicus', 'quilisma'],
  ] as const)('%s %s before any preceding music', (kind, form) => {
    const doc = blankDocument();
    let session = createEditorSession(doc);
    const tool =
      kind === 'punctum'
        ? { kind: 'place-punctum' as const, form }
        : kind === 'podatus'
          ? { kind: 'place-podatus' as const, form: 'quilisma' as const }
          : { kind: 'place-scandicus' as const, form: 'quilisma' as const };
    session = reduceEditorSession(session, { type: 'arm', tool });
    const point = { x: 200, y: 100 };
    const preview = resolveGraphicalNeumePlacement(
      layoutChant(doc),
      kind,
      point,
      entryAppearance(kind, form),
    );
    expect(preview).not.toBeNull();
    const ids = { neumeId: 'new', noteIds: ['a', 'b', 'c'] as const };
    const placed = reduceEditorSession(session, {
      type: 'place',
      kind,
      point,
      ids,
    });
    expect(placed.history.past).toEqual([doc]);
    const neume = placed.history.present.neumes[0];
    expect(neume.kind).toBe(kind);
    expect(neume.notes[kind === 'scandicus' ? 1 : 0]?.form).toBe(form);
    expect(placed.activeTool).toBe(session.activeTool);
    const geometry = buildNeumeGeometry(
      kind,
      neume.notes.map((n) => n.staffPosition),
      preview?.preview.bounds.x ?? 0,
      Math.max(...layoutChant(doc).systems[0].staffLines.map((l) => l.y)),
      neume.notes,
    );
    expect(geometry.ink).toEqual(preview?.preview.ink);
    const keyboard = reduceEditorSession(session, { type: 'insert', ids });
    expect(
      keyboard.history.present.neumes[0].notes[kind === 'scandicus' ? 1 : 0]
        ?.form,
    ).toBe(form);
    expect(
      reduceEditorSession(placed, {
        type: 'history',
        direction: 'undo',
        focusedNoteId: null,
      }).history.present,
    ).toBe(doc);
  });
});

describe('exact versioned readers and guarded upgrade', () => {
  it.each([v1Source, v2Source])(
    'loads actual old source unchanged, then saves v8 in the same key',
    (source) => {
      const originalKey = 'gregorian-chant-editor:active-document:v1';
      expect(autosaveKey).toBe(originalKey);
      let bytes = source;
      const adapter = new BrowserDocument(() => ({
        getItem: (key) => {
          expect(key).toBe(originalKey);
          return bytes;
        },
        setItem: (key, v) => {
          expect(key).toBe(originalKey);
          bytes = v;
        },
      }));
      const doc = adapter.load(blankDocument());
      expect(bytes).toBe(source);
      expect(doc).toEqual({ ...JSON.parse(source).document, accidentals: [] });
      const id = doc.neumes[0].notes[0].id;
      const form = doc.neumes[0].kind === 'punctum' ? 'virga' : 'quilisma';
      const edit = updateNoteForm(doc, id, form);
      expect(edit).not.toBe(doc);
      expect(edit.neumes[0].notes[0].form).toBe(form);
      adapter.save(edit);
      expect(JSON.parse(bytes).version).toBe(8);
      expect(decodeDocument(bytes)).toEqual(edit);
      expect(doc.neumes.flatMap((n) => n.notes).some((n) => 'form' in n)).toBe(
        false,
      );
    },
  );
  it.each([null, false, 1, {}, [], 'default', 'square', 'unknown'])(
    'rejects malformed/unknown form %j and preserves cached bytes',
    (form) => {
      const payload = JSON.parse(encodeDocument(document()));
      payload.document.neumes[0].notes[0].form = form;
      const source = JSON.stringify(payload);
      expect(() => decodeDocument(source)).toThrow();
      let bytes = source;
      const adapter = new BrowserDocument(() => ({
        getItem: () => bytes,
        setItem: (_k, v) => {
          bytes = v;
        },
      }));
      const fallback = blankDocument();
      expect(adapter.load(fallback)).toBe(fallback);
      adapter.save(document());
      expect(bytes).toBe(source);
      expect(adapter.recoverySource).toBe(source);
    },
  );
  it('rejects forms in exact v1/v2, form/context mismatch in v3 and future versions', () => {
    const payload = JSON.parse(
      encodeDocument(updateNoteForm(document(), 'pes0', 'quilisma')),
    );
    delete payload.document.accidentals;
    for (const version of [1, 2, 9])
      expect(() =>
        decodeDocument(JSON.stringify({ ...payload, version })),
      ).toThrow();
    payload.version = 3;
    payload.document.neumes[1].notes[0].form = 'virga';
    expect(() => decodeDocument(JSON.stringify(payload))).toThrow();
  });
});

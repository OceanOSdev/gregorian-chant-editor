import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type Neume,
  type ChantDocument,
} from './chant-document';
import { deriveScoreOrder, scoreBoundaryAt } from './divisions';
import { isValidNeume } from './neume';
import {
  blankDocument,
  decodeDocument,
  encodeDocument,
} from '../persistence/native-document';
import { BrowserDocument } from '../persistence/browser-document';
import { insertNeume } from '../commands/insert-neume';
import { deleteNote } from '../commands/delete-note';
import { deleteNeume } from '../commands/delete-neume';
import { moveNoteVertically } from '../commands/move-note';
import { moveNeumeVertically } from '../commands/move-neume';
import {
  updateNoteModifiers,
  updateMoraScope,
} from '../commands/update-note-modifiers';
import { updateNoteForm } from '../commands/update-note-form';
import { updateAccidental } from '../commands/update-accidental';
import { updateClef } from '../commands/update-clef';
import { resolveEffectivePitches } from './accidentals';
import { moraChoices, resolveMoraScope, type MoraScope } from './mora';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import { reconcileSelection } from '../state/selection';
import { buildNeumeGeometry } from '../layout/neume-geometry';
import { layoutChant } from '../layout/layout-chant';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { insertEditorNeume } from '../interaction/insert-editor-neume';

function effective(doc: ChantDocument) {
  const result = resolveEffectivePitches(doc);
  if (!result) throw Error('Invalid pitches');
  return [...result.values()];
}
const kinds = ['bistropha', 'tristropha'] as const;
function neume(kind: (typeof kinds)[number], prefix = 'n', pitch = 5): Neume {
  const note = (i: number) => ({
    id: prefix + i,
    staffPosition: staffPosition(pitch),
    episema: true as const,
    verticalEpisema: true as const,
  });
  return kind === 'bistropha'
    ? { id: prefix, kind, notes: [note(0), note(1)] }
    : { id: prefix, kind, notes: [note(0), note(1), note(2)] };
}
function fixture(kind: (typeof kinds)[number]): ChantDocument {
  return {
    ...blankDocument(),
    clef: { type: 'c', staffLine: 4 },
    neumes: [neume(kind)],
    syllables: [
      { id: 's', text: 'Lux', boundaryBefore: 'word', startsAtNeumeId: 'n' },
    ],
    divisions: [{ id: 'd', kind: 'minor', beforeNeumeId: 'n' }],
    clefChanges: [
      {
        id: 'c',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: 'n',
        beforeDivisionId: 'd',
      },
    ],
  };
}

describe.each(kinds)('%s fixed written-unison group', (kind) => {
  it('validates every mora subset independently of the choices implementation', () => {
    const doc = fixture(kind),
      group = doc.neumes[0];
    expect(moraChoices(kind, group.notes.length)).toEqual([
      { value: 'none', label: 'None' },
    ]);
    for (let mask = 0; mask < 2 ** group.notes.length; mask++) {
      const copy = structuredClone(doc);
      copy.neumes[0].notes.forEach((n, i) => {
        if (mask & (1 << i)) n.mora = 1;
      });
      expect(isValidNeume(copy.neumes[0])).toBe(mask === 0);
      expect(
        resolveMoraScope(
          kind,
          copy.neumes[0].notes.map((n) => n.mora),
        ),
      ).toBe(mask ? null : 'none');
      const bytes = JSON.stringify({
        format: 'gregorian-chant-editor',
        version: 6,
        document: copy,
      });
      if (mask) expect(() => decodeDocument(bytes)).toThrow();
      else expect(decodeDocument(bytes)).toEqual(doc);
    }
    for (const scope of [
      'sole',
      'first',
      'second',
      'both',
      'final',
      'final-two',
    ] satisfies MoraScope[])
      expect(updateMoraScope(doc, 'n', scope)).toBe(doc);
    for (const note of group.notes) {
      expect(
        updateNoteModifiers(doc, note.id, { kind: 'mora', value: 1 }),
      ).toBe(doc);
      for (const form of ['virga', 'inclinatum', 'quilisma'] as const)
        expect(updateNoteForm(doc, note.id, form)).toBe(doc);
      expect(moveNoteVertically(doc, note.id, 1)).toBe(doc);
      expect(moveNoteVertically(doc, note.id, -1)).toBe(doc);
    }
  });
  it('rejects unequal pitch, incorrect counts, duplicate IDs, forms and unknown fields in native v6 and insertion', () => {
    const doc = fixture(kind);
    const mutations = [
      (n: Neume) => {
        if (n.notes[1]) n.notes[1].staffPosition = staffPosition(6);
      },
      (n: Neume) => {
        n.notes.pop();
      },
      (n: Neume) => {
        n.notes.push({ ...n.notes[0], id: 'extra' });
      },
      (n: Neume) => {
        if (n.notes[1]) n.notes[1].id = n.notes[0].id;
      },
      (n: Neume) => {
        if (n.notes[1]) n.notes[1].form = 'virga';
      },
    ];
    for (const change of mutations) {
      const copy = structuredClone(doc);
      change(copy.neumes[0]);
      expect(() =>
        decodeDocument(
          JSON.stringify({
            format: 'gregorian-chant-editor',
            version: 6,
            document: copy,
          }),
        ),
      ).toThrow();
      expect(insertNeume(blankDocument(), copy.neumes[0], 0)).toEqual(
        blankDocument(),
      );
    }
    const payload = JSON.parse(encodeDocument(doc));
    payload.document.neumes[0].notes[0].other = true;
    expect(() => decodeDocument(JSON.stringify(payload))).toThrow();
  });
  it('normalizes every constituent preserving survivor objects, anchor and boundary collections; final deletion follows existing policy', () => {
    const doc = fixture(kind),
      group = doc.neumes[0];
    for (const note of group.notes) {
      const next = deleteNote(doc, note.id),
        normalized = next.neumes[0];
      expect(normalized.kind).toBe(
        kind === 'tristropha' ? 'bistropha' : 'punctum',
      );
      expect(normalized.id).toBe('n');
      expect(normalized.notes).toEqual(
        group.notes.filter((n) => n.id !== note.id),
      );
      for (const survivor of normalized.notes)
        expect(survivor).toBe(group.notes.find((n) => n.id === survivor.id));
      expect(next.syllables).toEqual(doc.syllables);
      expect(next.divisions).toEqual(doc.divisions);
      expect(next.clefChanges).toEqual(doc.clefChanges);
      expect(isValidNeume(normalized)).toBe(true);
      const selection = {
        kind: 'note' as const,
        noteId: normalized.notes[0].id,
      };
      expect(reconcileSelection(next, selection)).toBe(selection);
    }
    const removed = deleteNeume(doc, 'n');
    expect(removed.neumes).toEqual([]);
    expect(removed.syllables).toEqual([]);
    expect(removed.divisions[0].beforeNeumeId).toBeNull();
    expect(removed.clefChanges[0].beforeNeumeId).toBeNull();
  });
  it('inserts at every mixed clef/division slot while preserving lyric membership and event order', () => {
    const doc = fixture(kind),
      order = deriveScoreOrder(doc);
    if (!order) throw Error('Invalid fixture order');
    for (let slot = 0; slot <= order.length; slot++) {
      const group = neume(kind, 'new-', 5),
        boundary = scoreBoundaryAt(order, slot);
      const inserted = insertNeume(doc, group, boundary),
        result = deriveScoreOrder(inserted);
      expect(result?.map((item) => item.entity.id)).toEqual([
        ...order.slice(0, slot).map((item) => item.entity.id),
        group.id,
        ...order.slice(slot).map((item) => item.entity.id),
      ]);
      expect(inserted.syllables).toBe(doc.syllables);
      expect(inserted.neumes.find((n) => n.id === 'n')).toBe(doc.neumes[0]);
      expect(deleteNeume(inserted, group.id)).toEqual(doc);
    }
  });
  it('remembers the exact variant across Select and T without rearming Punctum', () => {
    const state = reduceEditorSession(createEditorSession(blankDocument()), {
      type: 'arm',
      tool: {
        kind: kind === 'bistropha' ? 'place-bistropha' : 'place-tristropha',
      },
    });
    const selected = reduceEditorSession(state, { type: 'select-tool' });
    const focused = reduceEditorSession(selected, { type: 'focus-palette' });
    expect(focused.activeTool.kind).toBe('select');
    expect(focused.rememberedKind).toBe(kind);
    expect(focused.focusRequest).toEqual({
      kind: 'palette',
      tool: 'punctum-menu',
    });
    expect(focused.history).toBe(state.history);
    const inserted = reduceEditorSession(focused, {
      type: 'insert',
      ids: { neumeId: 'new', noteIds: ['a', 'b', 'c'] },
    });
    expect(inserted.history.present.neumes[0].kind).toBe(kind);
    expect(inserted.rememberedKind).toBe(kind);
  });
  it('moves all notes with stable IDs and independent episemata, preserving exact history and rejected edits', () => {
    const doc = fixture(kind),
      moved = moveNeumeVertically(doc, 'n', 1);
    expect(moved.neumes[0].notes.map((n) => n.staffPosition)).toEqual(
      doc.neumes[0].notes.map((n) => n.staffPosition + 1),
    );
    expect(moved.neumes[0].notes.map((n) => n.id)).toEqual(
      doc.neumes[0].notes.map((n) => n.id),
    );
    for (const note of doc.neumes[0].notes)
      for (const sign of ['episema', 'verticalEpisema'] as const) {
        const next = updateNoteModifiers(doc, note.id, {
          kind: sign,
          value: false,
        });
        expect(
          next.neumes[0].notes.find((n) => n.id === note.id)?.[sign],
        ).toBeUndefined();
        expect(
          next.neumes[0].notes
            .filter((n) => n.id !== note.id)
            .every((n) => n[sign]),
        ).toBe(true);
      }
    const state = createEditorSession(doc);
    const next = reduceEditorSession(state, {
      type: 'edit',
      edit: () => moved,
    });
    expect(next.history.past).toEqual([doc]);
    const undo = reduceEditorSession(next, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(undo.history.present).toBe(doc);
    expect(
      reduceEditorSession(undo, {
        type: 'history',
        direction: 'redo',
        focusedNoteId: null,
      }).history.present,
    ).toBe(moved);
    const rejected = reduceEditorSession(state, {
      type: 'edit',
      focusNoteId: 'n0',
      noteMoveId: 'n0',
      edit: (d) => moveNoteVertically(d, 'n0', 1),
    });
    expect(rejected.history).toBe(state.history);
    expect(rejected.announcement.text).toContain('same pitch');
    // A rejected whole-group move is not misreported as a unison violation.
    const groupRejected = reduceEditorSession(state, {
      type: 'edit',
      focusNoteId: 'n0',
      edit: (d) => d,
    });
    expect(groupRejected.announcement.text).not.toContain('same pitch');
  });
  it('preserves ADR 0021 canonical repeated-B ownership and owner-loss deletion; clef moves preserve pitches', () => {
    const base = { ...fixture(kind), clefChanges: [] };
    const signed = updateAccidental(
      base,
      base.neumes[0].notes.at(-1)?.id ?? '',
      'flat',
      'a',
    );
    expect(signed.accidentals).toEqual([
      { id: 'a', kind: 'flat', ownerNoteId: 'n0' },
    ]);
    expect(effective(signed).every((n) => n.alteration === -1)).toBe(true);
    expect(deleteNote(signed, 'n1').accidentals).toEqual(signed.accidentals);
    expect(deleteNote(signed, 'n0').accidentals).toEqual([]);
    const changed = updateClef(signed, { type: 'f', staffLine: 2 });
    expect(changed.accidentals).toEqual(signed.accidentals);
    expect(effective(changed).map((n) => [n.degree, n.alteration])).toEqual(
      effective(signed).map((n) => [n.degree, n.alteration]),
    );
  });
  it('round trips the current version (v9) and rejects the kinds under every exact legacy reader, guarding original cache bytes', () => {
    const doc = fixture(kind),
      text = encodeDocument(doc);
    expect(JSON.parse(text).version).toBe(9);
    expect(decodeDocument(text)).toEqual(doc);
    for (const version of [1, 2, 3, 4, 5]) {
      const payload = JSON.parse(text);
      payload.version = version;
      if (version < 5) delete payload.document.accidentals;
      if (version < 4)
        for (const n of payload.document.neumes[0].notes)
          delete n.verticalEpisema;
      if (version === 1)
        for (const n of payload.document.neumes[0].notes) delete n.episema;
      const original = JSON.stringify(payload);
      expect(() => decodeDocument(original)).toThrow(/kind/);
      let bytes = original;
      const adapter = new BrowserDocument(() => ({
        getItem: () => bytes,
        setItem: (_key, value) => {
          bytes = value;
        },
      }));
      const fallback = blankDocument();
      expect(adapter.load(fallback)).toBe(fallback);
      adapter.save(doc);
      expect(bytes).toBe(original);
      expect(adapter.recoverySource).toBe(original);
    }
    for (const version of [1, 2, 3, 4, 5]) {
      const payload = {
        format: 'gregorian-chant-editor',
        version,
        document: blankDocument(),
      };
      if (version < 5) Reflect.deleteProperty(payload.document, 'accidentals');
      expect(decodeDocument(JSON.stringify(payload))).toEqual(blankDocument());
    }
  });
  it('shares measured punctum heads, nonoverlapping hit columns, both signs, wrapping and graphical placement on each system', () => {
    const count = kind === 'bistropha' ? 2 : 3;
    for (const pitch of [-3, 0, 1, 2, 5, 6, 9])
      for (let mask = 0; mask < 2 ** (count * 2); mask++) {
        const marks = Array.from({ length: count }, (_, i) => ({
          ...(mask & (1 << i) ? { episema: true as const } : {}),
          ...(mask & (1 << (i + count))
            ? { verticalEpisema: true as const }
            : {}),
        }));
        const g = buildNeumeGeometry(
          kind,
          Array.from({ length: count }, () => staffPosition(pitch)),
          100,
          124,
          marks,
        );
        expect(g.notes).toHaveLength(count);
        expect(g.ink).toHaveLength(
          count +
            marks.filter((n) => n.episema).length +
            marks.filter((n) => n.verticalEpisema).length,
        );
        expect(g.bounds.width).toBe(12 + (count - 1) * 18);
        expect(g.lyricAnchorX).toBe(100 + g.bounds.width / 2);
        g.notes.forEach((n, i) => {
          expect(n.head).toEqual(
            buildNeumeGeometry(
              'punctum',
              [staffPosition(pitch)],
              100 + i * 18,
              124,
            ).notes[0].head,
          );
          if (i)
            expect(n.hitBounds.x).toBeGreaterThanOrEqual(
              g.notes[i - 1].hitBounds.x + g.notes[i - 1].hitBounds.width,
            );
        });
        for (const ink of g.ink) {
          expect(ink.bounds.x).toBeGreaterThanOrEqual(g.bounds.x);
          expect(ink.bounds.x + ink.bounds.width).toBeLessThanOrEqual(
            g.bounds.x + g.bounds.width,
          );
          expect(ink.bounds.y).toBeGreaterThanOrEqual(g.bounds.y);
          expect(ink.bounds.y + ink.bounds.height).toBeLessThanOrEqual(
            g.bounds.y + g.bounds.height,
          );
        }
      }
    const doc = {
      ...blankDocument(),
      neumes: Array.from({ length: 30 }, (_, i) =>
        neume(kind, 'g' + i + '-', 2),
      ),
    };
    const layout = layoutChant(doc);
    expect(layout.systems.length).toBeGreaterThan(1);
    for (const system of layout.systems) {
      const point = { x: 300, y: system.staffLines[2].y };
      const placement = resolveGraphicalNeumePlacement(layout, kind, point);
      expect(placement).not.toBeNull();
      if (!placement) throw Error('Missing placement');
      expect(new Set(placement.staffPositions).size).toBe(1);
      const inserted = insertEditorNeume(doc, placement, {
        neumeId: 'inserted',
        noteIds: ['a', 'b', 'c'],
      });
      expect(inserted.neumes[placement.insertionIndex].kind).toBe(kind);
      expect(
        inserted.neumes[placement.insertionIndex].notes.map((n) => n.id),
      ).toEqual(['a', 'b', 'c'].slice(0, count));
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
} from '../domain/chant-document';
import { resolveEffectivePitches } from '../domain/accidentals';
import { blankDocument } from '../persistence/native-document';
import {
  placeAccidental,
  updateAccidental,
} from '../commands/update-accidental';
import { updateClef } from '../commands/update-clef';
import {
  insertClefChange,
  preserveClefMelody,
} from '../commands/edit-clef-change';
import {
  bundledExamples,
  loadBundledExample,
} from '../examples/bundled-examples';
import {
  equalNoteDurationSeconds,
  interpretEqualNotes,
} from './equal-note-performance';
import { playbackMidiNote, type Performance } from './performance';

function note(id: string, position: number): ChantNote {
  return { id, staffPosition: staffPosition(position) };
}
function punctum(id: string, position: number): Neume {
  return { id, kind: 'punctum', notes: [note(`${id}n`, position)] };
}
/** C clef on the bottom line: staff position equals relative degree. */
function score(neumes: Neume[]): ChantDocument {
  return { ...blankDocument(), clef: { type: 'c', staffLine: 1 }, neumes };
}
function performance(document: ChantDocument): Performance {
  const result = interpretEqualNotes(document);
  if (!result.ok) throw Error(`Expected a performance, got ${result.reason}`);
  return result.performance;
}
const midiNotes = (document: ChantDocument) =>
  performance(document).notes.map((n) => n.midiNote);

describe('playback register convention', () => {
  it.each([
    [0, 60],
    [1, 62],
    [2, 64],
    [3, 65],
    [4, 67],
    [5, 69],
    [6, 71],
    [7, 72],
    [13, 83],
    [14, 84],
  ])('sounds degree %i as MIDI %i', (degree, midi) =>
    expect(playbackMidiNote(degree, 0)).toBe(midi),
  );
  it.each([
    [-1, 59],
    [-2, 57],
    [-6, 50],
    [-7, 48],
    [-8, 47],
    [-14, 36],
    [-15, 35],
  ])('floors negative degree %i into the octave below (MIDI %i)', (d, midi) =>
    expect(playbackMidiNote(d, 0)).toBe(midi),
  );
  it('applies a flat after the diatonic step', () => {
    expect(playbackMidiNote(6, -1)).toBe(70);
    expect(playbackMidiNote(-1, -1)).toBe(58);
    expect(playbackMidiNote(13, -1)).toBe(82);
  });
});

describe('equal note performance', () => {
  it('sounds a one-note chant once', () => {
    expect(performance(score([punctum('a', 0)]))).toEqual({
      notes: [
        {
          noteId: 'an',
          neumeId: 'a',
          degree: 0,
          alteration: 0,
          midiNote: 60,
          startSeconds: 0,
          durationSeconds: equalNoteDurationSeconds,
        },
      ],
      durationSeconds: equalNoteDurationSeconds,
    });
  });

  it('plays an empty score as an empty performance', () => {
    expect(interpretEqualNotes(blankDocument())).toEqual({
      ok: true,
      performance: { notes: [], durationSeconds: 0 },
    });
  });

  it('plays every note of every neume kind in tuple order with stable identities', () => {
    const d = score([
      punctum('p', 2),
      { id: 'pes', kind: 'podatus', notes: [note('pes0', 1), note('pes1', 3)] },
      { id: 'cl', kind: 'clivis', notes: [note('cl0', 3), note('cl1', 2)] },
      {
        id: 'tri',
        kind: 'tristropha',
        notes: [note('tri0', 4), note('tri1', 4), note('tri2', 4)],
      },
      { id: 'bi', kind: 'bistropha', notes: [note('bi0', 4), note('bi1', 4)] },
      {
        id: 'sc',
        kind: 'scandicus',
        notes: [note('sc0', 0), note('sc1', 1), note('sc2', 2), note('sc3', 3)],
      },
      {
        id: 'cm',
        kind: 'climacus',
        notes: [
          note('cm0', 7),
          note('cm1', 6),
          note('cm2', 5),
          note('cm3', 4),
          note('cm4', 3),
        ],
      },
      {
        id: 'to',
        kind: 'torculus',
        notes: [note('to0', 2), note('to1', 4), note('to2', 3)],
      },
      {
        id: 'po',
        kind: 'porrectus',
        notes: [note('po0', 4), note('po1', 2), note('po2', 3)],
      },
      {
        id: 'ps',
        kind: 'pes-subpunctis',
        notes: [
          note('ps0', 2),
          note('ps1', 5),
          note('ps2', 4),
          note('ps3', 3),
          note('ps4', 2),
        ],
      },
      {
        id: 'tr',
        kind: 'torculus-resupinus',
        notes: [note('tr0', 1), note('tr1', 3), note('tr2', 2), note('tr3', 4)],
      },
      {
        id: 'pf',
        kind: 'porrectus-flexus',
        notes: [note('pf0', 4), note('pf1', 2), note('pf2', 3), note('pf3', 1)],
      },
      {
        id: 'sf',
        kind: 'scandicus-flexus',
        notes: [note('sf0', 0), note('sf1', 1), note('sf2', 3), note('sf3', 2)],
      },
      {
        id: 'cr',
        kind: 'climacus-resupinus',
        notes: [note('cr0', 5), note('cr1', 4), note('cr2', 2), note('cr3', 3)],
      },
    ]);
    const authored = d.neumes.flatMap((neume) =>
      neume.notes.map((n) => ({ noteId: n.id, neumeId: neume.id })),
    );
    const played = performance(d).notes;
    expect(played.map(({ noteId, neumeId }) => ({ noteId, neumeId }))).toEqual(
      authored,
    );
    expect(played.map((n) => n.degree)).toEqual(
      d.neumes.flatMap((neume) => neume.notes.map((n) => n.staffPosition)),
    );
  });

  it('keeps repeated notes as distinct, back-to-back equal events', () => {
    const p = performance(
      score([
        {
          id: 'tri',
          kind: 'tristropha',
          notes: [note('t0', 4), note('t1', 4), note('t2', 4)],
        },
        punctum('again', 4),
      ]),
    );
    expect(p.notes.map((n) => [n.noteId, n.midiNote, n.startSeconds])).toEqual([
      ['t0', 67, 0],
      ['t1', 67, equalNoteDurationSeconds],
      ['t2', 67, 2 * equalNoteDurationSeconds],
      ['againn', 67, 3 * equalNoteDurationSeconds],
    ]);
    expect(new Set(p.notes.map((n) => n.durationSeconds))).toEqual(
      new Set([equalNoteDurationSeconds]),
    );
    expect(p.durationSeconds).toBe(4 * equalNoteDurationSeconds);
  });

  it('sounds pitches above and below the staff across octave boundaries', () => {
    expect(
      midiNotes(
        score([
          punctum('low2', -8),
          punctum('low', -1),
          punctum('do', 0),
          punctum('high', 7),
          punctum('high2', 9),
        ]),
      ),
    ).toEqual([47, 59, 60, 72, 76]);
  });

  it('does not sound divisions or clef changes and leaves no gap for them', () => {
    const d = score([punctum('a', 0), punctum('b', 0), punctum('c', 0)]);
    d.divisions = [
      { id: 'bar', kind: 'maior', beforeNeumeId: 'b' },
      { id: 'end', kind: 'finalis', beforeNeumeId: null },
    ];
    d.clefChanges = [
      {
        id: 'clef',
        clef: { type: 'f', staffLine: 3 },
        beforeNeumeId: 'c',
        beforeDivisionId: null,
      },
    ];
    const p = performance(d);
    expect(p.notes.map((n) => n.noteId)).toEqual(['an', 'bn', 'cn']);
    expect(p.notes.map((n) => n.startSeconds)).toEqual([
      0,
      equalNoteDurationSeconds,
      2 * equalNoteDurationSeconds,
    ]);
  });

  it('follows initial and mid-score C and F clefs', () => {
    // C clef on line 4: the top line is do (C4).
    const c4 = {
      ...score([punctum('do', 6), punctum('la', 4)]),
      clef: { type: 'c', staffLine: 4 },
    } satisfies ChantDocument;
    expect(midiNotes(c4)).toEqual([60, 57]);
    // F clef on line 3: the middle line is fa (F4).
    const f3 = {
      ...score([punctum('fa', 4), punctum('do', 1)]),
      clef: { type: 'f', staffLine: 3 },
    } satisfies ChantDocument;
    expect(midiNotes(f3)).toEqual([65, 60]);
    // The same staff position changes pitch after a mid-score clef change.
    const changed = score([punctum('before', 4), punctum('after', 4)]);
    changed.clefChanges = [
      {
        id: 'clef',
        clef: { type: 'f', staffLine: 3 },
        beforeNeumeId: 'after',
        beforeDivisionId: null,
      },
    ];
    expect(midiNotes(changed)).toEqual([67, 65]);
  });

  it('sounds the same melody after melody-preserving clef edits', () => {
    const d = score([punctum('a', 0), punctum('b', 3), punctum('c', 5)]);
    const original = midiNotes(d);
    const initial = updateClef(d, { type: 'f', staffLine: 2 });
    expect(initial.clef).toEqual({ type: 'f', staffLine: 2 });
    expect(midiNotes(initial)).toEqual(original);
    const midScore = preserveClefMelody(
      d,
      insertClefChange(
        d,
        {
          id: 'clef',
          clef: { type: 'c', staffLine: 3 },
          beforeNeumeId: 'b',
          beforeDivisionId: null,
        },
        { beforeNeumeId: 'b', beforeDivisionId: null, beforeClefId: null },
      ),
    );
    if (!midScore) throw Error('Expected a melody-preserving clef change');
    expect(midScore.clefChanges).toHaveLength(1);
    expect(midScore.neumes[1].notes[0].staffPosition).not.toBe(3);
    expect(midiNotes(midScore)).toEqual(original);
  });

  it('reuses resolved effective pitches for every sounding note', () => {
    const d = loadBundledExample(
      bundledExamples.find((e) => /Kyrie/.test(e.name))?.id ?? '',
    );
    const resolved = [...(resolveEffectivePitches(d)?.values() ?? [])];
    expect(
      performance(d).notes.map((n) => [n.noteId, n.degree, n.alteration]),
    ).toEqual(resolved.map((p) => [p.note.id, p.degree, p.alteration]));
  });
});

describe('B flats and naturals in playback', () => {
  /** C clef on line 1; B is position 6 (degree 6) and -1 (degree -1). */
  function bScore(): ChantDocument {
    return {
      ...score([
        punctum('a', 5),
        punctum('b', 6),
        punctum('next', 6),
        punctum('lowB', -1),
        punctum('last', 6),
      ]),
      syllables: [
        { id: 'w1', text: 'o', startsAtNeumeId: 'a', boundaryBefore: 'word' },
      ],
    };
  }
  const flatB = (d = bScore()) => updateAccidental(d, 'bn', 'flat', 'flat');
  const midiOf = (d: ChantDocument, id: string) =>
    performance(d).notes.find((n) => n.noteId === id)?.midiNote;

  it('flattens the signed B and later B in its register within the scope', () => {
    const d = flatB();
    expect(midiNotes(bScore())).toEqual([69, 71, 71, 59, 71]);
    expect(midiNotes(d)).toEqual([69, 70, 70, 59, 70]);
  });

  it('isolates registers: a flat on B4 does not flatten B3', () => {
    expect(midiOf(flatB(), 'lowBn')).toBe(59);
    const low = updateAccidental(bScore(), 'lowBn', 'flat', 'low');
    expect(midiNotes(low)).toEqual([69, 71, 71, 58, 71]);
  });

  it('a natural cancels an earlier flat in the same scope', () => {
    const d = updateAccidental(flatB(), 'nextn', 'natural', 'natural');
    expect(midiNotes(d)).toEqual([69, 70, 71, 59, 71]);
  });

  it('resets at a new word but not at a continuation syllable', () => {
    const continuation = flatB();
    continuation.syllables.push({
      id: 'w2',
      text: 'mnis',
      startsAtNeumeId: 'next',
      boundaryBefore: 'continuation',
    });
    expect(midiOf(continuation, 'nextn')).toBe(70);
    const word = flatB();
    word.syllables.push({
      id: 'w2',
      text: 'mnis',
      startsAtNeumeId: 'next',
      boundaryBefore: 'word',
    });
    expect(midiOf(word, 'nextn')).toBe(71);
    expect(midiOf(word, 'lastn')).toBe(71);
  });

  it.each(['minima', 'minor', 'maior', 'finalis'] as const)(
    'resets at a %s division',
    (kind) => {
      const d = flatB();
      d.divisions = [{ id: 'bar', kind, beforeNeumeId: 'next' }];
      expect(midiNotes(d)).toEqual([69, 70, 71, 59, 71]);
    },
  );

  it('does not reset at a mid-score clef change', () => {
    const d = flatB();
    d.clefChanges = [
      {
        id: 'clef',
        clef: { type: 'c', staffLine: 1 },
        beforeNeumeId: 'next',
        beforeDivisionId: null,
      },
    ];
    expect(midiOf(d, 'nextn')).toBe(70);
  });

  it('applies an earlier-placed sign from its placement onward', () => {
    const d = placeAccidental(flatB(), 'flat', 'an');
    expect(d.accidentals[0].placement).toEqual({
      kind: 'above-note',
      noteId: 'an',
    });
    // The anchor note (A) is unaffected; the owner B and later B are flat.
    expect(midiNotes(d)).toEqual([69, 70, 70, 59, 70]);
  });
});

describe('unplayable scores', () => {
  it('rejects a score whose semantic order cannot be derived', () => {
    const d = score([punctum('a', 0)]);
    d.divisions = [{ id: 'bar', kind: 'minima', beforeNeumeId: 'missing' }];
    expect(interpretEqualNotes(d)).toEqual({
      ok: false,
      reason: 'invalid-score',
    });
  });

  it('rejects duplicated note identities instead of dropping a note', () => {
    const d = score([
      punctum('a', 0),
      { id: 'b', kind: 'punctum', notes: [note('an', 1)] },
    ]);
    expect(interpretEqualNotes(d)).toEqual({
      ok: false,
      reason: 'invalid-score',
    });
  });

  it('rejects an accidental that does not belong to a B', () => {
    const d = score([punctum('a', 0)]);
    d.accidentals = [{ id: 'flat', kind: 'flat', ownerNoteId: 'an' }];
    expect(interpretEqualNotes(d)).toEqual({
      ok: false,
      reason: 'invalid-score',
    });
  });

  it('reports a pitch outside the playable range instead of clamping it', () => {
    const d = score([punctum('a', 0), punctum('far', 200)]);
    expect(interpretEqualNotes(d)).toEqual({
      ok: false,
      reason: 'pitch-out-of-range',
      noteId: 'farn',
    });
  });

  it('rejects an unsafe staff position', () => {
    const d = score([punctum('a', Number.MAX_SAFE_INTEGER)]);
    d.clef = { type: 'f', staffLine: 1 };
    expect(interpretEqualNotes(d)).toEqual({
      ok: false,
      reason: 'invalid-score',
    });
  });
});

describe('bundled examples', () => {
  it.each(bundledExamples.map((e) => [e.name, e.id]))(
    'interprets %s note for note',
    (_name, id) => {
      const d = loadBundledExample(id);
      const p = performance(d);
      expect(p.notes.map((n) => n.noteId)).toEqual(
        d.neumes.flatMap((neume) => neume.notes.map((n) => n.id)),
      );
      expect(p.notes.every((n) => Number.isInteger(n.midiNote))).toBe(true);
      expect(p.durationSeconds).toBe(p.notes.length * equalNoteDurationSeconds);
    },
  );
});

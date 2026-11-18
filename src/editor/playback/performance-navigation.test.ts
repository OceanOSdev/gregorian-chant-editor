import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
} from '../domain/chant-document';
import { blankDocument } from '../persistence/native-document';
import type { EditorSelection } from '../state/selection';
import {
  bundledExamples,
  loadBundledExample,
} from '../examples/bundled-examples';
import type { Performance } from './performance';
import {
  activeNoteAt,
  performanceAtSpeed,
  performanceFrom,
  playbackSpeeds,
  resolvePlaybackStart,
} from './performance-navigation';
import {
  baseNoteSeconds,
  interpretProofreadingPlayback,
} from './proofreading-performance';

const d = baseNoteSeconds;
function note(id: string, position: number, mora = false): ChantNote {
  return {
    id,
    staffPosition: staffPosition(position),
    ...(mora ? { mora: 1 as const } : {}),
  };
}
function punctum(id: string, position: number, mora = false): Neume {
  return { id, kind: 'punctum', notes: [note(`${id}n`, position, mora)] };
}

/**
 * a | podatus(p0, p1) ‖minor‖ mora punctum m | b ‖maior‖ c
 * Base-note starts: a 0, p0 1, p1 2, (pause 1) m 4 (2 long), b 6,
 * (pause 2) c 9; total 10.
 */
function fixture(): ChantDocument {
  return {
    ...blankDocument(),
    clef: { type: 'c', staffLine: 1 },
    neumes: [
      punctum('a', 0),
      { id: 'pes', kind: 'podatus', notes: [note('p0', 1), note('p1', 3)] },
      punctum('m', 2, true),
      punctum('b', 1),
      punctum('c', 0),
    ],
    divisions: [
      { id: 'half', kind: 'minor', beforeNeumeId: 'm' },
      { id: 'full', kind: 'maior', beforeNeumeId: 'c' },
    ],
    syllables: [
      { id: 's1', text: 'Ky', startsAtNeumeId: 'a', boundaryBefore: 'word' },
      {
        id: 's2',
        text: 'ri',
        startsAtNeumeId: 'pes',
        boundaryBefore: 'continuation',
      },
    ],
  };
}
function performance(document = fixture()): Performance {
  const result = interpretProofreadingPlayback(document);
  if (!result.ok) throw Error(result.reason);
  return result.performance;
}
/** [noteId, start, duration] in base notes, rounded against float noise. */
const timeline = (p: Performance) =>
  p.notes.map((n) => [
    n.noteId,
    +(n.startSeconds / d).toFixed(9),
    +(n.durationSeconds / d).toFixed(9),
  ]);
const total = (p: Performance) => +(p.durationSeconds / d).toFixed(9);

describe('resolvePlaybackStart', () => {
  const doc = fixture();
  it.each([
    ['a note starts on itself', { kind: 'note', noteId: 'an' }, 'an'],
    ['a middle note starts mid-neume', { kind: 'note', noteId: 'p1' }, 'p1'],
    [
      'a neume starts on its first note',
      { kind: 'neume', neumeId: 'pes' },
      'p0',
    ],
    [
      'a forward range starts at its earliest neume',
      { kind: 'neume-range', anchorNeumeId: 'pes', endpointNeumeId: 'b' },
      'p0',
    ],
    [
      'a reverse range starts at its earliest neume',
      { kind: 'neume-range', anchorNeumeId: 'c', endpointNeumeId: 'm' },
      'mn',
    ],
    [
      'an anchored syllable starts on its neume',
      { kind: 'syllable', syllableId: 's2' },
      'p0',
    ],
  ] as [string, EditorSelection, string][])('%s', (_name, selection, id) =>
    expect(resolvePlaybackStart(doc, selection)).toBe(id),
  );

  it.each([
    ['nothing', { kind: 'none' }],
    ['the initial clef', { kind: 'clef' }],
    ['a division', { kind: 'division', divisionId: 'half' }],
    ['a deleted note', { kind: 'note', noteId: 'gone' }],
    ['a deleted neume', { kind: 'neume', neumeId: 'gone' }],
    [
      'a stale range',
      { kind: 'neume-range', anchorNeumeId: 'a', endpointNeumeId: 'gone' },
    ],
    ['a missing syllable', { kind: 'syllable', syllableId: 'gone' }],
  ] as [string, EditorSelection][])('%s starts at the beginning', (_n, s) =>
    expect(resolvePlaybackStart(doc, s)).toBeNull(),
  );

  it('starts in semantic order across a system boundary in a long score', () => {
    const dies = loadBundledExample(
      bundledExamples.find((e) => /Dies Ir/.test(e.name))?.id ?? '',
    );
    const [first, , third] = dies.neumes.slice(40);
    expect(
      resolvePlaybackStart(dies, {
        kind: 'neume-range',
        anchorNeumeId: third.id,
        endpointNeumeId: first.id,
      }),
    ).toBe(first.notes[0].id);
  });
});

describe('performanceFrom', () => {
  it('keeps the whole performance without a start note', () => {
    const p = performance();
    expect(performanceFrom(p, null)).toBe(p);
    expect(performanceFrom(p, 'unknown')).toBe(p);
    expect(performanceFrom(p, 'an')).toBe(p);
  });

  it('starts promptly on a mid-neume note and keeps later timing', () => {
    const p = performanceFrom(performance(), 'p1');
    expect(timeline(p)).toEqual([
      ['p1', 0, 1],
      ['mn', 2, 2],
      ['bn', 4, 1],
      ['cn', 7, 1],
    ]);
    expect(total(p)).toBe(8);
  });

  it('drops the pause before the start note but keeps later pauses', () => {
    const p = performanceFrom(performance(), 'mn');
    expect(timeline(p)).toEqual([
      ['mn', 0, 2],
      ['bn', 2, 1],
      ['cn', 5, 1],
    ]);
    expect(total(p)).toBe(6);
  });

  it('plays a single note from the last note', () => {
    const p = performanceFrom(performance(), 'cn');
    expect(timeline(p)).toEqual([['cn', 0, 1]]);
    expect(total(p)).toBe(1);
  });

  it('keeps every remaining note, pitch and identity', () => {
    const whole = performance();
    const p = performanceFrom(whole, 'p0');
    expect(
      p.notes.map(({ noteId, neumeId, midiNote, degree }) => ({
        noteId,
        neumeId,
        midiNote,
        degree,
      })),
    ).toEqual(
      whole.notes.slice(1).map(({ noteId, neumeId, midiNote, degree }) => ({
        noteId,
        neumeId,
        midiNote,
        degree,
      })),
    );
  });
});

describe('performanceAtSpeed', () => {
  it('offers the five agreed speeds', () => {
    expect(playbackSpeeds).toEqual([0.5, 0.75, 1, 1.25, 1.5]);
  });

  it('leaves the 1× performance unchanged', () => {
    const p = performance();
    expect(performanceAtSpeed(p, 1)).toBe(p);
  });

  it.each(playbackSpeeds)('scales every time consistently at %s×', (speed) => {
    const p = performance();
    const scaled = performanceAtSpeed(p, speed);
    expect(scaled.notes.map((n) => [n.noteId, n.midiNote])).toEqual(
      p.notes.map((n) => [n.noteId, n.midiNote]),
    );
    for (const [i, n] of scaled.notes.entries()) {
      expect(n.startSeconds).toBeCloseTo(p.notes[i].startSeconds / speed, 9);
      expect(n.durationSeconds).toBeCloseTo(
        p.notes[i].durationSeconds / speed,
        9,
      );
      expect(n.startSeconds).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(n.startSeconds)).toBe(true);
    }
    expect(scaled.durationSeconds).toBeCloseTo(p.durationSeconds / speed, 9);
  });

  it('scales a mora note, a division pause and the total together at 0.5×', () => {
    const slow = performanceAtSpeed(performanceFrom(performance(), 'p1'), 0.5);
    expect(timeline(slow)).toEqual([
      ['p1', 0, 2],
      ['mn', 4, 4],
      ['bn', 8, 2],
      ['cn', 14, 2],
    ]);
    expect(total(slow)).toBe(16);
  });
});

describe('activeNoteAt', () => {
  const p = performance(); // a 0-1, p0 1-2, p1 2-3, pause, m 4-6, b 6-7, pause, c 9-10
  const at = (base: number) => activeNoteAt(p, base * d);

  it('is silent before the first note (scheduling headroom)', () => {
    expect(at(-0.1)).toBeNull();
  });

  it('follows ordinary notes with half-open boundaries', () => {
    expect(at(0)).toBe('an');
    expect(at(0.999)).toBe('an');
    expect(at(1)).toBe('p0');
    expect(at(2.5)).toBe('p1');
  });

  it('is silent in a division pause and resumes on the next note', () => {
    expect(at(3.001)).toBeNull();
    expect(at(3.9)).toBeNull();
    expect(at(4)).toBe('mn');
  });

  it('holds a mora note for its whole length', () => {
    expect(at(5.5)).toBe('mn');
    expect(at(6)).toBe('bn');
    expect(at(8)).toBeNull();
  });

  it('is silent at and after the end', () => {
    expect(at(9.5)).toBe('cn');
    expect(at(10.001)).toBeNull();
    expect(at(100)).toBeNull();
  });

  it('distinguishes repeated pitches by note ID', () => {
    const doc = {
      ...fixture(),
      neumes: [
        {
          id: 'tri',
          kind: 'tristropha',
          notes: [note('t0', 2), note('t1', 2), note('t2', 2)],
        },
      ] as Neume[],
      divisions: [],
      syllables: [],
    };
    const repeated = performance(doc);
    expect([0.5, 1.5, 2.5].map((t) => activeNoteAt(repeated, t * d))).toEqual([
      't0',
      't1',
      't2',
    ]);
  });

  it('is silent for an empty performance', () => {
    expect(activeNoteAt({ notes: [], durationSeconds: 0 }, 0)).toBeNull();
  });

  it('agrees with a rebased, slowed performance on the audio clock', () => {
    // From m at 0.5×: m 0-4, b 4-6, pause 6-10, c 10-12 (base notes).
    const slow = performanceAtSpeed(performanceFrom(p, 'mn'), 0.5);
    expect(activeNoteAt(slow, 0)).toBe('mn');
    expect(activeNoteAt(slow, 3.9 * d)).toBe('mn');
    expect(activeNoteAt(slow, 4.01 * d)).toBe('bn');
    expect(activeNoteAt(slow, 6.5 * d)).toBeNull();
    expect(activeNoteAt(slow, 10 * d)).toBe('cn');
  });
});

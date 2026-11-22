import { describe, expect, it } from 'vitest';
import { blankDocument } from '../persistence/native-document';
import {
  accidentalToolbarAllowed,
  documentControlsBlocked,
  entryTargetingAvailable,
  exclusiveModeActive,
  historyButtonAvailable,
  lyricLanguageBlocked,
  noteToolbarAllowed,
  pitchHandlingBlocked,
  pitchHandlingShown,
  wholeNeumeToolbarAllowed,
} from './editor-availability';
import {
  createEditorSession,
  type ClefTransaction,
  type EditorSession,
} from './editor-session';
import { clearSelection } from './selection';

const document = blankDocument();

/** An idle Select session with one undoable step and nothing to redo. */
function session(overrides: Partial<EditorSession> = {}): EditorSession {
  const base = createEditorSession(document);
  return {
    ...base,
    history: { past: [document], present: document, future: [] },
    ...overrides,
  };
}

function clefTransaction(candidate: boolean): ClefTransaction {
  return {
    id: 'clef-change',
    original: document,
    previousSelection: { kind: 'clef-change', clefChangeId: 'clef-change' },
    boundary: null,
    clef: { type: 'c', staffLine: 3 },
    candidate: candidate ? document : null,
  };
}

const modes: Record<string, EditorSession> = {
  idle: session(),
  'placing a neume': session({ activeTool: { kind: 'place-punctum' } }),
  'placing a division': session({
    activeTool: { kind: 'place-division', divisionKind: 'minor' },
  }),
  'placing a clef': session({
    activeTool: { kind: 'place-clef', clefType: 'c' },
  }),
  'clef change selected': session({
    selection: { kind: 'clef-change', clefChangeId: 'clef-change' },
  }),
  'passage selected': session({
    selection: {
      kind: 'neume-range',
      anchorNeumeId: 'a',
      endpointNeumeId: 'b',
    },
  }),
  'clean lyric entry': session({ lyrics: { kind: 'ready', neumeId: 'a' } }),
  'dirty lyric draft': session({
    lyrics: {
      kind: 'draft',
      neumeId: 'a',
      original: null,
      text: 'glo',
      boundaryBefore: 'word',
    },
  }),
  'lyric recovery': session({
    lyrics: {
      kind: 'recovery',
      draft: {
        kind: 'draft',
        neumeId: 'a',
        original: null,
        text: 'glo',
        boundaryBefore: 'word',
      },
    },
  }),
  'lyric move': session({
    lyricMove: {
      syllableId: 's',
      candidateId: 'a',
      previousLyrics: null,
      previousSelection: clearSelection(),
    },
    selection: { kind: 'syllable', syllableId: 's' },
  }),
  'pending history': session({
    lyrics: {
      kind: 'draft',
      neumeId: 'a',
      original: null,
      text: 'glo',
      boundaryBefore: 'word',
    },
    pendingHistory: { direction: 'undo', focusedNoteId: null },
  }),
  'clef draft without candidate': session({
    clefTransaction: clefTransaction(false),
    selection: { kind: 'clef-change', clefChangeId: 'clef-change' },
  }),
  'clef deletion confirmation (candidate)': session({
    clefTransaction: clefTransaction(true),
    selection: { kind: 'clef-change', clefChangeId: 'clef-change' },
  }),
  'accidental placement': session({
    accidentalTargetId: 'sign',
    selection: { kind: 'accidental', accidentalId: 'sign' },
  }),
};

type Rule = (state: EditorSession) => boolean;
const rules: Record<string, Rule> = {
  exclusiveModeActive,
  entryTargetingAvailable,
  lyricLanguageBlocked,
  documentControlsBlocked,
  pitchHandlingShown,
  pitchHandlingBlocked,
  undoButton: (state) => historyButtonAvailable(state, 'undo'),
  noteToolbarAllowed,
  wholeNeumeToolbarAllowed,
  accidentalToolbarAllowed,
};

// Columns follow `rules`. 1 = true, 0 = false.
// prettier-ignore
const expected: Record<keyof typeof modes, readonly (0 | 1)[]> = {
  //                                         excl entry lang doc pShow pBlk undo note whole acc
  idle:                                     [0,   1,    0,   0,  0,    0,   1,   1,   1,    1],
  'placing a neume':                        [0,   1,    0,   0,  0,    0,   1,   0,   0,    0],
  'placing a division':                     [0,   1,    0,   0,  0,    0,   1,   0,   0,    0],
  'placing a clef':                         [0,   1,    0,   0,  1,    0,   1,   0,   0,    0],
  'clef change selected':                   [0,   1,    0,   0,  1,    0,   1,   1,   1,    1],
  'passage selected':                       [0,   0,    0,   0,  0,    0,   1,   1,   1,    1],
  'clean lyric entry':                      [0,   1,    0,   0,  0,    0,   1,   1,   0,    0],
  'dirty lyric draft':                      [0,   1,    0,   1,  0,    0,   1,   1,   0,    0],
  'lyric recovery':                         [0,   1,    0,   1,  0,    0,   1,   1,   0,    0],
  'lyric move':                             [1,   0,    1,   1,  0,    1,   0,   0,   0,    0],
  'pending history':                        [1,   0,    1,   1,  0,    1,   1,   0,   0,    0],
  'clef draft without candidate':           [1,   0,    0,   1,  1,    0,   1,   0,   0,    0],
  'clef deletion confirmation (candidate)': [1,   0,    0,   1,  1,    1,   1,   0,   0,    0],
  'accidental placement':                   [0,   1,    0,   1,  0,    0,   1,   1,   1,    1],
};

describe('presentation availability matrix', () => {
  const ruleEntries = Object.entries(rules);
  it.each(Object.keys(modes))('%s', (mode) => {
    const state = modes[mode];
    const actual = Object.fromEntries(
      ruleEntries.map(([name, rule]) => [name, rule(state) ? 1 : 0]),
    );
    const wanted = Object.fromEntries(
      ruleEntries.map(([name], index) => [name, expected[mode][index]]),
    );
    expect(actual).toEqual(wanted);
  });
});

describe('intentional differences between similar rules', () => {
  it('keeps lyric language enabled during a clef transaction, unlike the settings', () => {
    const state = modes['clef draft without candidate'];
    expect(exclusiveModeActive(state)).toBe(true);
    expect(lyricLanguageBlocked(state)).toBe(false);
  });

  it('keeps Pitch handling enabled for a clef draft until deletion confirmation', () => {
    expect(pitchHandlingBlocked(modes['clef draft without candidate'])).toBe(
      false,
    );
    expect(
      pitchHandlingBlocked(modes['clef deletion confirmation (candidate)']),
    ).toBe(true);
  });

  it('blocks document controls only for dirty lyric work, not clean entry', () => {
    expect(documentControlsBlocked(modes['clean lyric entry'])).toBe(false);
    expect(documentControlsBlocked(modes['dirty lyric draft'])).toBe(true);
    expect(documentControlsBlocked(modes['lyric recovery'])).toBe(true);
  });

  it('blocks document controls, but not settings, during accidental placement', () => {
    const state = modes['accidental placement'];
    expect(documentControlsBlocked(state)).toBe(true);
    expect(exclusiveModeActive(state)).toBe(false);
  });

  it('shows the note toolbar during lyric entry, but not the whole-neume or accidental toolbar', () => {
    const state = modes['clean lyric entry'];
    expect(noteToolbarAllowed(state)).toBe(true);
    expect(wholeNeumeToolbarAllowed(state)).toBe(false);
    expect(accidentalToolbarAllowed(state)).toBe(false);
  });

  it('disables the history buttons only for a lyric move and missing history', () => {
    const empty = session({
      history: { past: [], present: document, future: [] },
    });
    expect(historyButtonAvailable(empty, 'undo')).toBe(false);
    expect(historyButtonAvailable(empty, 'redo')).toBe(false);
    const redoable = session({
      history: { past: [], present: document, future: [document] },
    });
    expect(historyButtonAvailable(redoable, 'redo')).toBe(true);
    expect(
      historyButtonAvailable(
        { ...redoable, lyricMove: modes['lyric move'].lyricMove },
        'redo',
      ),
    ).toBe(false);
    expect(
      historyButtonAvailable(modes['pending history'], 'undo') &&
        historyButtonAvailable(modes['clef draft without candidate'], 'undo'),
    ).toBe(true);
  });
});

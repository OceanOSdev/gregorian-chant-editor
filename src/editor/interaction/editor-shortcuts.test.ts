import { describe, expect, it } from 'vitest';
import {
  getDocumentShortcut,
  getLyricMoveKeyIntent,
  getPendingTransactionCancel,
  type DocumentKeyMode,
  type DocumentKeyScope,
  type EditorKeyEvent,
  type PendingTransactionMode,
} from './editor-shortcuts';

const key = (
  k: string,
  flags: Partial<EditorKeyEvent> = {},
): EditorKeyEvent => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  ...flags,
});

const scoreScope: DocumentKeyScope = {
  editableTarget: false,
  clipboardScope: true,
  nativeTextSelection: false,
  scoreFocused: true,
  notationFocused: true,
};
const paletteScope: DocumentKeyScope = { ...scoreScope, scoreFocused: false };
const panelScope: DocumentKeyScope = {
  ...scoreScope,
  scoreFocused: false,
  notationFocused: false,
};
const outsideScope: DocumentKeyScope = {
  ...panelScope,
  clipboardScope: false,
};
const inputScope: DocumentKeyScope = { ...scoreScope, editableTarget: true };

const idle: DocumentKeyMode = {
  placing: false,
  placingClef: false,
  lyricEntryOpen: false,
  canUndo: true,
  canRedo: true,
};
const placingNeume: DocumentKeyMode = { ...idle, placing: true };
const placingClef: DocumentKeyMode = {
  ...idle,
  placing: true,
  placingClef: true,
};
const lyricEntry: DocumentKeyMode = { ...idle, lyricEntryOpen: true };

const noPending: PendingTransactionMode = {
  accidentalPlacement: false,
  clefTransaction: false,
};

const modifiers = ['ctrlKey', 'metaKey', 'altKey'] as const;

describe('document capture: pending transaction Escape', () => {
  it('cancels accidental placement before a clef transaction', () => {
    expect(
      getPendingTransactionCancel(key('Escape'), {
        accidentalPlacement: true,
        clefTransaction: true,
      }),
    ).toBe('cancel-accidental-placement');
    expect(
      getPendingTransactionCancel(key('Escape'), {
        ...noPending,
        clefTransaction: true,
      }),
    ).toBe('cancel-clef-change');
    expect(getPendingTransactionCancel(key('Escape'), noPending)).toBeNull();
  });

  it('claims Escape even when already handled, held or with Shift', () => {
    const mode = { ...noPending, clefTransaction: true };
    for (const flag of ['defaultPrevented', 'repeat', 'shiftKey'] as const)
      expect(
        getPendingTransactionCancel(key('Escape', { [flag]: true }), mode),
      ).toBe('cancel-clef-change');
  });

  it('leaves composition, Ctrl/Cmd/Alt chords and other keys alone', () => {
    const mode = { accidentalPlacement: true, clefTransaction: true };
    expect(
      getPendingTransactionCancel(key('Escape', { isComposing: true }), mode),
    ).toBeNull();
    for (const flag of modifiers)
      expect(
        getPendingTransactionCancel(key('Escape', { [flag]: true }), mode),
      ).toBeNull();
    for (const other of ['Enter', 'Delete', 'z', 'Esc'])
      expect(getPendingTransactionCancel(key(other), mode)).toBeNull();
  });
});

describe('<main> capture: lyric move keys', () => {
  it('maps Escape, Left/Right and Enter on the score', () => {
    expect(getLyricMoveKeyIntent(key('Escape'), true, false)).toEqual({
      type: 'cancel',
    });
    expect(getLyricMoveKeyIntent(key('ArrowLeft'), true, true)).toEqual({
      type: 'browse',
      direction: -1,
    });
    expect(getLyricMoveKeyIntent(key('ArrowRight'), true, false)).toEqual({
      type: 'browse',
      direction: 1,
    });
    expect(getLyricMoveKeyIntent(key('Enter'), true, true)).toEqual({
      type: 'commit',
    });
  });

  it('keeps Enter native outside the score', () => {
    expect(getLyricMoveKeyIntent(key('Enter'), true, false)).toBeNull();
  });

  it('claims held repeats without dispatching again', () => {
    for (const k of ['Escape', 'ArrowLeft', 'ArrowRight'])
      expect(
        getLyricMoveKeyIntent(key(k, { repeat: true }), true, false),
      ).toEqual({ type: 'held-repeat' });
    expect(
      getLyricMoveKeyIntent(key('Enter', { repeat: true }), true, true),
    ).toEqual({ type: 'held-repeat' });
    expect(
      getLyricMoveKeyIntent(key('Enter', { repeat: true }), true, false),
    ).toBeNull();
  });

  it('accepts Shift but not Ctrl/Cmd/Alt or composition', () => {
    expect(
      getLyricMoveKeyIntent(key('ArrowLeft', { shiftKey: true }), true, true),
    ).toEqual({ type: 'browse', direction: -1 });
    for (const flag of [...modifiers, 'isComposing'] as const)
      expect(
        getLyricMoveKeyIntent(key('Escape', { [flag]: true }), true, true),
      ).toBeNull();
  });

  it('does nothing outside a lyric move or for other keys', () => {
    for (const k of ['Escape', 'ArrowLeft', 'ArrowRight', 'Enter'])
      expect(getLyricMoveKeyIntent(key(k), false, true)).toBeNull();
    for (const k of ['ArrowUp', 'ArrowDown', 'Tab', ' ', 'l', 'Delete'])
      expect(getLyricMoveKeyIntent(key(k), true, true)).toBeNull();
  });
});

describe('document bubble: Escape fallback', () => {
  it.each([
    ['idle', idle, 'clear-selection'],
    ['neume or division placement', placingNeume, 'select-tool'],
    ['clef placement', placingClef, 'select-tool'],
    ['open lyric entry', lyricEntry, 'cancel-lyrics'],
    [
      'lyric entry while placing a neume',
      { ...lyricEntry, placing: true },
      'cancel-lyrics',
    ],
    [
      'lyric entry while placing a clef',
      { ...placingClef, lyricEntryOpen: true },
      'select-tool',
    ],
  ] as const)('in %s', (_name, mode, effect) => {
    expect(getDocumentShortcut(key('Escape'), panelScope, mode)).toEqual({
      type: 'escape',
      effect,
    });
  });

  it('accepts Shift and held repeats, in every scope inside or outside the editor', () => {
    for (const scope of [scoreScope, paletteScope, panelScope, outsideScope])
      expect(
        getDocumentShortcut(
          key('Escape', { shiftKey: true, repeat: true }),
          scope,
          idle,
        ),
      ).toEqual({ type: 'escape', effect: 'clear-selection' });
  });

  it('defers to handled keys, editable targets, composition and chords', () => {
    expect(
      getDocumentShortcut(
        key('Escape', { defaultPrevented: true }),
        scoreScope,
        idle,
      ),
    ).toBeNull();
    expect(
      getDocumentShortcut(
        key('Escape', { isComposing: true }),
        scoreScope,
        idle,
      ),
    ).toBeNull();
    expect(getDocumentShortcut(key('Escape'), inputScope, idle)).toBeNull();
    for (const flag of modifiers)
      expect(
        getDocumentShortcut(key('Escape', { [flag]: true }), scoreScope, idle),
      ).toBeNull();
  });
});

/**
 * A model of the listener order for one Escape that no focused control
 * claimed: document capture, then `<main>` capture, then document bubble.
 * Each earlier owner stops propagation, so the first result wins.
 */
function routeEscape(
  pending: PendingTransactionMode,
  lyricMoveActive: boolean,
  mode: DocumentKeyMode,
  event = key('Escape'),
) {
  return (
    getPendingTransactionCancel(event, pending) ??
    getLyricMoveKeyIntent(event, lyricMoveActive, true) ??
    getDocumentShortcut(event, scoreScope, mode)
  );
}

describe('Escape precedence across editor listeners', () => {
  it('pending transactions win over a lyric move and the fallback', () => {
    expect(
      routeEscape({ ...noPending, clefTransaction: true }, true, lyricEntry),
    ).toBe('cancel-clef-change');
    expect(
      routeEscape(
        { ...noPending, accidentalPlacement: true },
        true,
        placingClef,
      ),
    ).toBe('cancel-accidental-placement');
  });

  it('a lyric move wins over the document fallback', () => {
    expect(routeEscape(noPending, true, lyricEntry)).toEqual({
      type: 'cancel',
    });
  });

  it('only the document fallback sees Escape in ordinary modes', () => {
    expect(routeEscape(noPending, false, idle)).toEqual({
      type: 'escape',
      effect: 'clear-selection',
    });
  });

  it('a composing Escape reaches no editor listener', () => {
    expect(
      routeEscape(
        { accidentalPlacement: true, clefTransaction: true },
        true,
        lyricEntry,
        key('Escape', { isComposing: true }),
      ),
    ).toBeNull();
  });
});

describe('document bubble: clipboard', () => {
  it('copies and pastes with Ctrl or Cmd in clipboard scope', () => {
    for (const flag of ['ctrlKey', 'metaKey'] as const) {
      expect(
        getDocumentShortcut(key('c', { [flag]: true }), panelScope, idle),
      ).toEqual({ type: 'copy' });
      expect(
        getDocumentShortcut(key('V', { [flag]: true }), panelScope, idle),
      ).toEqual({ type: 'paste' });
    }
  });

  it('claims held repeats once', () => {
    expect(
      getDocumentShortcut(
        key('v', { ctrlKey: true, repeat: true }),
        scoreScope,
        idle,
      ),
    ).toEqual({ type: 'held-repeat' });
  });

  it('keeps native copy for a text selection, but still pastes', () => {
    const selected = { ...scoreScope, nativeTextSelection: true };
    expect(
      getDocumentShortcut(key('c', { ctrlKey: true }), selected, idle),
    ).toBeNull();
    expect(
      getDocumentShortcut(key('v', { ctrlKey: true }), selected, idle),
    ).toEqual({ type: 'paste' });
  });

  it('keeps native clipboard outside the editor, in inputs and for extra modifiers', () => {
    expect(
      getDocumentShortcut(key('c', { ctrlKey: true }), outsideScope, idle),
    ).toBeNull();
    expect(
      getDocumentShortcut(key('v', { ctrlKey: true }), inputScope, idle),
    ).toBeNull();
    for (const flag of [
      'altKey',
      'shiftKey',
      'isComposing',
      'defaultPrevented',
    ] as const)
      expect(
        getDocumentShortcut(
          key('c', { ctrlKey: true, [flag]: true }),
          scoreScope,
          idle,
        ),
      ).toBeNull();
  });

  it('is classified in every exclusive mode; the reducer decides availability', () => {
    for (const mode of [placingNeume, placingClef, lyricEntry])
      expect(
        getDocumentShortcut(key('c', { metaKey: true }), scoreScope, mode),
      ).toEqual({ type: 'copy' });
  });
});

describe('document bubble: L, I and T', () => {
  it('starts lyrics from unmodified L on the score only, outside placement', () => {
    expect(getDocumentShortcut(key('L'), scoreScope, idle)).toEqual({
      type: 'start-lyrics',
    });
    expect(getDocumentShortcut(key('l'), scoreScope, lyricEntry)).toEqual({
      type: 'start-lyrics',
    });
    expect(getDocumentShortcut(key('l'), paletteScope, idle)).toBeNull();
    expect(getDocumentShortcut(key('l'), scoreScope, placingNeume)).toBeNull();
    for (const flag of [...modifiers, 'shiftKey', 'repeat'] as const)
      expect(
        getDocumentShortcut(key('l', { [flag]: true }), scoreScope, idle),
      ).toBeNull();
  });

  it('routes I and T in notation scope, including while placing', () => {
    for (const scope of [scoreScope, paletteScope])
      for (const mode of [idle, placingNeume]) {
        expect(getDocumentShortcut(key('i'), scope, mode)).toEqual({
          type: 'insert',
        });
        expect(getDocumentShortcut(key('T'), scope, mode)).toEqual({
          type: 'focus-palette',
        });
      }
  });

  it('keeps I and T inactive outside notation scope and for repeats or modifiers', () => {
    expect(getDocumentShortcut(key('i'), panelScope, idle)).toBeNull();
    expect(getDocumentShortcut(key('t'), outsideScope, idle)).toBeNull();
    for (const flag of [...modifiers, 'shiftKey', 'repeat'] as const)
      expect(
        getDocumentShortcut(key('i', { [flag]: true }), scoreScope, idle),
      ).toBeNull();
  });

  it('defers to editable targets, composition and handled keys', () => {
    expect(getDocumentShortcut(key('i'), inputScope, idle)).toBeNull();
    expect(
      getDocumentShortcut(key('l', { isComposing: true }), scoreScope, idle),
    ).toBeNull();
    expect(
      getDocumentShortcut(
        key('t', { defaultPrevented: true }),
        scoreScope,
        idle,
      ),
    ).toBeNull();
  });
});

describe('document bubble: Undo and Redo', () => {
  it('undoes with Ctrl/Cmd+Z, repeating while held, anywhere', () => {
    for (const flag of ['ctrlKey', 'metaKey'] as const)
      for (const scope of [scoreScope, outsideScope])
        expect(
          getDocumentShortcut(
            key('Z', { [flag]: true, repeat: true }),
            scope,
            idle,
          ),
        ).toEqual({ type: 'undo' });
  });

  it('redoes with Ctrl/Cmd+Shift+Z or Ctrl+Y, but not Cmd+Y', () => {
    expect(
      getDocumentShortcut(
        key('z', { metaKey: true, shiftKey: true }),
        scoreScope,
        idle,
      ),
    ).toEqual({ type: 'redo' });
    expect(
      getDocumentShortcut(key('y', { ctrlKey: true }), scoreScope, idle),
    ).toEqual({ type: 'redo' });
    expect(
      getDocumentShortcut(key('y', { metaKey: true }), scoreScope, idle),
    ).toBeNull();
  });

  it('accepts Alt with the command key, as before', () => {
    expect(
      getDocumentShortcut(
        key('z', { ctrlKey: true, altKey: true }),
        scoreScope,
        idle,
      ),
    ).toEqual({ type: 'undo' });
  });

  it('leaves the key to the browser when history is empty', () => {
    const empty = { ...idle, canUndo: false, canRedo: false };
    expect(
      getDocumentShortcut(key('z', { ctrlKey: true }), scoreScope, empty),
    ).toBeNull();
    expect(
      getDocumentShortcut(key('y', { ctrlKey: true }), scoreScope, empty),
    ).toBeNull();
    expect(
      getDocumentShortcut(key('z', { ctrlKey: true }), scoreScope, {
        ...empty,
        canRedo: true,
      }),
    ).toBeNull();
  });

  it('keeps native undo in inputs and during composition', () => {
    expect(
      getDocumentShortcut(key('z', { ctrlKey: true }), inputScope, idle),
    ).toBeNull();
    expect(
      getDocumentShortcut(
        key('z', { ctrlKey: true, isComposing: true }),
        scoreScope,
        idle,
      ),
    ).toBeNull();
  });
});

describe('document bubble: unclaimed keys', () => {
  it('ignores keys owned by score controls or native behaviour', () => {
    for (const k of [
      'Enter',
      ' ',
      'Delete',
      'ArrowUp',
      'ArrowLeft',
      'Tab',
      'a',
    ])
      expect(getDocumentShortcut(key(k), scoreScope, idle)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { updateAccidental } from '../commands/update-accidental';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import { blankDocument } from '../persistence/native-document';
import { projectSelectedNoteAccidental } from './selected-note-accidental';

function note(id: string, position: number) {
  return { id, staffPosition: staffPosition(position) };
}
function punctum(id: string, position: number): Neume {
  return { id, kind: 'punctum', notes: [note(id + 'n', position)] };
}
/** C clef on line 4: position 5 is B, position 2 is F. One word. */
function specimen(): ChantDocument {
  return {
    ...blankDocument(),
    clef: { type: 'c', staffLine: 4 },
    neumes: [
      punctum('f', 2),
      punctum('b', 5),
      punctum('next', 5),
      { id: 'pair', kind: 'bistropha', notes: [note('b1', 5), note('b2', 5)] },
    ],
    syllables: [
      { id: 'word', text: 'o', startsAtNeumeId: 'f', boundaryBefore: 'word' },
    ],
  };
}

describe('projectSelectedNoteAccidental', () => {
  it('projects nothing for a note that is not a B', () => {
    expect(projectSelectedNoteAccidental(specimen(), 'fn')).toBeNull();
  });

  it('projects nothing for an unknown note', () => {
    expect(projectSelectedNoteAccidental(specimen(), 'missing')).toBeNull();
  });

  it('reports a default natural B with no written sign', () => {
    expect(projectSelectedNoteAccidental(specimen(), 'bn')).toEqual({
      writtenKind: undefined,
      effectiveB: 'natural',
      source: 'default',
      description: 'Effective B-natural (default).',
    });
  });

  it('reports a sign written on the selected B', () => {
    const document = updateAccidental(specimen(), 'bn', 'flat', 'flat');
    expect(projectSelectedNoteAccidental(document, 'bn')).toEqual({
      writtenKind: 'flat',
      effectiveB: 'flat',
      source: 'written',
      description: 'Effective B-flat (written).',
    });
  });

  it('distinguishes an inherited effective flat from the absent written sign', () => {
    const document = updateAccidental(specimen(), 'bn', 'flat', 'flat');
    expect(projectSelectedNoteAccidental(document, 'nextn')).toEqual({
      writtenKind: undefined,
      effectiveB: 'flat',
      source: 'inherited',
      description: 'Effective B-flat (inherited).',
    });
  });

  it('reports a written natural that cancels an earlier flat', () => {
    const flat = updateAccidental(specimen(), 'bn', 'flat', 'flat');
    const document = updateAccidental(flat, 'nextn', 'natural', 'natural');
    expect(projectSelectedNoteAccidental(document, 'nextn')).toEqual({
      writtenKind: 'natural',
      effectiveB: 'natural',
      source: 'written',
      description: 'Effective B-natural (written).',
    });
  });

  it("treats a later B in the same neume as written by the neume's owning B", () => {
    const document = updateAccidental(specimen(), 'b1', 'flat', 'flat');
    expect(projectSelectedNoteAccidental(document, 'b2')).toMatchObject({
      writtenKind: 'flat',
      effectiveB: 'flat',
      source: 'written',
    });
  });
});

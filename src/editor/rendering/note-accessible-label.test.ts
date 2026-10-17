import { describe, expect, it } from 'vitest';
import {
  getNoteAccessibleLabel,
  getSelectedNeumeDescription,
  wholeNeumeSelectionInstruction,
} from './note-accessible-label';

describe('getNoteAccessibleLabel', () => {
  it.each([
    { kind: 'punctum' as const, noteIndex: 0, label: 'Select punctum' },
    {
      kind: 'climacus' as const,
      noteIndex: 0,
      label: 'Select highest note of climacus',
    },
    {
      kind: 'climacus' as const,
      noteIndex: 1,
      label: 'Select middle note of climacus',
    },
    {
      kind: 'climacus' as const,
      noteIndex: 2,
      label: 'Select lowest note of climacus',
    },
    {
      kind: 'porrectus' as const,
      noteIndex: 0,
      label: 'Select first note of porrectus',
    },
    {
      kind: 'porrectus' as const,
      noteIndex: 1,
      label: 'Select second note of porrectus',
    },
    {
      kind: 'porrectus' as const,
      noteIndex: 2,
      label: 'Select third note of porrectus',
    },
    {
      kind: 'podatus' as const,
      noteIndex: 0,
      label: 'Select lower note of podatus',
    },
    {
      kind: 'podatus' as const,
      noteIndex: 1,
      label: 'Select upper note of podatus',
    },
    {
      kind: 'clivis' as const,
      noteIndex: 0,
      label: 'Select upper note of clivis',
    },
    {
      kind: 'clivis' as const,
      noteIndex: 1,
      label: 'Select lower note of clivis',
    },
    {
      kind: 'scandicus' as const,
      noteIndex: 0,
      label: 'Select lowest note of scandicus',
    },
    {
      kind: 'scandicus' as const,
      noteIndex: 1,
      label: 'Select middle note of scandicus',
    },
    {
      kind: 'scandicus' as const,
      noteIndex: 2,
      label: 'Select highest note of scandicus',
    },
    {
      kind: 'torculus' as const,
      noteIndex: 0,
      label: 'Select first note of torculus',
    },
    {
      kind: 'torculus' as const,
      noteIndex: 1,
      label: 'Select second note of torculus',
    },
    {
      kind: 'torculus' as const,
      noteIndex: 2,
      label: 'Select third note of torculus',
    },
  ])('labels $kind note $noteIndex', ({ kind, noteIndex, label }) => {
    expect(getNoteAccessibleLabel(kind, noteIndex)).toBe(label);
  });

  it('provides a concise whole-neume keyboard instruction', () => {
    expect(wholeNeumeSelectionInstruction).toBe(
      'Shift plus Enter or Space selects the whole neume.',
    );
  });

  it.each([
    {
      kind: 'punctum' as const,
      description:
        'Whole punctum selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
    {
      kind: 'podatus' as const,
      description:
        'Whole podatus selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
    {
      kind: 'clivis' as const,
      description:
        'Whole clivis selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
    {
      kind: 'scandicus' as const,
      description:
        'Whole scandicus selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
    {
      kind: 'torculus' as const,
      description:
        'Whole torculus selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
    {
      kind: 'climacus' as const,
      description:
        'Whole climacus selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
    {
      kind: 'porrectus' as const,
      description:
        'Whole porrectus selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
  ])('describes selected $kind state', ({ kind, description }) => {
    expect(getSelectedNeumeDescription(kind, true)).toBe(description);
  });

  it('omits selected-neume status for an unrelated constituent', () => {
    expect(getSelectedNeumeDescription('podatus', false)).toBeNull();
  });
});

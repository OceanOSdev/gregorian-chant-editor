import { describe, expect, it } from 'vitest';
import {
  familyActiveKind,
  familyPrimaryTool,
  familyRememberedKind,
  isFamilyPrimaryPressed,
  isPaletteButtonPressed,
  paletteButtonCommand,
  paletteButtonLabel,
  paletteControls,
} from './notation-palette-tools';
import type { EditorTool } from '../state/editor-tool';

describe('paletteControls', () => {
  it('renders each split control once, in palette order', () => {
    expect(
      paletteControls.map((control) =>
        control.kind === 'button'
          ? control.tool
          : control.kind === 'neume-family'
            ? `${control.family} family`
            : 'division family',
      ),
    ).toEqual([
      'select',
      'punctum family',
      'virga',
      'inclinatum',
      'quilisma',
      'podatus family',
      'clivis family',
      'scandicus family',
      'torculus family',
      'climacus family',
      'porrectus family',
      'c-clef',
      'f-clef',
      'division family',
    ]);
  });
});

describe('plain palette buttons', () => {
  it('keeps the existing visible labels', () => {
    expect(
      (
        [
          'select',
          'virga',
          'inclinatum',
          'quilisma',
          'c-clef',
          'f-clef',
        ] as const
      ).map(paletteButtonLabel),
    ).toEqual([
      'Select',
      'Virga',
      'Punctum inclinatum',
      'Quilisma',
      'C clef',
      'F clef',
    ]);
  });

  it('maps activation to the existing session commands', () => {
    expect(paletteButtonCommand('select', 'podatus')).toEqual({
      type: 'select-tool',
    });
    expect(paletteButtonCommand('f-clef', 'podatus')).toEqual({
      type: 'arm',
      tool: { kind: 'place-clef', clefType: 'f' },
    });
    expect(paletteButtonCommand('virga', 'podatus')).toEqual({
      type: 'arm',
      tool: { kind: 'place-punctum', form: 'virga' },
    });
    expect(paletteButtonCommand('quilisma', 'podatus')).toEqual({
      type: 'arm',
      tool: { kind: 'place-podatus', form: 'quilisma' },
    });
    expect(paletteButtonCommand('quilisma', 'scandicus')).toEqual({
      type: 'arm',
      tool: { kind: 'place-scandicus', form: 'quilisma' },
    });
  });

  it('presses exactly the button matching the armed tool', () => {
    const pressed = (activeTool: EditorTool) =>
      (
        [
          'select',
          'virga',
          'inclinatum',
          'quilisma',
          'c-clef',
          'f-clef',
        ] as const
      ).filter((tool) => isPaletteButtonPressed(tool, activeTool));
    expect(pressed({ kind: 'select' })).toEqual(['select']);
    expect(pressed({ kind: 'place-clef', clefType: 'c' })).toEqual(['c-clef']);
    expect(pressed({ kind: 'place-punctum', form: 'inclinatum' })).toEqual([
      'inclinatum',
    ]);
    expect(pressed({ kind: 'place-scandicus', form: 'quilisma' })).toEqual([
      'quilisma',
    ]);
    expect(pressed({ kind: 'place-clivis' })).toEqual([]);
  });
});

describe('split family controls', () => {
  it('arms the ordinary member from the primary button', () => {
    expect(familyPrimaryTool('climacus')).toEqual({ kind: 'place-climacus' });
    expect(familyPrimaryTool('minima')).toEqual({
      kind: 'place-division',
      divisionKind: 'minima',
    });
  });

  it('presses the primary only for the ordinary form', () => {
    expect(isFamilyPrimaryPressed('podatus', { kind: 'place-podatus' })).toBe(
      true,
    );
    expect(
      isFamilyPrimaryPressed('podatus', {
        kind: 'place-podatus',
        form: 'quilisma',
      }),
    ).toBe(false);
    expect(isFamilyPrimaryPressed('podatus', { kind: 'place-epiphonus' })).toBe(
      false,
    );
    expect(
      isFamilyPrimaryPressed('minima', {
        kind: 'place-division',
        divisionKind: 'minor',
      }),
    ).toBe(false);
  });

  it('marks the armed family member active, but not a quilisma form', () => {
    expect(familyActiveKind('podatus', { kind: 'place-podatus' })).toBe(
      'podatus',
    );
    expect(familyActiveKind('podatus', { kind: 'place-epiphonus' })).toBe(
      'epiphonus',
    );
    expect(
      familyActiveKind('podatus', { kind: 'place-podatus', form: 'quilisma' }),
    ).toBeNull();
    expect(familyActiveKind('clivis', { kind: 'place-podatus' })).toBeNull();
    expect(familyActiveKind('clivis', { kind: 'select' })).toBeNull();
  });

  it('shows a remembered variant only within its own family', () => {
    expect(familyRememberedKind('scandicus', 'scandicus-5')).toBe(
      'scandicus-5',
    );
    expect(familyRememberedKind('scandicus', 'climacus-4')).toBe('scandicus');
    expect(familyRememberedKind('punctum', 'punctum')).toBe('punctum');
  });
});

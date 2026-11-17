import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind';
import {
  paletteTools,
  type PaletteTool,
} from '../interaction/palette-navigation';
import { noteFormLabels } from '../domain/note-forms';
import type { GraphicalNeumeKind } from '../neume-entry-pitches';
import {
  isPlacementTool,
  neumeFamilyMembers,
  placeEntryTool,
  toolNoteForm,
  type EditorTool,
  type NeumeFamily,
} from '../state/editor-tool';

/**
 * Pure presentation model of the notation palette: which control each palette
 * stop belongs to, its label, its pressed state and the tool it arms. The
 * session reducer remains the authority for what arming actually does.
 */

export type QuilismaFigure = 'podatus' | 'scandicus';
/** Primary (ordinary-member) button of a split family control. */
export type FamilyPrimaryTool = NeumeFamily | 'minima';
/** Chevron button of a split family control. */
export type FamilyMenuTool = `${NeumeFamily}-menu` | 'division-menu';
/** A palette stop that is a plain button rather than part of a split control. */
export type ButtonPaletteTool = Exclude<
  PaletteTool,
  FamilyPrimaryTool | FamilyMenuTool
>;

export type PaletteControl =
  | { kind: 'button'; tool: ButtonPaletteTool }
  | { kind: 'neume-family'; family: NeumeFamily }
  | { kind: 'division-family' };

/** What activating a plain palette button asks the session to do. */
export type PaletteButtonCommand =
  { type: 'select-tool' } | { type: 'arm'; tool: EditorTool };

function isNeumeFamily(tool: PaletteTool): tool is NeumeFamily {
  return tool in neumeFamilyMembers;
}

function isFamilyMenuTool(tool: PaletteTool): tool is FamilyMenuTool {
  return tool.endsWith('-menu');
}

/**
 * Rendered controls in palette order. Each split control owns two roving stops
 * (primary then chevron); `paletteTools` stays the single source of order.
 */
export const paletteControls: readonly PaletteControl[] = paletteTools.flatMap(
  (tool): PaletteControl[] =>
    isFamilyMenuTool(tool)
      ? []
      : tool === 'minima'
        ? [{ kind: 'division-family' }]
        : isNeumeFamily(tool)
          ? [{ kind: 'neume-family', family: tool }]
          : [{ kind: 'button', tool }],
);

export function paletteButtonLabel(tool: ButtonPaletteTool): string {
  switch (tool) {
    case 'select':
      return 'Select';
    case 'c-clef':
      return 'C clef';
    case 'f-clef':
      return 'F clef';
    default:
      return noteFormLabels[tool];
  }
}

export function quilismaFigureTool(figure: QuilismaFigure): EditorTool {
  return {
    kind: figure === 'podatus' ? 'place-podatus' : 'place-scandicus',
    form: 'quilisma',
  };
}

export function paletteButtonCommand(
  tool: ButtonPaletteTool,
  quilismaFigure: QuilismaFigure,
): PaletteButtonCommand {
  switch (tool) {
    case 'select':
      return { type: 'select-tool' };
    case 'c-clef':
    case 'f-clef':
      return {
        type: 'arm',
        tool: { kind: 'place-clef', clefType: tool === 'c-clef' ? 'c' : 'f' },
      };
    case 'quilisma':
      return { type: 'arm', tool: quilismaFigureTool(quilismaFigure) };
    default:
      return { type: 'arm', tool: { kind: 'place-punctum', form: tool } };
  }
}

export function isPaletteButtonPressed(
  tool: ButtonPaletteTool,
  activeTool: EditorTool,
): boolean {
  switch (tool) {
    case 'select':
      return !isPlacementTool(activeTool);
    case 'c-clef':
    case 'f-clef':
      return (
        activeTool.kind === 'place-clef' && activeTool.clefType === tool[0]
      );
    default:
      return toolNoteForm(activeTool) === tool;
  }
}

/** The tool a family's primary button arms: always the ordinary member. */
export function familyPrimaryTool(family: FamilyPrimaryTool): EditorTool {
  return family === 'minima'
    ? { kind: 'place-division', divisionKind: 'minima' }
    : placeEntryTool(family);
}

export function isFamilyPrimaryPressed(
  family: FamilyPrimaryTool,
  activeTool: EditorTool,
): boolean {
  return family === 'minima'
    ? activeTool.kind === 'place-division' &&
        activeTool.divisionKind === 'minima'
    : getGraphicalNeumeKind(activeTool) === family && !toolNoteForm(activeTool);
}

function isFamilyMember(family: NeumeFamily, kind: GraphicalNeumeKind) {
  return (neumeFamilyMembers[family] as readonly string[]).includes(kind);
}

/** The family member the armed tool places, marked active in its menu. */
export function familyActiveKind(
  family: NeumeFamily,
  activeTool: EditorTool,
): GraphicalNeumeKind | null {
  const kind = getGraphicalNeumeKind(activeTool);
  if (kind === family) return toolNoteForm(activeTool) ? null : family;
  return kind && isFamilyMember(family, kind) ? kind : null;
}

/** A family shows the session's remembered variant, else its ordinary member. */
export function familyRememberedKind(
  family: NeumeFamily,
  rememberedKind: GraphicalNeumeKind,
): GraphicalNeumeKind {
  return rememberedKind !== family && isFamilyMember(family, rememberedKind)
    ? rememberedKind
    : family;
}

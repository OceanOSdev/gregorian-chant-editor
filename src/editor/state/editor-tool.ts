import type { DivisionKind, Clef, NoteForm } from '../domain/chant-document';
import {
  createNeumeEntryPitches,
  type GraphicalNeumeKind,
} from '../neume-entry-pitches';
import { staffPosition } from '../domain/chant-document';
export type EditorTool =
  | { kind: 'place-clef'; clefType: Clef['type'] }
  | { kind: 'place-division'; divisionKind: DivisionKind }
  | { kind: 'select' }
  | { kind: 'place-punctum'; form?: 'virga' | 'inclinatum' }
  | { kind: 'place-podatus'; form?: 'quilisma' }
  | { kind: 'place-pes-subbipunctis' }
  | { kind: 'place-pes-subtripunctis' }
  | { kind: 'place-bistropha' }
  | { kind: 'place-tristropha' }
  | { kind: 'place-clivis' }
  | { kind: 'place-scandicus'; form?: 'quilisma' }
  | { kind: 'place-torculus' }
  | { kind: 'place-climacus' }
  | { kind: 'place-porrectus' };

/** Split-control families: the ordinary member first, then exact variants. */
export const punctumFamily = ['punctum', 'bistropha', 'tristropha'] as const;
export type PunctumFamilyKind = (typeof punctumFamily)[number];
export const podatusFamily = [
  'podatus',
  'pes-subbipunctis',
  'pes-subtripunctis',
] as const;
export type PodatusFamilyKind = (typeof podatusFamily)[number];

export function selectTool(): EditorTool {
  return { kind: 'select' };
}

export function placePunctumTool(): EditorTool {
  return { kind: 'place-punctum' };
}

export function placePodatusTool(): EditorTool {
  return { kind: 'place-podatus' };
}

export function placeClivisTool(): EditorTool {
  return { kind: 'place-clivis' };
}

export function placeScandicusTool(): EditorTool {
  return { kind: 'place-scandicus' };
}

export function placeTorculusTool(): EditorTool {
  return { kind: 'place-torculus' };
}

export function placeClimacusTool(): EditorTool {
  return { kind: 'place-climacus' };
}

export function placePorrectusTool(): EditorTool {
  return { kind: 'place-porrectus' };
}

export function isPlacementTool(tool: EditorTool): boolean {
  return (
    tool.kind === 'place-clef' ||
    tool.kind === 'place-division' ||
    tool.kind === 'place-pes-subbipunctis' ||
    tool.kind === 'place-pes-subtripunctis' ||
    tool.kind === 'place-bistropha' ||
    tool.kind === 'place-tristropha' ||
    tool.kind === 'place-punctum' ||
    tool.kind === 'place-podatus' ||
    tool.kind === 'place-clivis' ||
    tool.kind === 'place-scandicus' ||
    tool.kind === 'place-torculus' ||
    tool.kind === 'place-climacus' ||
    tool.kind === 'place-porrectus'
  );
}

/** The exact number of notes an entry variant creates. */
export function entryNoteCount(kind: GraphicalNeumeKind): number {
  return createNeumeEntryPitches(kind, staffPosition(0)).staffPositions.length;
}

/** Appearance for the existing melodic placement contour, shared by ghosts/commit. */
export function entryAppearance(kind: GraphicalNeumeKind, form?: NoteForm) {
  return Array.from({ length: entryNoteCount(kind) }, (_, index) =>
    form && index === (kind === 'scandicus' ? 1 : 0) ? { form } : {},
  );
}
export function toolNoteForm(tool: EditorTool): NoteForm | undefined {
  return 'form' in tool ? tool.form : undefined;
}

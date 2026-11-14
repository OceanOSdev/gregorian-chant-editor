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
  | { kind: 'place-scandicus-4' }
  | { kind: 'place-scandicus-5' }
  | { kind: 'place-torculus' }
  | { kind: 'place-climacus' }
  | { kind: 'place-climacus-4' }
  | { kind: 'place-climacus-5' }
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
export const scandicusFamily = [
  'scandicus',
  'scandicus-4',
  'scandicus-5',
] as const;
export type ScandicusFamilyKind = (typeof scandicusFamily)[number];
export const climacusFamily = ['climacus', 'climacus-4', 'climacus-5'] as const;
export type ClimacusFamilyKind = (typeof climacusFamily)[number];

export function isPunctumFamilyKind(
  kind: GraphicalNeumeKind,
): kind is PunctumFamilyKind {
  return kind === 'punctum' || kind === 'bistropha' || kind === 'tristropha';
}

/** The ordinary (default-form) placement tool for an exact entry variant. */
export function placeEntryTool(kind: GraphicalNeumeKind): EditorTool {
  return { kind: `place-${kind}` };
}

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
    tool.kind === 'place-scandicus-4' ||
    tool.kind === 'place-scandicus-5' ||
    tool.kind === 'place-torculus' ||
    tool.kind === 'place-climacus' ||
    tool.kind === 'place-climacus-4' ||
    tool.kind === 'place-climacus-5' ||
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

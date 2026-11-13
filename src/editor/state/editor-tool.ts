import type {
  DivisionKind,
  Clef,
  NoteForm,
  Neume,
} from '../domain/chant-document';
export type EditorTool =
  | { kind: 'place-clef'; clefType: Clef['type'] }
  | { kind: 'place-division'; divisionKind: DivisionKind }
  | { kind: 'select' }
  | { kind: 'place-punctum'; form?: 'virga' | 'inclinatum' }
  | { kind: 'place-podatus'; form?: 'quilisma' }
  | { kind: 'place-bistropha' }
  | { kind: 'place-tristropha' }
  | { kind: 'place-clivis' }
  | { kind: 'place-scandicus'; form?: 'quilisma' }
  | { kind: 'place-torculus' }
  | { kind: 'place-climacus' }
  | { kind: 'place-porrectus' };

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

/** Appearance for the existing melodic placement contour, shared by ghosts/commit. */
export function entryAppearance(kind: Neume['kind'], form?: NoteForm) {
  return Array.from(
    {
      length:
        kind === 'punctum'
          ? 1
          : kind === 'podatus' || kind === 'clivis' || kind === 'bistropha'
            ? 2
            : 3,
    },
    (_, index) =>
      form && index === (kind === 'scandicus' ? 1 : 0) ? { form } : {},
  );
}
export function toolNoteForm(tool: EditorTool): NoteForm | undefined {
  return 'form' in tool ? tool.form : undefined;
}

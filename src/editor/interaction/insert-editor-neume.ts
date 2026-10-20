import { insertClimacus } from '../commands/insert-climacus';
import { insertClivis } from '../commands/insert-clivis';
import { insertPodatus } from '../commands/insert-podatus';
import { insertPorrectus } from '../commands/insert-porrectus';
import { insertPunctum } from '../commands/insert-punctum';
import { insertScandicus } from '../commands/insert-scandicus';
import { insertTorculus } from '../commands/insert-torculus';
import { resolveToolbarNeumeInsertion } from '../commands/resolve-toolbar-neume-insertion';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import type { GraphicalNeumeKind } from '../layout/layout-chant';
import type { ResolvedGraphicalNeumePlacement } from './resolve-graphical-neume-placement';

export interface InsertionIds {
  neumeId: string;
  noteIds: readonly [string, string, string];
}

type Insertion = {
  [K in GraphicalNeumeKind]: Pick<
    Extract<ResolvedGraphicalNeumePlacement, { kind: K }>,
    'kind' | 'staffPositions' | 'insertionIndex'
  >;
}[GraphicalNeumeKind];

/** Browser-allocated IDs enter once; this bridge is safe to replay in a reducer. */
export function insertEditorNeume(
  document: ChantDocument,
  syllableId: string,
  insertion: Insertion,
  ids: InsertionIds,
): ChantDocument {
  const base = { id: ids.neumeId, lyricSyllableId: syllableId };
  const note = (index: 0 | 1 | 2, position: number) => ({
    id: ids.noteIds[index],
    staffPosition: staffPosition(position),
  });
  const at = insertion.insertionIndex;
  switch (insertion.kind) {
    case 'punctum':
      return insertPunctum(
        document,
        {
          ...base,
          kind: 'punctum',
          notes: [note(0, insertion.staffPositions[0])],
        },
        at,
      );
    case 'podatus':
      return insertPodatus(
        document,
        {
          ...base,
          kind: 'podatus',
          notes: [
            note(0, insertion.staffPositions[0]),
            note(1, insertion.staffPositions[1]),
          ],
        },
        at,
      );
    case 'clivis':
      return insertClivis(
        document,
        {
          ...base,
          kind: 'clivis',
          notes: [
            note(0, insertion.staffPositions[0]),
            note(1, insertion.staffPositions[1]),
          ],
        },
        at,
      );
    case 'scandicus':
      return insertScandicus(
        document,
        {
          ...base,
          kind: 'scandicus',
          notes: [
            note(0, insertion.staffPositions[0]),
            note(1, insertion.staffPositions[1]),
            note(2, insertion.staffPositions[2]),
          ],
        },
        at,
      );
    case 'torculus':
      return insertTorculus(
        document,
        {
          ...base,
          kind: 'torculus',
          notes: [
            note(0, insertion.staffPositions[0]),
            note(1, insertion.staffPositions[1]),
            note(2, insertion.staffPositions[2]),
          ],
        },
        at,
      );
    case 'climacus':
      return insertClimacus(
        document,
        {
          ...base,
          kind: 'climacus',
          notes: [
            note(0, insertion.staffPositions[0]),
            note(1, insertion.staffPositions[1]),
            note(2, insertion.staffPositions[2]),
          ],
        },
        at,
      );
    case 'porrectus':
      return insertPorrectus(
        document,
        {
          ...base,
          kind: 'porrectus',
          notes: [
            note(0, insertion.staffPositions[0]),
            note(1, insertion.staffPositions[1]),
            note(2, insertion.staffPositions[2]),
          ],
        },
        at,
      );
  }
}

/** Preserve the existing toolbar fallback pitches, contours, and note-only anchor. */
export function resolveEditorToolbarInsertion(
  document: ChantDocument,
  syllableId: string,
  selectedNoteId: string | null,
  kind: GraphicalNeumeKind,
): Insertion | null {
  const fallback =
    kind === 'clivis' || kind === 'climacus' || kind === 'porrectus' ? 3 : 2;
  const boundary = resolveToolbarNeumeInsertion(
    document,
    syllableId,
    selectedNoteId,
    staffPosition(fallback),
  );
  if (!boundary) return null;
  const p = boundary.referenceStaffPosition;
  const insertionIndex = boundary.insertionIndex;
  switch (kind) {
    case 'punctum':
      return { kind, insertionIndex, staffPositions: [p] };
    case 'podatus':
      return {
        kind,
        insertionIndex,
        staffPositions: [p, staffPosition(p + 1)],
      };
    case 'clivis':
      return {
        kind,
        insertionIndex,
        staffPositions: [p, staffPosition(p - 1)],
      };
    case 'scandicus':
      return {
        kind,
        insertionIndex,
        staffPositions: [p, staffPosition(p + 1), staffPosition(p + 2)],
      };
    case 'torculus':
      return {
        kind,
        insertionIndex,
        staffPositions: [p, staffPosition(p + 2), staffPosition(p + 1)],
      };
    case 'climacus':
      return {
        kind,
        insertionIndex,
        staffPositions: [p, staffPosition(p - 1), staffPosition(p - 2)],
      };
    case 'porrectus':
      return {
        kind,
        insertionIndex,
        staffPositions: [p, staffPosition(p - 2), staffPosition(p - 1)],
      };
  }
}

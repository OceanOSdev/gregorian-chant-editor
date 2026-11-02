import type { EditorSelection } from '../state/selection';
import { insertClimacus } from '../commands/insert-climacus';
import { insertClivis } from '../commands/insert-clivis';
import { insertPodatus } from '../commands/insert-podatus';
import { insertPorrectus } from '../commands/insert-porrectus';
import { insertPunctum } from '../commands/insert-punctum';
import { insertScandicus } from '../commands/insert-scandicus';
import { insertTorculus } from '../commands/insert-torculus';
import { resolveToolbarNeumeInsertion } from '../commands/resolve-toolbar-neume-insertion';
import {
  staffPosition,
  type ScoreInsertionBoundary,
  type ChantDocument,
} from '../domain/chant-document';
import type { GraphicalNeumeKind } from '../layout/layout-chant';
import type { ResolvedGraphicalNeumePlacement } from './resolve-graphical-neume-placement';

export interface InsertionIds {
  neumeId: string;
  noteIds: readonly [string, string, string];
}

type Insertion = {
  [K in GraphicalNeumeKind]: Pick<
    Extract<ResolvedGraphicalNeumePlacement, { kind: K }>,
    'kind' | 'staffPositions' | 'insertionIndex' | 'boundary'
  >;
}[GraphicalNeumeKind];

/** Browser-allocated IDs enter once; this bridge is safe to replay in a reducer. */
export function insertEditorNeume(
  document: ChantDocument,
  insertion: Insertion,
  ids: InsertionIds,
): ChantDocument {
  const base = { id: ids.neumeId };
  const note = (index: 0 | 1 | 2, position: number) => ({
    id: ids.noteIds[index],
    staffPosition: staffPosition(position),
  });
  const at = insertion.boundary;
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

/** Resolve toolbar pitches and contours from a musical selection. */
export function resolveEditorToolbarInsertion(
  document: ChantDocument,
  selection: EditorSelection,
  kind: GraphicalNeumeKind,
  explicitBoundary?: ScoreInsertionBoundary,
): Insertion | null {
  const fallback =
    kind === 'clivis' || kind === 'climacus' || kind === 'porrectus' ? 3 : 2;
  const boundary = resolveToolbarNeumeInsertion(
    document,
    selection,
    staffPosition(fallback),
  );
  if (!boundary) return null;
  const p = boundary.referenceStaffPosition;
  const insertionIndex = boundary.insertionIndex;
  const beforeNeumeId = document.neumes[insertionIndex]?.id ?? null;
  // Contextual I inserts immediately after its neume, before punctuation there.
  // A selected division requires the visible before/after control.
  if (selection.kind === 'division' && !explicitBoundary) return null;
  const scoreBoundary = explicitBoundary ?? {
    beforeNeumeId,
    beforeDivisionId:
      document.divisions.find((d) => d.beforeNeumeId === beforeNeumeId)?.id ??
      null,
  };
  switch (kind) {
    case 'punctum':
      return {
        kind,
        boundary: scoreBoundary,
        insertionIndex,
        staffPositions: [p],
      };
    case 'podatus':
      return {
        kind,
        boundary: scoreBoundary,
        insertionIndex,
        staffPositions: [p, staffPosition(p + 1)],
      };
    case 'clivis':
      return {
        kind,
        boundary: scoreBoundary,
        insertionIndex,
        staffPositions: [p, staffPosition(p - 1)],
      };
    case 'scandicus':
      return {
        kind,
        boundary: scoreBoundary,
        insertionIndex,
        staffPositions: [p, staffPosition(p + 1), staffPosition(p + 2)],
      };
    case 'torculus':
      return {
        kind,
        boundary: scoreBoundary,
        insertionIndex,
        staffPositions: [p, staffPosition(p + 2), staffPosition(p + 1)],
      };
    case 'climacus':
      return {
        kind,
        boundary: scoreBoundary,
        insertionIndex,
        staffPositions: [p, staffPosition(p - 1), staffPosition(p - 2)],
      };
    case 'porrectus':
      return {
        kind,
        boundary: scoreBoundary,
        insertionIndex,
        staffPositions: [p, staffPosition(p - 2), staffPosition(p - 1)],
      };
  }
}

/** Resolve a division-relative control intent against the current document. */
export function resolveDivisionSideBoundary(
  document: ChantDocument,
  id: string,
  side: 'before' | 'after',
): ScoreInsertionBoundary | null {
  const division = document.divisions.find((d) => d.id === id);
  if (!division) return null;
  const siblings = document.divisions.filter(
    (d) => d.beforeNeumeId === division.beforeNeumeId,
  );
  const next =
    side === 'before'
      ? division
      : siblings[siblings.findIndex((d) => d.id === id) + 1];
  return {
    beforeNeumeId: division.beforeNeumeId,
    beforeDivisionId: next?.id ?? null,
  };
}

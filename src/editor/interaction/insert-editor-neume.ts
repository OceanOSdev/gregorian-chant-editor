import { entryAppearance } from '../state/editor-tool';
import { deriveScoreOrder, scoreBoundaryAt } from '../domain/divisions';
import { createNeumeEntryPitches } from '../neume-entry-pitches';
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
  type NoteForm,
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
  form?: NoteForm,
): ChantDocument {
  const base = { id: ids.neumeId };
  const note = (index: 0 | 1 | 2, position: number) => ({
    ...entryAppearance(insertion.kind, form)[index],
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

const toolbarFallbackPitches = {
  punctum: 2,
  podatus: 2,
  clivis: 3,
  scandicus: 2,
  torculus: 2,
  climacus: 3,
  porrectus: 3,
} satisfies Record<GraphicalNeumeKind, number>;

/** Resolve toolbar pitches and contours from a musical selection. */
export function resolveEditorToolbarInsertion(
  document: ChantDocument,
  selection: EditorSelection,
  kind: GraphicalNeumeKind,
  explicitBoundary?: ScoreInsertionBoundary,
): Insertion | null {
  const boundary = resolveToolbarNeumeInsertion(
    document,
    selection,
    staffPosition(toolbarFallbackPitches[kind]),
  );
  if (!boundary) return null;
  const insertionIndex = boundary.insertionIndex;
  const beforeNeumeId = document.neumes[insertionIndex]?.id ?? null;
  // Contextual I inserts immediately after its neume, before punctuation there.
  // A selected division requires the visible before/after control.
  if (
    (selection.kind === 'division' || selection.kind === 'clef-change') &&
    !explicitBoundary
  )
    return null;
  const order = deriveScoreOrder(document);
  if (!order) return null;
  const firstAtBoundary = order.findIndex(
    (item) =>
      (item.type !== 'neume' && item.entity.beforeNeumeId === beforeNeumeId) ||
      (item.type === 'neume' && item.entity.id === beforeNeumeId),
  );
  const scoreBoundary =
    explicitBoundary ??
    scoreBoundaryAt(
      order,
      selection.kind === 'none' ||
        selection.kind === 'clef' ||
        firstAtBoundary < 0
        ? order.length
        : firstAtBoundary,
    );
  return {
    ...createNeumeEntryPitches(kind, boundary.referenceStaffPosition),
    boundary: scoreBoundary,
    insertionIndex,
  };
}

/** Resolve a division-relative control intent against the current document. */
export function resolveDivisionSideBoundary(
  document: ChantDocument,
  id: string,
  side: 'before' | 'after',
): ScoreInsertionBoundary | null {
  const division = document.divisions.find((d) => d.id === id);
  if (!division) return null;
  const order = deriveScoreOrder(document);
  if (!order) return null;
  const index = order.findIndex((item) => item.entity.id === id);
  return scoreBoundaryAt(order, index + (side === 'after' ? 1 : 0));
}

import {
  hasValidAccidentals,
  resolveEffectivePitches,
} from '../domain/accidentals';
import {
  staffPosition,
  type ChantAccidental,
  type ChantDivision,
  type ChantDocument,
  type DivisionKind,
  type Neume,
  type ScoreInsertionBoundary,
} from '../domain/chant-document';
import { clefOffset } from '../domain/clef';
import {
  deriveScoreOrder,
  hasValidDivisions,
  reanchorScoreOrder,
  resolveScoreBoundary,
  scoreBoundaryAt,
  semanticIds,
  type ScoreItem,
} from '../domain/divisions';
import { hasValidLyricAnchors } from '../domain/lyrics';
import { findNote, isValidNeume, mapNeumeNotes } from '../domain/neume';
import { resolveNeumeRange, type EditorSelection } from '../state/selection';

/** Position of a copied note inside the snapshot: neume ordinal, then constituent. */
export interface ClipboardNoteRef {
  neume: number;
  note: number;
}

/** Detached relative pitch of one copied constituent (ADR 0014, ADR 0021). */
export interface ClipboardPitch {
  degree: number;
  alteration: -1 | 0;
}

export interface ClipboardNeume {
  /** Typed tuple shape with blank IDs; staff positions are replaced on paste. */
  template: Neume;
  pitches: readonly ClipboardPitch[];
}

export type ClipboardEvent =
  | { type: 'neume'; neume: ClipboardNeume }
  | { type: 'division'; kind: DivisionKind };

export interface ClipboardAccidental {
  kind: ChantAccidental['kind'];
  owner: ClipboardNoteRef;
  /** Present only when the source above-note anchor lay inside the copy. */
  placement?: ClipboardNoteRef;
}

/**
 * Transient, music-only snapshot. It holds no source IDs, text, clefs,
 * layout or document reference and is never persisted or exported.
 */
export interface MusicalClipboard {
  events: readonly ClipboardEvent[];
  accidentals: readonly ClipboardAccidental[];
  neumeCount: number;
  noteCount: number;
  divisionCount: number;
  /** Copied signs whose source anchor lay outside the copy (default placement). */
  restoredPlacementCount: number;
}

export type CopyRejection = 'invalid-target' | 'invalid-source';

export type CopyResult =
  | { clipboard: MusicalClipboard; rejection: null }
  | { clipboard: null; rejection: CopyRejection };

/** Whole-neume and contiguous range selections are the only copy sources. */
export function copyableNeumeIndexes(
  document: ChantDocument,
  selection: EditorSelection,
): { start: number; end: number } | null {
  if (selection.kind === 'neume') {
    const index = document.neumes.findIndex((n) => n.id === selection.neumeId);
    return index < 0 ? null : { start: index, end: index };
  }
  const range = resolveNeumeRange(document, selection);
  return range ? { start: range.start, end: range.end } : null;
}

/** Captures a detached snapshot from the complete source document. */
export function copyMusicalPassage(
  document: ChantDocument,
  selection: EditorSelection,
): CopyResult {
  const interval = copyableNeumeIndexes(document, selection);
  if (!interval) return { clipboard: null, rejection: 'invalid-target' };
  const order = deriveScoreOrder(document);
  const pitches = resolveEffectivePitches(document);
  if (!order || !pitches)
    return { clipboard: null, rejection: 'invalid-source' };
  const first = document.neumes[interval.start].id;
  const last = document.neumes[interval.end].id;
  const from = order.findIndex((i) => i.entity.id === first);
  const to = order.findIndex((i) => i.entity.id === last);
  if (from < 0 || to < from)
    return { clipboard: null, rejection: 'invalid-source' };
  const refs = new Map<string, ClipboardNoteRef>();
  const events: ClipboardEvent[] = [];
  let neumeCount = 0;
  let noteCount = 0;
  for (const item of order.slice(from, to + 1)) {
    if (item.type === 'division') {
      events.push({ type: 'division', kind: item.entity.kind });
      continue;
    }
    // Source clef changes are omitted: the destination clef governs (policy 2).
    if (item.type !== 'neume') continue;
    const captured: ClipboardPitch[] = [];
    for (const [index, note] of item.entity.notes.entries()) {
      const pitch = pitches.get(note.id);
      if (!pitch) return { clipboard: null, rejection: 'invalid-source' };
      captured.push({ degree: pitch.degree, alteration: pitch.alteration });
      refs.set(note.id, { neume: neumeCount, note: index });
    }
    const mapped = mapNeumeNotes(item.entity, (note) => ({ ...note, id: '' }));
    if (!mapped) return { clipboard: null, rejection: 'invalid-source' };
    events.push({
      type: 'neume',
      neume: { template: { ...mapped, id: '' }, pitches: captured },
    });
    neumeCount++;
    noteCount += captured.length;
  }
  const accidentals: ClipboardAccidental[] = [];
  let restoredPlacementCount = 0;
  for (const sign of document.accidentals) {
    const owner = refs.get(sign.ownerNoteId);
    // A sign owned outside the copy is never copied, even if anchored inside.
    if (!owner) continue;
    const placement = sign.placement && refs.get(sign.placement.noteId);
    if (sign.placement && !placement) restoredPlacementCount++;
    accidentals.push(
      placement
        ? { kind: sign.kind, owner, placement }
        : { kind: sign.kind, owner },
    );
  }
  return {
    clipboard: {
      events,
      accidentals,
      neumeCount,
      noteCount,
      divisionCount: events.length - neumeCount,
      restoredPlacementCount,
    },
    rejection: null,
  };
}

/** Exact number of fresh IDs a paste consumes (neumes, notes, divisions, signs). */
export function pasteIdCount(clipboard: MusicalClipboard): number {
  return (
    clipboard.neumeCount +
    clipboard.noteCount +
    clipboard.divisionCount +
    clipboard.accidentals.length
  );
}

export interface PitchConflict {
  /** 1-based ordinal among pasted notes, or among existing notes after the insertion point. */
  ordinal: number;
  degree: number;
  expected: -1 | 0;
  actual: -1 | 0;
}

export type PasteRejection =
  | { kind: 'empty-clipboard' }
  | { kind: 'invalid-target' }
  | { kind: 'invalid-ids' }
  | { kind: 'unsafe-pitch' }
  | { kind: 'invalid-music' }
  | { kind: 'invalid-placement' }
  | { kind: 'copied-pitch-conflict'; conflict: PitchConflict }
  | { kind: 'existing-pitch-conflict'; conflict: PitchConflict };

export type PasteResult =
  | {
      document: ChantDocument;
      pastedNeumeIds: readonly [string, ...string[]];
      rejection: null;
    }
  | { document: null; rejection: PasteRejection };

/**
 * Selection-based paste position: after the last selected musical neume and
 * before any division/clef run that follows it; at the true score end when
 * nothing is selected. Other selection kinds are not paste targets.
 */
export function resolvePasteBoundary(
  document: ChantDocument,
  selection: EditorSelection,
  order: readonly ScoreItem[],
): ScoreInsertionBoundary | null {
  if (selection.kind === 'none') return scoreBoundaryAt(order, order.length);
  const neumeId =
    selection.kind === 'note'
      ? findNote(document, selection.noteId)?.neume.id
      : selection.kind === 'neume'
        ? document.neumes.find((n) => n.id === selection.neumeId)?.id
        : selection.kind === 'neume-range'
          ? resolveNeumeRange(document, selection)?.neumes.at(-1)?.id
          : undefined;
  if (!neumeId) return null;
  const index = order.findIndex(
    (item) => item.type === 'neume' && item.entity.id === neumeId,
  );
  return index < 0 ? null : scoreBoundaryAt(order, index + 1);
}

/**
 * Builds and validates one complete candidate. Never repairs, relocates or
 * synthesizes accidentals, clefs or lyric anchors: a candidate that would
 * change any copied or existing effective pitch, or any sign's validity, is
 * rejected and the caller keeps the original document.
 */
export function pasteMusicalPassage(
  document: ChantDocument,
  selection: EditorSelection,
  clipboard: MusicalClipboard | null,
  ids: readonly string[],
): PasteResult {
  const reject = (rejection: PasteRejection): PasteResult => ({
    document: null,
    rejection,
  });
  if (!clipboard || !clipboard.neumeCount)
    return reject({ kind: 'empty-clipboard' });
  const order = deriveScoreOrder(document);
  const before = resolveEffectivePitches(document);
  if (!order || !before) return reject({ kind: 'invalid-music' });
  const boundary = resolvePasteBoundary(document, selection, order);
  const resolved = boundary && resolveScoreBoundary(document, boundary);
  if (!resolved) return reject({ kind: 'invalid-target' });

  const existing = new Set([
    ...semanticIds(document),
    ...document.divisions.map((d) => d.id),
  ]);
  if (
    ids.length !== pasteIdCount(clipboard) ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => typeof id !== 'string' || !id.trim() || existing.has(id))
  )
    return reject({ kind: 'invalid-ids' });
  let next = 0;
  const take = () => ids[next++];

  // The effective destination clef: the last authored clef strictly before
  // the boundary, else the initial clef. Source clefs are never pasted.
  const governing = order
    .slice(0, resolved.scoreIndex)
    .findLast((item) => item.type === 'clef');
  const offset = clefOffset(
    governing?.type === 'clef' ? governing.entity.clef : document.clef,
  );

  const noteIds: string[][] = [];
  const neumes: Neume[] = [];
  const inserted: ScoreItem[] = [];
  for (const event of clipboard.events) {
    if (event.type === 'division') {
      const division: ChantDivision = {
        id: take(),
        kind: event.kind,
        beforeNeumeId: null,
      };
      inserted.push({ type: 'division', entity: division });
      continue;
    }
    const neumeId = take();
    const local: string[] = [];
    let unsafe = false;
    const mapped = mapNeumeNotes(event.neume.template, (note, index) => {
      const id = take();
      local.push(id);
      const position = (event.neume.pitches[index]?.degree ?? NaN) - offset;
      if (!Number.isSafeInteger(position)) {
        unsafe = true;
        return { ...note, id };
      }
      return { ...note, id, staffPosition: staffPosition(position) };
    });
    if (unsafe) return reject({ kind: 'unsafe-pitch' });
    if (!mapped) return reject({ kind: 'invalid-music' });
    const neume: Neume = { ...mapped, id: neumeId };
    if (!isValidNeume(neume)) return reject({ kind: 'invalid-music' });
    noteIds.push(local);
    neumes.push(neume);
    inserted.push({ type: 'neume', entity: neume });
  }
  const noteAt = (ref: ClipboardNoteRef) => noteIds[ref.neume]?.[ref.note];
  const accidentals: ChantAccidental[] = [];
  for (const sign of clipboard.accidentals) {
    const ownerNoteId = noteAt(sign.owner);
    const anchor = sign.placement && noteAt(sign.placement);
    if (!ownerNoteId || (sign.placement && !anchor))
      return reject({ kind: 'invalid-music' });
    accidentals.push(
      anchor
        ? {
            id: take(),
            kind: sign.kind,
            ownerNoteId,
            placement: { kind: 'above-note', noteId: anchor },
          }
        : { id: take(), kind: sign.kind, ownerNoteId },
    );
  }

  const spliced = [...order];
  spliced.splice(resolved.scoreIndex, 0, ...inserted);
  const candidate: ChantDocument = {
    ...document,
    ...reanchorScoreOrder(spliced),
    neumes: [
      ...document.neumes.slice(0, resolved.neumeIndex),
      ...neumes,
      ...document.neumes.slice(resolved.neumeIndex),
    ],
    accidentals: [...document.accidentals, ...accidentals],
  };
  if (!hasValidDivisions(candidate) || !hasValidLyricAnchors(candidate))
    return reject({ kind: 'invalid-music' });
  const after = resolveEffectivePitches(candidate);
  if (!after) return reject({ kind: 'unsafe-pitch' });

  const copied = clipboard.events.flatMap((e) =>
    e.type === 'neume' ? e.neume.pitches : [],
  );
  const pastedNotes = noteIds.flat();
  for (const [index, id] of pastedNotes.entries()) {
    const pitch = after.get(id);
    const expected = copied[index];
    if (
      !pitch ||
      !expected ||
      pitch.degree !== expected.degree ||
      pitch.alteration !== expected.alteration
    )
      return reject({
        kind: 'copied-pitch-conflict',
        conflict: {
          ordinal: index + 1,
          degree: expected?.degree ?? 0,
          expected: expected?.alteration ?? 0,
          actual: pitch?.alteration ?? 0,
        },
      });
  }
  // Only music after the insertion point can change; count from there.
  let ordinal = 0;
  for (const [id, pitch] of before) {
    if (pitch.neumeIndex < resolved.neumeIndex) continue;
    ordinal++;
    const now = after.get(id);
    if (
      !now ||
      now.degree !== pitch.degree ||
      now.alteration !== pitch.alteration
    )
      return reject({
        kind: 'existing-pitch-conflict',
        conflict: {
          ordinal,
          degree: pitch.degree,
          expected: pitch.alteration,
          actual: now?.alteration ?? 0,
        },
      });
  }
  // Exact candidate validation: an existing or copied explicit anchor that
  // the insertion invalidates rejects instead of being silently defaulted.
  if (!hasValidAccidentals(candidate))
    return reject({ kind: 'invalid-placement' });
  const [first, ...rest] = neumes.map((n) => n.id);
  return first
    ? { document: candidate, pastedNeumeIds: [first, ...rest], rejection: null }
    : reject({ kind: 'empty-clipboard' });
}

const pitchLetters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

function pitchName(degree: number, alteration: -1 | 0): string {
  const letter = pitchLetters[((degree % 7) + 7) % 7];
  return letter === 'B' ? (alteration ? 'B-flat' : 'B-natural') : letter;
}

/** Concise user-facing explanation; never a technical dump. */
export function pasteRejectionMessage(rejection: PasteRejection): string {
  switch (rejection.kind) {
    case 'empty-clipboard':
      return 'Nothing to paste. Copy a whole neume or passage first.';
    case 'invalid-target':
      return 'Cannot paste here. Select a note, whole neume or passage to paste after it, or clear selection to append at the end.';
    case 'invalid-ids':
      return 'Cannot paste: try again.';
    case 'unsafe-pitch':
      return 'Cannot paste: the copied pitches cannot be represented under this clef.';
    case 'invalid-music':
      return 'Cannot paste: the result would not be a valid score.';
    case 'invalid-placement':
      return 'Cannot paste: an existing or copied accidental placement would become invalid here.';
    case 'copied-pitch-conflict': {
      const { ordinal, degree, expected, actual } = rejection.conflict;
      return `Cannot paste: copied note ${ordinal}, a ${pitchName(degree, expected)}, would become ${pitchName(degree, actual)} here.`;
    }
    case 'existing-pitch-conflict': {
      const { ordinal, degree, expected, actual } = rejection.conflict;
      return `Cannot paste: the copied music would change existing note ${ordinal} after the insertion point from ${pitchName(degree, expected)} to ${pitchName(degree, actual)}.`;
    }
  }
}

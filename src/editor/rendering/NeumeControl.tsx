import type { KeyboardEvent, MouseEvent } from 'react';
import type { StaffPositionDelta } from '../commands/move-note';
import type {
  AccidentalLayout,
  NeumeLayout,
  NoteLayout,
} from '../layout/layout-chant';
import type { VerticalBand } from '../layout/system-vertical-layout';
import type { EditorSelection } from '../state/selection';
import { getAccidentalAccessibleLabel } from './accidental-accessible-label';
import { neumeSelectionBounds } from './neume-selection-bounds';
import {
  getNoteAccessibleLabel,
  getNoteModifierDescription,
  getSelectedNeumeDescription,
} from './note-accessible-label';
import { InkShapeView, NeumeInk } from './NeumeInk';
import {
  clampToBand,
  moveCaptionBaseline,
  type RenderBand,
} from './render-band';

/**
 * Note intents. `ChantEditor` binds them to the session; `ScoreSvg` forwards
 * them unchanged from its props.
 */
export interface NoteActions {
  onSelectNote: (noteId: string) => void;
  onSelectNeumeForNote: (noteId: string) => void;
  onExtendSelection?: (noteId: string, direction: -1 | 1) => void;
  onMoveNote: (noteId: string, delta: StaffPositionDelta) => void;
  onMoveNeume: (
    neumeId: string,
    delta: StaffPositionDelta,
    invokingNoteId: string,
  ) => void;
  onDeleteNote: (noteId: string) => void;
  onDeleteNeume: (neumeId: string) => void;
  /** Moves focus to nearby note properties; false when none opened. */
  onFocusNoteModifiers?: () => boolean;
}

/** Edit intents of a committed written accidental. */
export interface WrittenAccidentalActions {
  onSelectAccidental: (id: string) => void;
  onDeleteAccidental: (id: string) => void;
  /** Moves focus to the accidental properties; false when none opened. */
  onFocusAccidentalProperties: () => boolean;
}

/**
 * Notes that may receive a pending accidental, in keyboard order, while
 * accidental placement is armed.
 */
export interface AccidentalPlacementTargets {
  noteIds: readonly string[];
  onTarget: (noteId: string) => void;
}

/** This neume's role while a lyric anchor is being reassigned. */
export interface LyricMoveTarget {
  status: 'current-anchor' | 'legal' | 'unavailable';
  previewed: boolean;
  onChoose: () => void;
}

interface NeumeControlProps {
  neume: NeumeLayout;
  /** 1-based score-wide neume number, announced during lyric reassignment. */
  ordinal: number;
  /** The system's resolved musical band and its painted render band. */
  musicBand: VerticalBand;
  band: RenderBand;
  /** Score-unique ID for this neume's horizontal ownership clip. */
  ownershipClipId: string;
  selection: EditorSelection;
  inSelectedRange: boolean;
  placementActive: boolean;
  transactionBlocked: boolean;
  lyricMove: LyricMoveTarget | null;
  accidentalPlacement: AccidentalPlacementTargets | null;
  noteActions: NoteActions;
  accidentalActions: WrittenAccidentalActions;
  /** Registers each mounted note with the score's single focus registry. */
  registerNoteElement: (noteId: string, element: SVGGElement | null) => void;
  /** Focuses and reveals a mounted note, possibly in another neume. */
  focusNote: (noteId: string) => void;
}

/** Kinds whose padded or oblique note targets own pointer input by fill only. */
const fillOwnedTargetKinds: ReadonlySet<NeumeLayout['kind']> = new Set([
  'climacus',
  'climacus-resupinus',
  'porrectus',
  'porrectus-flexus',
  'torculus-resupinus',
  'pes-subpunctis',
]);

const lyricMoveCaption: Record<LyricMoveTarget['status'], string> = {
  'current-anchor': 'Current anchor',
  legal: 'Legal destination',
  unavailable: 'Unavailable: occupied or crosses another anchor',
};

/**
 * One committed neume's interactive SVG subtree: engraved ink, whole-neume
 * decorations, its note button controls and its written accidentals. It
 * translates browser events into the named edit intents above and never
 * changes the document, layout, selection or focus registry itself.
 */
export function NeumeControl({
  neume,
  ordinal,
  musicBand,
  band,
  ownershipClipId,
  selection,
  inSelectedRange,
  placementActive,
  transactionBlocked,
  lyricMove,
  accidentalPlacement,
  noteActions,
  accidentalActions,
  registerNoteElement,
  focusNote,
}: NeumeControlProps) {
  const isNeumeSelected =
    selection.kind === 'neume' && selection.neumeId === neume.neumeId;
  const selectedDescription = getSelectedNeumeDescription(
    neume.kind,
    isNeumeSelected,
    neume.notes.length,
    neume.liquescentFigure,
  );
  const selectedDescriptionId = `selected-neume-${neume.neumeId}`;
  const ownershipClip = neume.hitClip ? `url(#${ownershipClipId})` : undefined;
  // Ordinary padding is clipped to layout's ownership interval at compact
  // boundaries, including lyric reassignment destinations. Bounds-derived
  // overlays are limited to the painted band too.
  const moveBounds = clampToBand(
    {
      x: neume.bounds.x - 7,
      y: neume.bounds.y - 7,
      width: neume.bounds.width + 14,
      height: neume.bounds.height + 14,
    },
    band,
  );
  const showsPlacementContext =
    placementActive &&
    (isNeumeSelected ||
      (selection.kind === 'note' &&
        neume.notes.some((note) => note.noteId === selection.noteId)));
  const moraPair = neume.notes.filter((n) => n.mora).length === 2;

  return (
    <g
      data-neume-id={neume.neumeId}
      data-neume-kind={neume.kind}
      data-liquescent-figure={neume.liquescentFigure}
    >
      {neume.hitClip ? (
        <defs>
          <clipPath id={ownershipClipId}>
            <rect
              {...clampToBand(
                {
                  x: neume.hitClip.left,
                  y: neume.bounds.y - 20,
                  width: neume.hitClip.right - neume.hitClip.left,
                  height: neume.bounds.height + 40,
                },
                band,
              )}
            />
          </clipPath>
        </defs>
      ) : null}
      {selectedDescription ? (
        <desc id={selectedDescriptionId}>{selectedDescription}</desc>
      ) : null}
      {isNeumeSelected ? (
        // Fitted inside ownership rather than clipped, so the dashed outline
        // stays complete at compact boundaries.
        <rect
          className="score__neume-selection"
          data-selected-neume-id={neume.neumeId}
          {...clampToBand(neumeSelectionBounds(neume), band)}
          rx="4"
          pointerEvents="none"
          aria-hidden="true"
        />
      ) : null}
      {showsPlacementContext ? (
        <rect
          className="score__placement-context"
          clipPath={ownershipClip}
          {...moveBounds}
          rx="3"
          pointerEvents="none"
          aria-hidden="true"
        />
      ) : null}
      {lyricMove && lyricMove.status !== 'unavailable' ? (
        <g pointerEvents="none" aria-hidden="true">
          <rect
            clipPath={ownershipClip}
            className={`score__move-target${lyricMove.previewed ? ' score__move-target--preview' : ''}`}
            {...moveBounds}
            rx="3"
          />
          <text
            className="score__move-caption"
            x={neume.bounds.x}
            y={moveCaptionBaseline(neume.bounds, musicBand)}
          >
            {lyricMove.status === 'current-anchor'
              ? 'Current anchor'
              : lyricMove.previewed
                ? 'Preview'
                : 'Legal'}
          </text>
        </g>
      ) : null}
      <NeumeInk
        ink={neume.bodyInk ?? neume.ink}
        ledgers={neume.ledgers}
        band={band}
      />
      {neume.notes.map((note, noteIndex) => {
        const accessibleLabel =
          getNoteAccessibleLabel(
            neume.kind,
            noteIndex,
            neume.notes.length,
            neume.liquescentFigure,
          ) + getNoteModifierDescription(note, moraPair);
        return (
          <NoteControl
            key={note.noteId}
            note={note}
            neume={neume}
            accessibleLabel={
              lyricMove
                ? `${accessibleLabel}. Neume ${ordinal}. ${lyricMoveCaption[lyricMove.status]}.${lyricMove.previewed ? ' Previewed destination.' : ''}`
                : accessibleLabel
            }
            describedBy={
              lyricMove
                ? 'lyric-move-help'
                : `whole-neume-selection-instruction${inSelectedRange ? ' range-member-description' : ''}${isNeumeSelected ? ` ${selectedDescriptionId}` : ''}`
            }
            isNoteSelected={
              selection.kind === 'note' && selection.noteId === note.noteId
            }
            isNeumeSelected={isNeumeSelected}
            ownershipClip={ownershipClip}
            placementActive={placementActive}
            transactionBlocked={transactionBlocked}
            lyricMove={lyricMove}
            accidentalPlacement={accidentalPlacement}
            actions={noteActions}
            registerElement={(element) =>
              registerNoteElement(note.noteId, element)
            }
            focusNote={focusNote}
          />
        );
      })}
      {neume.accidentals?.map((accidental) =>
        accidental.accidentalId ? (
          <WrittenAccidentalControl
            key={accidental.accidentalId}
            id={accidental.accidentalId}
            accidental={accidental}
            selected={
              selection.kind === 'accidental' &&
              selection.accidentalId === accidental.accidentalId
            }
            enabled={
              !placementActive && !transactionBlocked && !accidentalPlacement
            }
            transactionBlocked={transactionBlocked}
            ownershipClip={ownershipClip}
            actions={accidentalActions}
          />
        ) : null,
      )}
      {lyricMove ? (
        <rect
          className="score__move-hit-target"
          {...moveBounds}
          rx="3"
          fill="transparent"
          stroke="transparent"
          strokeWidth={lyricMove.previewed ? 3 : 2}
          pointerEvents="all"
          clipPath={ownershipClip}
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation();
            lyricMove.onChoose();
          }}
        />
      ) : null}
    </g>
  );
}

interface NoteControlProps {
  note: NoteLayout;
  neume: NeumeLayout;
  accessibleLabel: string;
  describedBy: string;
  isNoteSelected: boolean;
  isNeumeSelected: boolean;
  ownershipClip: string | undefined;
  placementActive: boolean;
  transactionBlocked: boolean;
  lyricMove: LyricMoveTarget | null;
  accidentalPlacement: AccidentalPlacementTargets | null;
  actions: NoteActions;
  registerElement: (element: SVGGElement | null) => void;
  focusNote: (noteId: string) => void;
}

/**
 * One note's focusable SVG button: its pointer target, selection contour and
 * accidental-placement marker. Event precedence is accidental placement,
 * then disabled modes, then lyric reassignment, then ordinary editing.
 */
function NoteControl({
  note,
  neume,
  accessibleLabel,
  describedBy,
  isNoteSelected,
  isNeumeSelected,
  ownershipClip,
  placementActive,
  transactionBlocked,
  lyricMove,
  accidentalPlacement,
  actions,
  registerElement,
  focusNote,
}: NoteControlProps) {
  const isAccidentalTarget =
    accidentalPlacement?.noteIds.includes(note.noteId) ?? false;
  const notAccidentalTarget = !!accidentalPlacement && !isAccidentalTarget;

  function handleClick(event: MouseEvent<SVGGElement>) {
    event.stopPropagation();
    if (accidentalPlacement) {
      accidentalPlacement.onTarget(note.noteId);
      return;
    }
    if (placementActive || transactionBlocked) return;
    if (lyricMove) {
      lyricMove.onChoose();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.shiftKey) actions.onSelectNeumeForNote(note.noteId);
    else actions.onSelectNote(note.noteId);
  }

  function handleAccidentalTargetKeyDown(
    event: KeyboardEvent<SVGGElement>,
    targets: AccidentalPlacementTargets,
  ) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      targets.onTarget(note.noteId);
    } else if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();
      const { noteIds } = targets;
      const current = noteIds.indexOf(note.noteId);
      const delta =
        event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      focusNote(noteIds[(current + delta + noteIds.length) % noteIds.length]);
    }
  }

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (accidentalPlacement) {
      handleAccidentalTargetKeyDown(event, accidentalPlacement);
      return;
    }
    if (
      transactionBlocked ||
      lyricMove ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      placementActive ||
      event.nativeEvent.isComposing
    )
      return;

    if (
      (isNoteSelected || isNeumeSelected) &&
      event.key === 'Tab' &&
      !event.shiftKey &&
      actions.onFocusNoteModifiers?.()
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      actions.onExtendSelection &&
      event.shiftKey &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      event.preventDefault();
      event.stopPropagation();
      actions.onExtendSelection(
        note.noteId,
        event.key === 'ArrowLeft' ? -1 : 1,
      );
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) actions.onSelectNeumeForNote(note.noteId);
      else actions.onSelectNote(note.noteId);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (isNoteSelected) actions.onDeleteNote(note.noteId);
      else if (isNeumeSelected) actions.onDeleteNeume(neume.neumeId);
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (!isNoteSelected && !isNeumeSelected) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.key === 'ArrowUp' ? 1 : -1;
    if (isNoteSelected) actions.onMoveNote(note.noteId, delta);
    else actions.onMoveNeume(neume.neumeId, delta, note.noteId);
  }

  return (
    <g
      className="score__note"
      ref={registerElement}
      data-note-id={note.noteId}
      role="button"
      tabIndex={
        placementActive || transactionBlocked || notAccidentalTarget ? -1 : 0
      }
      pointerEvents={
        placementActive || lyricMove || transactionBlocked ? 'none' : 'all'
      }
      aria-label={accessibleLabel}
      aria-describedby={describedBy}
      aria-pressed={isNoteSelected}
      aria-disabled={
        placementActive || transactionBlocked || notAccidentalTarget
      }
      onMouseDown={(event) => {
        // Keep the browser from extending a text selection on Shift-click.
        if (
          actions.onExtendSelection &&
          event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !placementActive &&
          !transactionBlocked &&
          !lyricMove &&
          !accidentalPlacement
        )
          event.preventDefault();
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {isAccidentalTarget ? (
        <rect
          className="score__accidental-placement-target"
          {...note.hitBounds}
          fill="none"
          stroke="#a33"
          strokeWidth="2"
          pointerEvents="none"
          aria-hidden="true"
        />
      ) : null}
      <g
        aria-hidden="true"
        clipPath={ownershipClip}
        pointerEvents={
          placementActive || lyricMove
            ? 'none'
            : fillOwnedTargetKinds.has(neume.kind)
              ? 'fill'
              : undefined
        }
      >
        <InkShapeView
          className="score__note-hit-target"
          shape={
            note.hitShape ?? {
              kind: 'rect',
              bounds: note.hitBounds,
              radius: 0,
            }
          }
        />
      </g>
      {note.modifierBounds ? (
        <rect
          {...note.modifierBounds}
          fill="none"
          pointerEvents="none"
          aria-hidden="true"
        />
      ) : null}
      {isNoteSelected ? (
        <g pointerEvents="none" aria-hidden="true">
          <InkShapeView shape={note.head} className="score__note-selection" />
        </g>
      ) : null}
    </g>
  );
}

interface WrittenAccidentalControlProps {
  id: string;
  accidental: AccidentalLayout;
  selected: boolean;
  /**
   * No placement tool, clef transaction or armed accidental placement. Every
   * `EditorTool` except Select is a placement tool (`isPlacementTool`).
   * Governs tab stop, pointer target and `aria-disabled` only.
   */
  enabled: boolean;
  /**
   * Handlers check only this, as before M2: an accidental that already has
   * focus still responds to keys while another tool or accidental placement
   * is armed. Do not replace it with `!enabled`.
   */
  transactionBlocked: boolean;
  ownershipClip: string | undefined;
  actions: WrittenAccidentalActions;
}

/** A written accidental's ink and its separately focusable button. */
function WrittenAccidentalControl({
  id,
  accidental,
  selected,
  enabled,
  transactionBlocked,
  ownershipClip,
  actions,
}: WrittenAccidentalControlProps) {
  return (
    <g
      className="score__accidental"
      pointerEvents={enabled ? 'all' : 'none'}
      aria-disabled={!enabled}
      data-accidental-id={id}
      tabIndex={enabled ? 0 : -1}
      role="button"
      aria-label={getAccidentalAccessibleLabel(accidental)}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        if (!transactionBlocked) actions.onSelectAccidental(id);
      }}
      onKeyDown={(event) => {
        if (transactionBlocked) return;
        if (
          event.key === 'Tab' &&
          !event.shiftKey &&
          selected &&
          actions.onFocusAccidentalProperties()
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          actions.onSelectAccidental(id);
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          event.stopPropagation();
          actions.onDeleteAccidental(id);
        }
      }}
    >
      <InkShapeView shape={accidental.ink} className="score__accidental-ink" />
      <rect
        className="score__accidental-target"
        clipPath={ownershipClip}
        {...accidental.hitBounds}
        fill="transparent"
        stroke={selected ? 'var(--accent, #a33)' : 'none'}
        strokeWidth="2"
      />
    </g>
  );
}

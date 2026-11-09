import { getNoteModifierDescription } from './note-accessible-label';
import {
  custosLedgerThickness,
  custosLedgerSpacing,
} from '../layout/custos-geometry';
import type { ClefPlacementPreview } from '../interaction/resolve-graphical-clef-placement';
import type { ClefGeometry } from '../layout/clef-geometry';
import type { ClefKeyboardCommand } from '../state/editor-session';
import { ClefControl } from './ClefControl';
import type { Clef } from '../domain/chant-document';
import { DivisionControl } from './DivisionControl';
import { DivisionInk } from './DivisionInk';
import type { DivisionLayout } from '../layout/division-geometry';
import { lyricFontFamily, lyricFontSize } from '../layout/lyric-text-metrics';
import { getSyllableKeyAction } from '../interaction/lyric-entry-keyboard';
import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { StaffPositionDelta } from '../commands/move-note';
import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind';
import {
  type ChantLayout,
  type ChantSystemLayout,
  type GraphicalPlacementPreviewLayout,
  type GraphicalNeumeKind,
} from '../layout/layout-chant';
import { isPlacementTool, type EditorTool } from '../state/editor-tool';
import type { EditorSelection } from '../state/selection';
import type { EditorFocusRequest } from '../state/editor-session';
import { focusAndReveal } from './focus-visibility';
import {
  getNoteAccessibleLabel,
  getSelectedNeumeDescription,
  wholeNeumeSelectionInstruction,
} from './note-accessible-label';
import { getScoreAccessibleDescription } from './score-accessible-description';
import { InkShapeView, NeumeInk } from './NeumeInk';

export interface SvgPoint {
  x: number;
  y: number;
}

interface ScoreSvgProps {
  onFocusNoteModifiers?: () => boolean;
  clefPreview: ClefPlacementPreview | null;
  clefDraftPreview: { id: string; clef: ClefGeometry } | null;
  onPlaceClef: (point?: SvgPoint) => void;
  onClefKeyboard: (command: ClefKeyboardCommand) => void;
  transactionBlocked: boolean;
  onSelectClefChange: (id: string) => void;
  onStepClefChange: (id: string, direction: 1 | -1) => void;
  clefEdit: { id: string; clef: Clef } | null;
  onDeleteClefChange: (id: string) => void;
  onSelectClef: () => void;
  onChangeClef: (clef: Clef) => void;
  layout: ChantLayout;
  divisionPreview: {
    division: DivisionLayout;
    caret: { x: number; top: number; bottom: number };
  } | null;
  onPlaceDivision: (point: SvgPoint) => void;
  onSelectDivision: (id: string) => void;
  onDeleteDivision: (id: string) => void;
  lyricMove: {
    syllableId: string;
    candidateId: string;
    anchorId: string;
    legalIds: string[];
  } | null;
  onMoveDestination: (neumeId: string) => void;
  placementPreview: GraphicalPlacementPreviewLayout | null;
  selection: EditorSelection;
  activeTool: EditorTool;
  placementDescription: string;
  focusRequest: EditorFocusRequest | null;
  onFocusHandled: (request: EditorFocusRequest) => void;
  onSelectNote: (noteId: string) => void;
  onSelectNeumeForNote: (noteId: string) => void;
  onPlacementPointerMove: (point: SvgPoint) => void;
  onPlacementPointerLeave: () => void;
  onPlaceNeume: (kind: GraphicalNeumeKind, point: SvgPoint) => void;
  onMoveNote: (noteId: string, delta: StaffPositionDelta) => void;
  onMoveNeume: (
    neumeId: string,
    delta: StaffPositionDelta,
    invokingNoteId: string,
  ) => void;
  onDeleteNote: (noteId: string) => void;
  onDeleteNeume: (neumeId: string) => void;
  onClearSelection: () => void;
  onSelectSyllable: (id: string) => void;
  onEditSyllable: (id: string, replacement?: string) => void;
  onAdvanceLyric: (key: '-' | ' ' | '_') => void;
  onDeleteSyllable: (syllableId: string) => void;
}

export function ScoreSvg({
  onFocusNoteModifiers,
  clefPreview,
  clefDraftPreview,
  onPlaceClef,
  onClefKeyboard,
  transactionBlocked,
  onSelectClefChange,
  onStepClefChange,
  clefEdit,
  onDeleteClefChange,
  onSelectClef,
  onChangeClef,
  layout,
  divisionPreview,
  onPlaceDivision,
  onSelectDivision,
  onDeleteDivision,
  lyricMove,
  onMoveDestination,
  placementPreview,
  selection,
  activeTool,
  placementDescription,
  focusRequest,
  onFocusHandled,
  onSelectNote,
  onSelectNeumeForNote,
  onPlacementPointerMove,
  onPlacementPointerLeave,
  onPlaceNeume,
  onMoveNote,
  onMoveNeume,
  onDeleteNote,
  onDeleteNeume,
  onClearSelection,
  onSelectSyllable,
  onEditSyllable,
  onAdvanceLyric,
  onDeleteSyllable,
}: ScoreSvgProps) {
  const ledgerId = useId();
  const clefPreviewElement = useRef<SVGGElement>(null);
  const clefChangeElements = useRef(new Map<string, SVGGElement>());
  const clefElement = useRef<SVGGElement>(null);
  const scoreElement = useRef<SVGSVGElement>(null);
  const lyricElements = useRef(new Map<string, SVGTextElement>());
  const divisionElements = useRef(new Map<string, SVGGElement>());
  const noteElements = useRef(new Map<string, SVGGElement>());
  // Reflow can reparent keyed controls between system groups. Track browser
  // focus separately from selection so measurement changes can restore that ID.
  const focusedEntity = useRef<{
    kind: 'note' | 'lyric' | 'division' | 'clef-change';
    id: string;
    element: Element;
  } | null>(null);
  useLayoutEffect(() => {
    const track = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        !scoreElement.current?.contains(target)
      ) {
        focusedEntity.current = null;
        return;
      }
      const clefChangeId = target.getAttribute('data-clef-change-id');
      const divisionId = target.getAttribute('data-division-id');
      const noteId = target.getAttribute('data-note-id');
      const syllableId = target.getAttribute('data-syllable-id');
      focusedEntity.current = clefChangeId
        ? { kind: 'clef-change', id: clefChangeId, element: target }
        : divisionId
          ? { kind: 'division', id: divisionId, element: target }
          : noteId
            ? { kind: 'note', id: noteId, element: target }
            : syllableId
              ? { kind: 'lyric', id: syllableId, element: target }
              : null;
    };
    document.addEventListener('focusin', track);
    return () => document.removeEventListener('focusin', track);
  }, []);
  useLayoutEffect(() => {
    const target = focusedEntity.current;
    if (
      !target ||
      target.element.isConnected ||
      focusRequest ||
      document.activeElement !== document.body
    )
      return;
    const element =
      target.kind === 'clef-change'
        ? clefChangeElements.current.get(target.id)
        : target.kind === 'division'
          ? divisionElements.current.get(target.id)
          : target.kind === 'note'
            ? noteElements.current.get(target.id)
            : lyricElements.current.get(target.id);
    if (element) focusAndReveal(element);
  });
  const placementActive = isPlacementTool(activeTool);
  useLayoutEffect(() => {
    if (
      !focusRequest ||
      focusRequest.kind === 'palette' ||
      focusRequest.kind === 'lyrics'
    )
      return;
    if (focusRequest.kind === 'clef-placement') {
      const target = focusRequest.clefChangeId
        ? clefChangeElements.current.get(focusRequest.clefChangeId)
        : clefPreviewElement.current;
      if (scoreElement.current)
        focusAndReveal(
          scoreElement.current,
          target ?? undefined,
          target ?? undefined,
        );
      onFocusHandled(focusRequest);
      return;
    }
    if (focusRequest.kind === 'clef-change') {
      const element = clefChangeElements.current.get(focusRequest.clefChangeId);
      if (element) focusAndReveal(element);
      onFocusHandled(focusRequest);
      return;
    }
    if (focusRequest.kind === 'clef') {
      if (clefElement.current && !placementActive)
        focusAndReveal(clefElement.current);
      onFocusHandled(focusRequest);
      return;
    }
    if (focusRequest.kind === 'division') {
      const division = divisionElements.current.get(focusRequest.divisionId);
      if (division) {
        if (placementActive && scoreElement.current)
          focusAndReveal(scoreElement.current, division, division);
        else focusAndReveal(division);
      }
      onFocusHandled(focusRequest);
      return;
    }
    if (focusRequest.kind === 'lyric') {
      const lyric = lyricElements.current.get(focusRequest.syllableId);
      if (lyric && !placementActive) focusAndReveal(lyric);
      onFocusHandled(focusRequest);
      return;
    }
    const note = noteElements.current.get(focusRequest.noteId);
    if (
      focusRequest.kind === 'placement' &&
      placementActive &&
      note &&
      scoreElement.current
    ) {
      focusAndReveal(
        scoreElement.current,
        note.closest('[data-neume-id]') ?? note,
        note,
      );
    } else if (focusRequest.kind === 'note' && !placementActive && note) {
      focusAndReveal(note);
    }
    onFocusHandled(focusRequest);
  }, [focusRequest, onFocusHandled, placementActive]);

  function handleNoteClick(event: MouseEvent<SVGGElement>, noteId: string) {
    event.stopPropagation();
    if (placementActive || transactionBlocked) return;
    if (lyricMove) {
      const neumeId =
        event.currentTarget.closest<SVGGElement>('[data-neume-id]')?.dataset
          .neumeId;
      if (neumeId) onMoveDestination(neumeId);
      return;
    }

    if (event.shiftKey) {
      onSelectNeumeForNote(noteId);
    } else {
      onSelectNote(noteId);
    }
  }

  function handleScoreClick(event: MouseEvent<SVGSVGElement>) {
    if (!isPlacementTool(activeTool)) {
      onClearSelection();
      return;
    }

    const localPoint = getLocalPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );

    if (!localPoint) {
      return;
    }

    if (transactionBlocked) return;
    if (activeTool.kind === 'place-clef') {
      if (event.detail > 1) return;
      onPlaceClef(localPoint);
      return;
    }
    if (activeTool.kind === 'place-division') {
      onPlaceDivision(localPoint);
      return;
    }
    const kind = getGraphicalNeumeKind(activeTool);

    if (kind) {
      onPlaceNeume(kind, localPoint);
    }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!isPlacementTool(activeTool)) {
      return;
    }

    const localPoint = getLocalPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );

    if (localPoint) {
      onPlacementPointerMove(localPoint);
    } else {
      onPlacementPointerLeave();
    }
  }

  function handleNoteKeyDown(
    event: KeyboardEvent<SVGGElement>,
    noteId: string,
    neumeId: string,
    isNoteSelected: boolean,
    isNeumeSelected: boolean,
  ) {
    if (
      lyricMove ||
      isPlacementTool(activeTool) ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    if (
      isNoteSelected &&
      event.key === 'Tab' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      onFocusNoteModifiers?.()
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) {
        onSelectNeumeForNote(noteId);
      } else {
        onSelectNote(noteId);
      }

      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;

      if (isNoteSelected) {
        onDeleteNote(noteId);
      } else if (isNeumeSelected) {
        onDeleteNeume(neumeId);
      }

      return;
    }

    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }

    if (!isNoteSelected && !isNeumeSelected) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (isNoteSelected) {
      onMoveNote(noteId, event.key === 'ArrowUp' ? 1 : -1);
    } else if (isNeumeSelected) {
      onMoveNeume(neumeId, event.key === 'ArrowUp' ? 1 : -1, noteId);
    }
  }

  return (
    <svg
      ref={scoreElement}
      tabIndex={
        placementActive
          ? activeTool.kind === 'place-clef'
            ? 0
            : -1
          : undefined
      }
      className={`score${placementActive ? ' score--placing' : ''}`}
      viewBox={`${layout.x} ${layout.y} ${layout.width} ${layout.height}`}
      style={
        layout.width > 720
          ? { width: layout.width, maxWidth: 'none' }
          : undefined
      }
      role="group"
      aria-label={placementActive ? 'Score placement' : undefined}
      aria-labelledby={
        placementActive ? undefined : 'score-title score-description'
      }
      aria-describedby={placementActive ? 'placement-description' : undefined}
      onKeyDown={(event) => {
        if (
          activeTool.kind !== 'place-clef' ||
          transactionBlocked ||
          event.nativeEvent.isComposing ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.shiftKey
        )
          return;
        const commands: Record<string, ClefKeyboardCommand> = {
          ArrowLeft: 'previous',
          ArrowRight: 'next',
          ArrowUp: 'up',
          ArrowDown: 'down',
          Home: 'first',
          End: 'last',
        };
        const command = commands[event.key];
        if (command) {
          event.preventDefault();
          event.stopPropagation();
          onClefKeyboard(command);
        } else if (
          (event.key === 'Enter' || event.key === ' ') &&
          !event.repeat
        ) {
          event.preventDefault();
          event.stopPropagation();
          onPlaceClef();
        }
      }}
      onClick={handleScoreClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onPlacementPointerLeave()}
    >
      {placementActive ? (
        <desc id="placement-description">{placementDescription}</desc>
      ) : null}
      <title id="score-title">{layout.title}</title>
      <desc id="score-description">
        {getScoreAccessibleDescription(layout)}
      </desc>
      <desc id="whole-neume-selection-instruction">
        {wholeNeumeSelectionInstruction} When a note is selected, Tab opens its
        nearby markings. Escape in the markings closes them and returns to the
        note.
      </desc>

      {layout.systems.map((system) => (
        <g key={system.index} data-system-index={system.index}>
          <SystemStaff system={system} />
          {system.index === 0 ? (
            <ClefControl
              clef={system.clef}
              selected={selection.kind === 'clef'}
              disabled={
                placementActive || Boolean(lyricMove) || transactionBlocked
              }
              onSelect={onSelectClef}
              onChange={onChangeClef}
              registerElement={(element) => {
                clefElement.current = element;
              }}
            />
          ) : !system.leadingClefChangeId ? (
            <path
              className="score__clef-ink"
              d={system.clef.path}
              aria-hidden="true"
              pointerEvents="none"
            />
          ) : null}
          {system.custodes.map((guide, i) => (
            <g key={i} aria-hidden="true" pointerEvents="none">
              {guide.ledgerLines ? (
                <>
                  <defs>
                    {/* A tiled run avoids enumerating arbitrarily distant pitches. */}
                    <pattern
                      id={`${ledgerId}-${system.index}-${i}`}
                      patternUnits="userSpaceOnUse"
                      viewBox={`0 0 ${guide.ledgerLines.x2 - guide.ledgerLines.x1} ${custosLedgerSpacing}`}
                      x={guide.ledgerLines.x1}
                      y={guide.ledgerLines.topY - custosLedgerThickness / 2}
                      width={guide.ledgerLines.x2 - guide.ledgerLines.x1}
                      height={custosLedgerSpacing}
                    >
                      <rect
                        width={guide.ledgerLines.x2 - guide.ledgerLines.x1}
                        height={custosLedgerThickness}
                        fill="currentColor"
                      />
                    </pattern>
                  </defs>
                  <rect
                    className="score__custos-ledgers"
                    data-ledger-count={guide.ledgerLines.count}
                    x={guide.ledgerLines.x1}
                    y={guide.ledgerLines.topY - custosLedgerThickness / 2}
                    width={guide.ledgerLines.x2 - guide.ledgerLines.x1}
                    height={
                      guide.ledgerLines.bottomY -
                      guide.ledgerLines.topY +
                      custosLedgerThickness
                    }
                    fill={`url(#${ledgerId}-${system.index}-${i})`}
                  />
                </>
              ) : null}
              <path
                className="score__custos"
                d={guide.path}
                data-custos-position={guide.staffPosition}
                data-outgoing={guide.outgoing}
              />
            </g>
          ))}

          {[
            ...system.clefChanges.map((clef) => ({
              type: 'clef' as const,
              clef,
              x: clef.bounds.x,
            })),
            ...system.neumes.map((neume) => ({
              type: 'neume' as const,
              neume,
              x: neume.bounds.x,
            })),
            ...system.divisions.map((division) => ({
              type: 'division' as const,
              division,
              x: division.bounds.x,
            })),
          ]
            .sort((a, b) => a.x - b.x)
            .map((item) => {
              if (item.type === 'clef') {
                const id = item.clef.clefChangeId;
                return (
                  <ClefControl
                    key={id}
                    draft={clefDraftPreview?.id === id}
                    clef={item.clef}
                    editingClef={
                      clefEdit?.id === id ? clefEdit.clef : undefined
                    }
                    changeId={id}
                    selected={
                      selection.kind === 'clef-change' &&
                      selection.clefChangeId === id
                    }
                    disabled={
                      placementActive ||
                      !!lyricMove ||
                      (transactionBlocked && clefEdit?.id !== id)
                    }
                    onSelect={() => onSelectClefChange(id)}
                    onStep={(direction) => onStepClefChange(id, direction)}
                    onDelete={() => onDeleteClefChange(id)}
                    registerElement={(element) => {
                      if (element) clefChangeElements.current.set(id, element);
                      else clefChangeElements.current.delete(id);
                    }}
                  />
                );
              }
              if (item.type === 'division') {
                const division = item.division;
                const selected =
                  selection.kind === 'division' &&
                  selection.divisionId === division.divisionId;
                return (
                  <DivisionControl
                    key={division.divisionId}
                    division={division}
                    selected={selected}
                    disabled={
                      placementActive ||
                      Boolean(lyricMove) ||
                      transactionBlocked
                    }
                    ordinal={
                      layout.systems
                        .flatMap((s) => s.divisions)
                        .findIndex(
                          (d) => d.divisionId === division.divisionId,
                        ) + 1
                    }
                    systemIndex={system.index}
                    registerElement={(element) => {
                      if (element)
                        divisionElements.current.set(
                          division.divisionId,
                          element,
                        );
                      else divisionElements.current.delete(division.divisionId);
                    }}
                    onSelectDivision={onSelectDivision}
                    onDeleteDivision={onDeleteDivision}
                  />
                );
              }
              const neume = item.neume;
              const isNeumeSelected =
                selection.kind === 'neume' &&
                selection.neumeId === neume.neumeId;
              const selectedDescription = getSelectedNeumeDescription(
                neume.kind,
                isNeumeSelected,
              );
              const selectedDescriptionId = `selected-neume-${neume.neumeId}`;
              const selectionGap = 5;
              const ownershipClip = neume.hitClip
                ? `url(#hit-clip-${neume.neumeId})`
                : undefined;
              // Ordinary padding is clipped to layout's ownership interval at
              // compact boundaries, including lyric reassignment destinations.
              const moveBounds = {
                x: neume.bounds.x - 7,
                y: neume.bounds.y - 7,
                width: neume.bounds.width + 14,
                height: neume.bounds.height + 14,
              };

              return (
                <g
                  key={neume.neumeId}
                  data-neume-id={neume.neumeId}
                  data-neume-kind={neume.kind}
                >
                  {neume.hitClip ? (
                    <defs>
                      <clipPath id={`hit-clip-${neume.neumeId}`}>
                        <rect
                          x={neume.hitClip.left}
                          y={neume.bounds.y - 20}
                          width={neume.hitClip.right - neume.hitClip.left}
                          height={neume.bounds.height + 40}
                        />
                      </clipPath>
                    </defs>
                  ) : null}
                  {selectedDescription ? (
                    <desc id={selectedDescriptionId}>
                      {selectedDescription}
                    </desc>
                  ) : null}
                  {isNeumeSelected ? (
                    <rect
                      className="score__neume-selection"
                      clipPath={ownershipClip}
                      data-selected-neume-id={neume.neumeId}
                      x={neume.bounds.x - selectionGap}
                      y={neume.bounds.y - selectionGap}
                      width={neume.bounds.width + selectionGap * 2}
                      height={neume.bounds.height + selectionGap * 2}
                      rx="4"
                      pointerEvents="none"
                      aria-hidden="true"
                    />
                  ) : null}
                  {placementActive &&
                  (isNeumeSelected ||
                    (selection.kind === 'note' &&
                      neume.notes.some(
                        (note) => note.noteId === selection.noteId,
                      ))) ? (
                    <rect
                      className="score__placement-context"
                      clipPath={ownershipClip}
                      x={neume.bounds.x - 7}
                      y={neume.bounds.y - 7}
                      width={neume.bounds.width + 14}
                      height={neume.bounds.height + 14}
                      rx="3"
                      pointerEvents="none"
                      aria-hidden="true"
                    />
                  ) : null}
                  {lyricMove &&
                  (lyricMove.legalIds.includes(neume.neumeId) ||
                    lyricMove.anchorId === neume.neumeId) ? (
                    <g pointerEvents="none" aria-hidden="true">
                      <rect
                        clipPath={ownershipClip}
                        className={`score__move-target${lyricMove.candidateId === neume.neumeId ? ' score__move-target--preview' : ''}`}
                        {...moveBounds}
                        rx="3"
                      />
                      <text
                        className="score__move-caption"
                        x={neume.bounds.x}
                        y={neume.bounds.y - 14}
                      >
                        {lyricMove.anchorId === neume.neumeId
                          ? 'Current anchor'
                          : lyricMove.candidateId === neume.neumeId
                            ? 'Preview'
                            : 'Legal'}
                      </text>
                    </g>
                  ) : null}
                  <NeumeInk ink={neume.ink} />
                  {neume.notes.map((note, noteIndex) => {
                    const isNoteSelected =
                      selection.kind === 'note' &&
                      selection.noteId === note.noteId;
                    const accessibleLabel =
                      getNoteAccessibleLabel(neume.kind, noteIndex) +
                      getNoteModifierDescription(
                        note,
                        neume.notes.filter((n) => n.mora).length === 2,
                      );

                    return (
                      <g
                        className="score__note"
                        key={note.noteId}
                        ref={(element) => {
                          if (element) {
                            noteElements.current.set(note.noteId, element);
                          } else {
                            noteElements.current.delete(note.noteId);
                          }
                        }}
                        data-note-id={note.noteId}
                        role="button"
                        tabIndex={
                          placementActive || transactionBlocked ? -1 : 0
                        }
                        pointerEvents={
                          placementActive || lyricMove || transactionBlocked
                            ? 'none'
                            : 'all'
                        }
                        aria-label={
                          lyricMove
                            ? `${accessibleLabel}. Neume ${system.startNeumeIndex + system.neumes.indexOf(neume) + 1}. ${lyricMove.anchorId === neume.neumeId ? 'Current anchor' : lyricMove.legalIds.includes(neume.neumeId) ? 'Legal destination' : 'Unavailable: occupied or crosses another anchor'}.${lyricMove.candidateId === neume.neumeId ? ' Previewed destination.' : ''}`
                            : accessibleLabel
                        }
                        aria-describedby={
                          lyricMove
                            ? 'lyric-move-help'
                            : `whole-neume-selection-instruction${isNeumeSelected ? ` ${selectedDescriptionId}` : ''}`
                        }
                        aria-pressed={isNoteSelected}
                        aria-disabled={placementActive || transactionBlocked}
                        onClick={(event) => handleNoteClick(event, note.noteId)}
                        onKeyDown={(event) =>
                          handleNoteKeyDown(
                            event,
                            note.noteId,
                            neume.neumeId,
                            isNoteSelected,
                            isNeumeSelected,
                          )
                        }
                      >
                        <g
                          aria-hidden="true"
                          clipPath={
                            neume.hitClip
                              ? `url(#hit-clip-${neume.neumeId})`
                              : undefined
                          }
                          pointerEvents={
                            placementActive || lyricMove
                              ? 'none'
                              : neume.kind === 'climacus' ||
                                  neume.kind === 'porrectus'
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
                            <InkShapeView
                              shape={note.head}
                              className="score__note-selection"
                            />
                          </g>
                        ) : null}
                      </g>
                    );
                  })}
                  {lyricMove ? (
                    <rect
                      className="score__move-hit-target"
                      {...moveBounds}
                      rx="3"
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth={
                        lyricMove.candidateId === neume.neumeId ? 3 : 2
                      }
                      pointerEvents="all"
                      clipPath={
                        neume.hitClip
                          ? `url(#hit-clip-${neume.neumeId})`
                          : undefined
                      }
                      aria-hidden="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        onMoveDestination(neume.neumeId);
                      }}
                    />
                  ) : null}
                </g>
              );
            })}

          <g aria-hidden="true" pointerEvents="none" className="score__hyphens">
            {system.hyphens.map((hyphen, index) => (
              <text
                key={index}
                x={hyphen.x}
                y={hyphen.y}
                fontFamily={lyricFontFamily}
                fontSize={lyricFontSize}
                textAnchor="middle"
                textRendering="geometricPrecision"
                data-outgoing={hyphen.outgoing}
              >
                -
              </text>
            ))}
          </g>
          {system.lyrics.map((lyric) => (
            <g key={lyric.syllableId} className="score__lyric-control">
              <g
                className={`score__lyric-group${selection.kind === 'syllable' && selection.syllableId === lyric.syllableId ? ' score__lyric-group--selected' : ''}`}
              >
                {selection.kind === 'syllable' &&
                selection.syllableId === lyric.syllableId &&
                lyric.left !== null &&
                lyric.right !== null ? (
                  <rect
                    className="score__lyric-selection"
                    x={lyric.left + Math.min(2, (lyric.right - lyric.left) / 2)}
                    y={lyric.y - lyric.fontSize}
                    width={Math.max(0, lyric.right - lyric.left - 4)}
                    height={lyric.fontSize * 1.3}
                    rx={1.5}
                    aria-hidden="true"
                    pointerEvents="none"
                  />
                ) : null}
                <text
                  className="score__lyric"
                  ref={(element) => {
                    if (element)
                      lyricElements.current.set(lyric.syllableId, element);
                    else lyricElements.current.delete(lyric.syllableId);
                  }}
                  role="button"
                  aria-describedby="lyric-focus-help"
                  tabIndex={
                    placementActive || lyricMove || transactionBlocked ? -1 : 0
                  }
                  aria-label={`Syllable: ${lyric.text}. Click or Space selects; L activates Lyrics here; double-click or Enter edits; Delete or Backspace removes focused lyrics; typing replaces; minus continues a word; Space starts a word; underscore skips.`}
                  aria-pressed={
                    selection.kind === 'syllable' &&
                    selection.syllableId === lyric.syllableId
                  }
                  aria-disabled={
                    placementActive || Boolean(lyricMove) || transactionBlocked
                  }
                  pointerEvents={
                    placementActive || lyricMove || transactionBlocked
                      ? 'none'
                      : 'all'
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!placementActive && !lyricMove && !transactionBlocked)
                      onSelectSyllable(lyric.syllableId);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (!placementActive && !lyricMove && !transactionBlocked)
                      onEditSyllable(lyric.syllableId);
                  }}
                  onKeyDown={(event) => {
                    if (lyricMove || transactionBlocked) return;
                    const action = getSyllableKeyAction(
                      event.nativeEvent,
                      selection.kind === 'syllable' &&
                        selection.syllableId === lyric.syllableId,
                      placementActive,
                    );
                    if (!action) return;
                    event.preventDefault();
                    event.stopPropagation();
                    switch (action.type) {
                      case 'select':
                        onSelectSyllable(lyric.syllableId);
                        break;
                      case 'edit':
                        onEditSyllable(lyric.syllableId);
                        break;
                      case 'replace':
                        onEditSyllable(lyric.syllableId, action.text);
                        break;
                      case 'delete':
                        onDeleteSyllable(lyric.syllableId);
                        break;
                      case 'advance':
                        onAdvanceLyric(action.key);
                        break;
                    }
                  }}
                  data-syllable-id={lyric.syllableId}
                  x={lyric.x}
                  y={lyric.y}
                  fontSize={lyric.fontSize}
                  fontFamily={lyricFontFamily}
                  textAnchor="middle"
                  textRendering="geometricPrecision"
                >
                  {lyric.text}
                </text>
              </g>
              <g
                className="score__lyric-focus-cue"
                aria-hidden="true"
                pointerEvents="none"
              >
                <path
                  d={`M${lyric.x - 5},${lyric.y - lyric.fontSize - 10} h10 l-5,6 Z`}
                />
                <text x={lyric.x} y={lyric.y + 22} textAnchor="middle">
                  Keyboard focus
                </text>
              </g>
            </g>
          ))}
        </g>
      ))}

      {clefPreview ? (
        <g
          ref={clefPreviewElement}
          className="score__clef-placement-preview"
          aria-hidden="true"
          pointerEvents="none"
          data-clef-type={clefPreview.clef.type}
          data-staff-line={clefPreview.clef.staffLine}
        >
          <g className="score__placement-caret">
            <line
              x1={clefPreview.caret.x}
              x2={clefPreview.caret.x}
              y1={clefPreview.caret.top}
              y2={clefPreview.caret.bottom}
            />
            <path
              d={`M${clefPreview.caret.x - 4},${clefPreview.caret.top} h8`}
            />
          </g>
          <path className="score__clef-ghost" d={clefPreview.clef.path} />
        </g>
      ) : null}
      {clefDraftPreview ? (
        <path
          className="score__clef-draft-preview"
          d={clefDraftPreview.clef.path}
          aria-hidden="true"
          pointerEvents="none"
        />
      ) : null}
      {divisionPreview ? (
        <g
          className="score__placement-preview"
          pointerEvents="none"
          aria-hidden="true"
        >
          <g className="score__placement-caret">
            <line
              x1={divisionPreview.caret.x}
              x2={divisionPreview.caret.x}
              y1={divisionPreview.caret.top}
              y2={divisionPreview.caret.bottom}
            />
            <path
              d={`M${divisionPreview.caret.x - 4},${divisionPreview.caret.top} h8`}
            />
          </g>
          <g className="score__placement-ghost">
            <DivisionInk division={divisionPreview.division} />
          </g>
        </g>
      ) : null}
      {placementPreview ? (
        <g
          className="score__placement-preview"
          pointerEvents="none"
          aria-hidden="true"
        >
          <g className="score__placement-caret">
            <line
              x1={placementPreview.caret.x}
              x2={placementPreview.caret.x}
              y1={placementPreview.caret.top}
              y2={placementPreview.caret.bottom}
            />
            <path
              d={`M${placementPreview.caret.x - 4},${placementPreview.caret.top} h8`}
            />
          </g>
          <g className="score__placement-ghost">
            <NeumeInk ink={placementPreview.ink} />
          </g>
          {placementPreview.caret.systemIndex !==
          placementPreview.pointerSystemIndex ? (
            <text
              className="score__placement-target"
              x="64"
              y={layout.systems[placementPreview.pointerSystemIndex].y + 208}
            >
              Insertion: system {placementPreview.caret.systemIndex + 1}
            </text>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
}

/** Committed four-line staff rendering. */
function SystemStaff({
  system,
}: {
  system: Pick<ChantSystemLayout, 'index' | 'staffLines'>;
}) {
  return (
    <>
      {system.staffLines.map((line, lineIndex) => (
        <line
          className="score__staff-line"
          key={`system-${system.index}-staff-line-${lineIndex}`}
          x1={line.x1}
          x2={line.x2}
          y1={line.y}
          y2={line.y}
        />
      ))}
    </>
  );
}

/**
 * Converts browser client coordinates to score-absolute SVG coordinates.
 * A missing or non-invertible screen transform safely cancels interaction.
 */
function getLocalPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): SvgPoint | null {
  const screenTransform = svg.getScreenCTM();

  if (!screenTransform) {
    return null;
  }

  try {
    const localPoint = new DOMPoint(clientX, clientY).matrixTransform(
      screenTransform.inverse(),
    );

    return Number.isFinite(localPoint.x) && Number.isFinite(localPoint.y)
      ? { x: localPoint.x, y: localPoint.y }
      : null;
  } catch {
    return null;
  }
}

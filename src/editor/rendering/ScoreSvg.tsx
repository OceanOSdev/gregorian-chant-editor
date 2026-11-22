import { rangeSelectionBounds } from './range-selection-bounds';
import { useVerticalEpisemaRasterization } from './use-vertical-episema-rasterization';
import {
  custosLedgerThickness,
  custosLedgerSpacing,
} from '../layout/custos-geometry';
import { visibleLedgerRun } from '../layout/ledger-lines';
import type { ClefPlacementPreview } from '../interaction/resolve-graphical-clef-placement';
import type { ClefGeometry } from '../layout/clef-geometry';
import type { ClefKeyboardCommand } from '../state/editor-session';
import { ClefControl } from './ClefControl';
import type { Clef } from '../domain/chant-document';
import { DivisionControl } from './DivisionControl';
import { DivisionInk } from './DivisionInk';
import type { DivisionLayout } from '../layout/division-geometry';
import { lyricFontFamily, lyricFontSize } from '../layout/lyric-text-metrics';
import {
  useId,
  useLayoutEffect,
  useRef,
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
  isPressGivenFocus,
  type PointerActivationHold,
} from '../interaction/pointer-activation-hold';
import { wholeNeumeSelectionInstruction } from './note-accessible-label';
import { getScoreAccessibleDescription } from './score-accessible-description';
import { NeumeInk } from './NeumeInk';
import { LyricControl, type LyricActions } from './LyricControl';
import {
  NeumeControl,
  type AccidentalPlacementTargets,
  type LyricMoveTarget,
  type NoteActions,
  type WrittenAccidentalActions,
} from './NeumeControl';
import { clampToBand, renderBandFor } from './render-band';

export interface SvgPoint {
  x: number;
  y: number;
}

interface ScoreSvgProps {
  accidentalTargetIds: readonly string[] | null;
  onAccidentalTarget: (id: string) => void;
  onFocusAccidentalProperties: () => boolean;
  onSelectAccidental: (id: string) => void;
  onDeleteAccidental: (id: string) => void;
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
  rangeIds?: ReadonlySet<string>;
  onExtendSelection?: (noteId: string, direction: -1 | 1) => void;
  activeTool: EditorTool;
  placementDescription: string;
  focusRequest: EditorFocusRequest | null;
  /** The editor's press-activation hold; press-given focus is not revealed. */
  pointerHold: PointerActivationHold;
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
  accidentalTargetIds,
  onAccidentalTarget,
  onFocusAccidentalProperties,
  onSelectAccidental,
  onDeleteAccidental,
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
  rangeIds,
  onExtendSelection,
  activeTool,
  placementDescription,
  focusRequest,
  pointerHold,
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
  // Prefix for this score's clip and pattern IDs.
  const scoreId = useId();
  // Distant but valid pitches: painted elements stop just outside each
  // system's resolved musical band (Stage 11A/11B rendering safeguard), whose
  // clip also bounds musical ink and pointer regions; geometry is unchanged.
  const bandFor = (system: ChantSystemLayout) =>
    renderBandFor(system.musicBand);
  const clefPreviewElement = useRef<SVGGElement>(null);
  const clefChangeElements = useRef(new Map<string, SVGGElement>());
  const clefElement = useRef<SVGGElement>(null);
  const scoreElement = useRef<SVGSVGElement>(null);
  useVerticalEpisemaRasterization(scoreElement);
  const lyricElements = useRef(new Map<string, SVGTextElement>());
  const divisionElements = useRef(new Map<string, SVGGElement>());
  const noteElements = useRef(new Map<string, SVGGElement>());
  // Reflow can reparent keyed controls between system groups. Track browser
  // focus separately from selection so measurement changes can restore that ID.
  const focusedEntity = useRef<{
    kind: 'note' | 'lyric' | 'division' | 'clef-change' | 'accidental';
    id: string;
    element: Element;
  } | null>(null);
  useLayoutEffect(() => {
    let revealFrame = 0;
    // A pointer press focuses its own visible target before release. Revealing
    // that focus would scroll the page under the held button, so the release
    // misses and the click never activates the control. The shared
    // press-activation hold keeps the pressed target until that press's click
    // has been dispatched (or the press is interrupted), and never longer, so
    // keyboard, programmatic and later focus always reveal (PR #107, #121).
    const track = (event: FocusEvent) => {
      cancelAnimationFrame(revealFrame);
      const target = event.target;
      if (
        !(target instanceof Element) ||
        !scoreElement.current?.contains(target)
      ) {
        focusedEntity.current = null;
        return;
      }
      const pointerFocus = isPressGivenFocus(pointerHold, target);
      if (
        target instanceof SVGElement &&
        target !== scoreElement.current &&
        !pointerFocus
      ) {
        // Native Tab/Shift+Tab may leave focus under sticky chrome. Let browser
        // traversal settle, then reveal only the still-focused mounted control.
        revealFrame = requestAnimationFrame(() => {
          if (target.isConnected && document.activeElement === target)
            focusAndReveal(target);
        });
      }
      const clefChangeId = target.getAttribute('data-clef-change-id');
      const divisionId = target.getAttribute('data-division-id');
      const noteId = target.getAttribute('data-note-id');
      const syllableId = target.getAttribute('data-syllable-id');
      const accidentalId = target.getAttribute('data-accidental-id');
      focusedEntity.current = accidentalId
        ? { kind: 'accidental', id: accidentalId, element: target }
        : clefChangeId
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
    return () => {
      cancelAnimationFrame(revealFrame);
      document.removeEventListener('focusin', track);
    };
  }, [pointerHold]);
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
      target.kind === 'accidental'
        ? scoreElement.current?.querySelector<SVGGElement>(
            `[data-accidental-id="${CSS.escape(target.id)}"]`,
          )
        : target.kind === 'clef-change'
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
    if (focusRequest.kind === 'accidental') {
      const element = scoreElement.current?.querySelector<SVGGElement>(
        `[data-accidental-id="${CSS.escape(focusRequest.accidentalId)}"]`,
      );
      if (element) focusAndReveal(element);
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

  /**
   * Registers a mounted note control. React calls this with `null` on every
   * ref swap (each render) and when it detaches a note, including before it
   * reparents one during reflow. Recording whether the outgoing element had
   * browser focus matters only in the detach case: it lets the restore effect
   * refocus the note by ID when no `focusin` reached the tracker (observed in
   * headless Firefox).
   */
  function registerNoteElement(noteId: string, element: SVGGElement | null) {
    if (element) {
      noteElements.current.set(noteId, element);
      return;
    }
    const previous = noteElements.current.get(noteId);
    if (previous && document.activeElement === previous)
      focusedEntity.current = { kind: 'note', id: noteId, element: previous };
    noteElements.current.delete(noteId);
  }

  function focusNote(noteId: string) {
    const element = noteElements.current.get(noteId);
    if (element) focusAndReveal(element);
  }

  // Semantic edit intents handed to the extracted controls. They forward to
  // the editor's callbacks unchanged; no control talks to the session itself.
  const noteActions: NoteActions = {
    onSelectNote,
    onSelectNeumeForNote,
    onExtendSelection,
    onMoveNote,
    onMoveNeume,
    onDeleteNote,
    onDeleteNeume,
    onFocusNoteModifiers,
  };
  const accidentalActions: WrittenAccidentalActions = {
    onSelectAccidental,
    onDeleteAccidental,
    onFocusAccidentalProperties,
  };
  const lyricActions: LyricActions = {
    onSelectSyllable,
    onEditSyllable,
    onDeleteSyllable,
    onAdvanceLyric,
  };
  const accidentalPlacement: AccidentalPlacementTargets | null =
    accidentalTargetIds
      ? { noteIds: accidentalTargetIds, onTarget: onAccidentalTarget }
      : null;

  function lyricMoveTargetFor(neumeId: string): LyricMoveTarget | null {
    if (!lyricMove) return null;
    return {
      status:
        lyricMove.anchorId === neumeId
          ? 'current-anchor'
          : lyricMove.legalIds.includes(neumeId)
            ? 'legal'
            : 'unavailable',
      previewed: lyricMove.candidateId === neumeId,
      onChoose: () => onMoveDestination(neumeId),
    };
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

  const placementSystem = placementPreview
    ? layout.systems[placementPreview.pointerSystemIndex]
    : undefined;

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
      <desc id="range-member-description">
        Member of selected passage. Individual note editing is unavailable.
      </desc>
      <desc id="whole-neume-selection-instruction">
        {wholeNeumeSelectionInstruction} When a note is selected, Tab opens its
        nearby properties. Escape in the properties closes them and returns to
        the note.
      </desc>

      {layout.systems.map((system) => {
        const band = bandFor(system);
        const musicClipId = `${scoreId}-music-${system.index}`;
        return (
          <g
            key={system.index}
            data-system-index={system.index}
            data-system-top={system.y}
            data-system-height={system.height}
            data-bottom-staff={system.bottomStaffY}
            data-lyric-baseline={system.lyricBaselineY}
            data-music-top={system.musicBand.top}
            data-music-bottom={system.musicBand.bottom}
          >
            <defs>
              <clipPath id={musicClipId}>
                <rect
                  x={layout.x}
                  y={system.musicBand.top}
                  width={layout.width}
                  height={system.musicBand.bottom - system.musicBand.top}
                />
              </clipPath>
            </defs>
            {(() => {
              const range = rangeSelectionBounds(system, rangeIds);
              if (!range) return null;
              // Drawn outside the system clip: clamp to the band itself.
              const bounds = clampToBand(range, system.musicBand);
              return (
                <rect
                  className="score__range-selection"
                  {...bounds}
                  rx={3}
                  fill="#e9ddf7"
                  pointerEvents="none"
                  aria-hidden="true"
                />
              );
            })()}
            {/* Musical ink, pointer regions and their overlays are clipped to
              the system's resolved band, inside its own box; lyrics and
              hyphens are outside the clip. */}
            <g
              className="score__system-music"
              clipPath={`url(#${musicClipId})`}
            >
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
              {system.custodes.map((guide, i) => {
                const run =
                  guide.ledgerLines &&
                  visibleLedgerRun(guide.ledgerLines, band.top, band.bottom);
                return (
                  <g key={i} aria-hidden="true" pointerEvents="none">
                    {guide.ledgerLines && run ? (
                      <>
                        <defs>
                          {/* A tiled run avoids enumerating arbitrarily distant pitches. */}
                          <pattern
                            id={`${scoreId}-${system.index}-${i}`}
                            patternUnits="userSpaceOnUse"
                            viewBox={`0 0 ${run.x2 - run.x1} ${custosLedgerSpacing}`}
                            x={run.x1}
                            y={run.topY - custosLedgerThickness / 2}
                            width={run.x2 - run.x1}
                            height={custosLedgerSpacing}
                          >
                            <rect
                              width={run.x2 - run.x1}
                              height={custosLedgerThickness}
                              fill="currentColor"
                            />
                          </pattern>
                        </defs>
                        <rect
                          className="score__custos-ledgers"
                          data-ledger-count={guide.ledgerLines.count}
                          data-painted-ledger-count={
                            run.count === guide.ledgerLines.count
                              ? undefined
                              : run.count
                          }
                          x={run.x1}
                          y={run.topY - custosLedgerThickness / 2}
                          width={run.x2 - run.x1}
                          height={
                            run.bottomY - run.topY + custosLedgerThickness
                          }
                          fill={`url(#${scoreId}-${system.index}-${i})`}
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
                );
              })}

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
                          if (element)
                            clefChangeElements.current.set(id, element);
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
                          else
                            divisionElements.current.delete(
                              division.divisionId,
                            );
                        }}
                        onSelectDivision={onSelectDivision}
                        onDeleteDivision={onDeleteDivision}
                      />
                    );
                  }
                  const neume = item.neume;
                  return (
                    <NeumeControl
                      key={neume.neumeId}
                      neume={neume}
                      ordinal={
                        system.startNeumeIndex +
                        system.neumes.indexOf(neume) +
                        1
                      }
                      musicBand={system.musicBand}
                      band={band}
                      ownershipClipId={`${scoreId}-hit-${neume.neumeId}`}
                      selection={selection}
                      inSelectedRange={rangeIds?.has(neume.neumeId) ?? false}
                      placementActive={placementActive}
                      transactionBlocked={transactionBlocked}
                      lyricMove={lyricMoveTargetFor(neume.neumeId)}
                      accidentalPlacement={accidentalPlacement}
                      noteActions={noteActions}
                      accidentalActions={accidentalActions}
                      registerNoteElement={registerNoteElement}
                      focusNote={focusNote}
                    />
                  );
                })}
            </g>

            <g
              aria-hidden="true"
              pointerEvents="none"
              className="score__hyphens"
            >
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
              <LyricControl
                key={lyric.syllableId}
                lyric={lyric}
                selected={
                  selection.kind === 'syllable' &&
                  selection.syllableId === lyric.syllableId
                }
                placementActive={placementActive}
                lyricMoveActive={Boolean(lyricMove)}
                transactionBlocked={transactionBlocked}
                actions={lyricActions}
                registerElement={(element) => {
                  if (element)
                    lyricElements.current.set(lyric.syllableId, element);
                  else lyricElements.current.delete(lyric.syllableId);
                }}
              />
            ))}
          </g>
        );
      })}

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
      {placementPreview && placementSystem ? (
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
            <NeumeInk
              ink={placementPreview.ink}
              ledgers={placementPreview.ledgers}
              band={bandFor(placementSystem)}
            />
          </g>
          {placementPreview.caret.systemIndex !==
          placementPreview.pointerSystemIndex ? (
            <text
              className="score__placement-target"
              x="64"
              y={placementSystem.y + placementSystem.height - 12}
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

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { appendLyricSyllable } from '../commands/append-lyric-syllable'
import { deleteNeume } from '../commands/delete-neume'
import { deleteNote } from '../commands/delete-note'
import { insertClivis } from '../commands/insert-clivis'
import { insertPodatus } from '../commands/insert-podatus'
import { insertPunctum } from '../commands/insert-punctum'
import { moveNeumeVertically } from '../commands/move-neume'
import { moveNoteVertically } from '../commands/move-note'
import { resolveSyllableNeumeInsertionIndex } from '../commands/resolve-syllable-neume-insertion'
import { resolveToolbarNeumeInsertion } from '../commands/resolve-toolbar-neume-insertion'
import { updateLyricSyllableText } from '../commands/update-lyric-syllable'
import {
  staffPosition,
  type ChantDocument,
  type ClivisNeume,
  type LyricSyllable,
  type PodatusNeume,
  type PunctumNeume,
} from '../domain/chant-document'
import { countNotes, findNeume, findNote } from '../domain/neume'
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement'
import {
  canInsertNotesInSingleSystem,
  canInsertPunctumInSingleSystem,
  layoutGraphicalPlacementPreview,
  layoutChant,
  type GraphicalNeumeKind,
} from '../layout/layout-chant'
import { ScoreSvg, type SvgPoint } from '../rendering/ScoreSvg'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import {
  isPlacementTool,
  placeClivisTool,
  placePodatusTool,
  placePunctumTool,
  selectTool,
  type EditorTool,
} from '../state/editor-tool'
import {
  clearSelection,
  reconcileSelection,
  resolveSelectionSyllableId,
  selectNeume,
  selectNote,
  type EditorSelection,
} from '../state/selection'

interface ChantEditorProps {
  document: ChantDocument
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function getPlacementKind(tool: EditorTool): GraphicalNeumeKind | null {
  if (tool.kind === 'place-punctum') {
    return 'punctum'
  }

  if (tool.kind === 'place-podatus') {
    return 'podatus'
  }

  if (tool.kind === 'place-clivis') {
    return 'clivis'
  }

  return null
}

export function ChantEditor({ document: initialDocument }: ChantEditorProps) {
  const [history, setHistory] = useState(() =>
    createDocumentHistory(initialDocument),
  )
  const [selection, setSelection] = useState<EditorSelection>(clearSelection)
  const [activeSyllableId, setActiveSyllableId] = useState<string | null>(
    initialDocument.syllables[0]?.id ?? null,
  )
  const [activeTool, setActiveTool] = useState<EditorTool>(selectTool)
  const [pendingFocusNoteId, setPendingFocusNoteId] = useState<string | null>(
    null,
  )
  const [hoveredScorePoint, setHoveredScorePoint] =
    useState<SvgPoint | null>(null)
  const [lyricDraft, setLyricDraft] = useState('')
  const [draftSyllableId, setDraftSyllableId] = useState<string | null>(null)
  const [committedLyricText, setCommittedLyricText] = useState('')
  const [pendingLyricInputFocus, setPendingLyricInputFocus] = useState(false)
  const skipNextLyricBlurCommit = useRef(false)
  const lyricInput = useRef<HTMLInputElement>(null)
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const layout = layoutChant(history.present)
  const selectedLocatedNote =
    selection.kind === 'note'
      ? findNote(history.present, selection.noteId)
      : null
  const activeSyllable = history.present.syllables.find(
    (syllable) => syllable.id === activeSyllableId,
  )
  const placementKind = getPlacementKind(activeTool)
  const resolvedPlacement =
    placementKind && hoveredScorePoint
      ? resolveGraphicalNeumePlacement(
          history.present,
          activeSyllable?.id ?? null,
          placementKind,
          hoveredScorePoint,
        )
      : null
  const placementPreview = resolvedPlacement
    ? layoutGraphicalPlacementPreview(
        history.present.neumes,
        resolvedPlacement,
      )
    : null
  const canInsertPunctum =
    Boolean(activeSyllable) &&
    canInsertPunctumInSingleSystem(countNotes(history.present.neumes))
  const canInsertTwoNoteNeume =
    Boolean(activeSyllable) &&
    canInsertNotesInSingleSystem(countNotes(history.present.neumes), 2)
  const displayedLyricDraft =
    activeSyllable?.id === draftSyllableId
      ? lyricDraft
      : (activeSyllable?.text ?? '')

  function returnToSelect() {
    setActiveTool(selectTool())
    setHoveredScorePoint(null)
  }

  function commitLyricDraft(text: string) {
    if (!activeSyllable || draftSyllableId !== activeSyllable.id) {
      return
    }

    setHistory((currentHistory) =>
      applyDocumentEdit(currentHistory, (document) =>
        updateLyricSyllableText(document, activeSyllable.id, text),
      ),
    )
    setLyricDraft(text)
    setCommittedLyricText(text)
  }

  function handleLyricKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitLyricDraft(event.currentTarget.value)
      return
    }

    if (event.key !== 'Escape' || !activeSyllable) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    skipNextLyricBlurCommit.current = true
    setLyricDraft(committedLyricText)
    setDraftSyllableId(activeSyllable.id)
  }

  function handleScoreSelection(
    nextSelection: EditorSelection,
    focusNoteId?: string,
  ) {
    const syllableId = resolveSelectionSyllableId(
      history.present,
      nextSelection,
    )

    if (!syllableId) {
      return
    }

    setSelection(nextSelection)
    setActiveSyllableId(syllableId)

    if (focusNoteId) {
      setPendingFocusNoteId(focusNoteId)
    }
  }

  function handleSelectNote(noteId: string) {
    handleScoreSelection(selectNote(noteId))
  }

  function handleSelectNeumeForNote(noteId: string) {
    const locatedNote = findNote(history.present, noteId)

    if (!locatedNote) {
      return
    }

    handleScoreSelection(selectNeume(locatedNote.neume.id), noteId)
  }

  function handleSelectSyllable(syllableId: string) {
    setActiveSyllableId(syllableId)
    setSelection(clearSelection())
  }

  function handleAddSyllable() {
    const syllableId = globalThis.crypto.randomUUID()
    const syllable: LyricSyllable = { id: syllableId, text: '' }

    setHistory((currentHistory) =>
      applyDocumentEdit(currentHistory, (document) =>
        appendLyricSyllable(document, syllable),
      ),
    )
    setActiveSyllableId(syllableId)
    setSelection(clearSelection())
    setPendingLyricInputFocus(true)
  }

  function handleAddPunctum() {
    if (!canInsertPunctum) {
      return
    }

    if (!activeSyllable) {
      return
    }

    const selectedActiveNote =
      selectedLocatedNote?.neume.lyricSyllableId === activeSyllable.id
        ? selectedLocatedNote
        : null
    const activeNeumeIndexes = history.present.neumes.flatMap(
      (neume, index) =>
        neume.lyricSyllableId === activeSyllable.id ? [index] : [],
    )
    const finalActiveNeumeIndex = activeNeumeIndexes.at(-1)
    const preferredIndex = selectedActiveNote
      ? selectedActiveNote.neumeIndex + 1
      : (finalActiveNeumeIndex ?? history.present.neumes.length) + 1
    const insertionIndex = resolveSyllableNeumeInsertionIndex(
      history.present,
      activeSyllable.id,
      preferredIndex,
    )

    if (insertionIndex === null) {
      return
    }

    const referenceNote =
      selectedActiveNote?.note ??
      (finalActiveNeumeIndex === undefined
        ? undefined
        : history.present.neumes[finalActiveNeumeIndex]?.notes.at(-1))

    const neumeId = globalThis.crypto.randomUUID()
    const noteId = globalThis.crypto.randomUUID()
    const punctum: PunctumNeume = {
      id: neumeId,
      kind: 'punctum',
      lyricSyllableId: activeSyllable.id,
      notes: [
        {
          id: noteId,
          staffPosition: referenceNote?.staffPosition ?? staffPosition(2),
        },
      ],
    }

    setHistory((currentHistory) =>
      applyDocumentEdit(currentHistory, (document) =>
        insertPunctum(document, punctum, insertionIndex),
      ),
    )
    setSelection(selectNote(noteId))
    setPendingFocusNoteId(noteId)
  }

  function handleAddPodatus() {
    if (!canInsertTwoNoteNeume || !activeSyllable) {
      return
    }

    const insertion = resolveToolbarNeumeInsertion(
      history.present,
      activeSyllable.id,
      selection.kind === 'note' ? selection.noteId : null,
      staffPosition(2),
    )

    if (!insertion) {
      return
    }

    const neumeId = globalThis.crypto.randomUUID()
    const lowerNoteId = globalThis.crypto.randomUUID()
    const upperNoteId = globalThis.crypto.randomUUID()
    const podatus: PodatusNeume = {
      id: neumeId,
      kind: 'podatus',
      lyricSyllableId: activeSyllable.id,
      notes: [
        {
          id: lowerNoteId,
          staffPosition: insertion.referenceStaffPosition,
        },
        {
          id: upperNoteId,
          staffPosition: staffPosition(
            insertion.referenceStaffPosition + 1,
          ),
        },
      ],
    }
    const insertedDocument = insertPodatus(
      history.present,
      podatus,
      insertion.insertionIndex,
    )

    if (insertedDocument === history.present) {
      return
    }

    setHistory(applyDocumentEdit(history, () => insertedDocument))
    setSelection(selectNote(lowerNoteId))
    setPendingFocusNoteId(lowerNoteId)
    returnToSelect()
  }

  function handleAddClivis() {
    if (!canInsertTwoNoteNeume || !activeSyllable) {
      return
    }

    const insertion = resolveToolbarNeumeInsertion(
      history.present,
      activeSyllable.id,
      selection.kind === 'note' ? selection.noteId : null,
      staffPosition(3),
    )

    if (!insertion) {
      return
    }

    const neumeId = globalThis.crypto.randomUUID()
    const upperNoteId = globalThis.crypto.randomUUID()
    const lowerNoteId = globalThis.crypto.randomUUID()
    const clivis: ClivisNeume = {
      id: neumeId,
      kind: 'clivis',
      lyricSyllableId: activeSyllable.id,
      notes: [
        {
          id: upperNoteId,
          staffPosition: insertion.referenceStaffPosition,
        },
        {
          id: lowerNoteId,
          staffPosition: staffPosition(
            insertion.referenceStaffPosition - 1,
          ),
        },
      ],
    }
    const insertedDocument = insertClivis(
      history.present,
      clivis,
      insertion.insertionIndex,
    )

    if (insertedDocument === history.present) {
      return
    }

    setHistory(applyDocumentEdit(history, () => insertedDocument))
    setSelection(selectNote(upperNoteId))
    setPendingFocusNoteId(upperNoteId)
    returnToSelect()
  }

  function handlePlaceNeume(kind: GraphicalNeumeKind, point: SvgPoint) {
    if (!activeSyllable) {
      return
    }

    const placement = resolveGraphicalNeumePlacement(
      history.present,
      activeSyllable.id,
      kind,
      point,
    )

    if (!placement) {
      return
    }

    let nextDocument: ChantDocument
    let firstNoteId: string

    if (placement.kind === 'punctum') {
      const [firstStaffPosition] = placement.staffPositions
      const neumeId = globalThis.crypto.randomUUID()

      firstNoteId = globalThis.crypto.randomUUID()
      const punctum: PunctumNeume = {
        id: neumeId,
        kind: placement.kind,
        lyricSyllableId: activeSyllable.id,
        notes: [
          {
            id: firstNoteId,
            staffPosition: firstStaffPosition,
          },
        ],
      }

      nextDocument = insertPunctum(
        history.present,
        punctum,
        placement.insertionIndex,
      )
    } else {
      const [firstStaffPosition, secondStaffPosition] =
        placement.staffPositions

      if (secondStaffPosition === undefined) {
        return
      }

      const neumeId = globalThis.crypto.randomUUID()

      firstNoteId = globalThis.crypto.randomUUID()
      const secondNoteId = globalThis.crypto.randomUUID()

      if (placement.kind === 'podatus') {
        const podatus: PodatusNeume = {
          id: neumeId,
          kind: placement.kind,
          lyricSyllableId: activeSyllable.id,
          notes: [
            {
              id: firstNoteId,
              staffPosition: firstStaffPosition,
            },
            {
              id: secondNoteId,
              staffPosition: secondStaffPosition,
            },
          ],
        }

        nextDocument = insertPodatus(
          history.present,
          podatus,
          placement.insertionIndex,
        )
      } else {
        const clivis: ClivisNeume = {
          id: neumeId,
          kind: placement.kind,
          lyricSyllableId: activeSyllable.id,
          notes: [
            {
              id: firstNoteId,
              staffPosition: firstStaffPosition,
            },
            {
              id: secondNoteId,
              staffPosition: secondStaffPosition,
            },
          ],
        }

        nextDocument = insertClivis(
          history.present,
          clivis,
          placement.insertionIndex,
        )
      }
    }

    if (nextDocument === history.present) {
      return
    }

    setHistory(applyDocumentEdit(history, () => nextDocument))
    returnToSelect()
    setSelection(selectNote(firstNoteId))
    setPendingFocusNoteId(firstNoteId)
  }

  useEffect(() => {
    const selectedSyllableId = resolveSelectionSyllableId(
      history.present,
      selection,
    )

    setSelection((currentSelection) =>
      reconcileSelection(history.present, currentSelection),
    )

    setActiveSyllableId((currentSyllableId) => {
      if (selectedSyllableId) {
        return selectedSyllableId
      }

      if (
        currentSyllableId &&
        history.present.syllables.some(
          (syllable) => syllable.id === currentSyllableId,
        )
      ) {
        return currentSyllableId
      }

      return history.present.syllables.at(-1)?.id ?? null
    })
  }, [history.present, selection])

  useEffect(() => {
    setLyricDraft(activeSyllable?.text ?? '')
    setDraftSyllableId(activeSyllable?.id ?? null)
    setCommittedLyricText(activeSyllable?.text ?? '')
    skipNextLyricBlurCommit.current = false
  }, [activeSyllable?.id, activeSyllable?.text])

  useEffect(() => {
    if (!pendingLyricInputFocus || !activeSyllable) {
      return
    }

    lyricInput.current?.focus()
    setPendingLyricInputFocus(false)
  }, [activeSyllable, pendingLyricInputFocus])

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()
      const usesCommandModifier = event.ctrlKey || event.metaKey
      const requestsUndo =
        usesCommandModifier && key === 'z' && !event.shiftKey
      const requestsRedo =
        (usesCommandModifier && key === 'z' && event.shiftKey) ||
        (event.ctrlKey && key === 'y')

      if (requestsUndo && canUndo) {
        event.preventDefault()
        setHistory(undoDocumentEdit)
      } else if (requestsRedo && canRedo) {
        event.preventDefault()
        setHistory(redoDocumentEdit)
      }
    }

    globalThis.document.addEventListener('keydown', handleHistoryShortcut)

    return () =>
      globalThis.document.removeEventListener(
        'keydown',
        handleHistoryShortcut,
      )
  }, [canRedo, canUndo])

  useEffect(() => {
    function handleSelectionEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      event.preventDefault()

      if (isPlacementTool(activeTool)) {
        returnToSelect()
      } else {
        setSelection(clearSelection())
      }
    }

    globalThis.document.addEventListener('keydown', handleSelectionEscape)

    return () =>
      globalThis.document.removeEventListener(
        'keydown',
        handleSelectionEscape,
      )
  }, [activeTool])

  return (
    <main className="chant-editor">
      <h1>{layout.title}</h1>
      <div className="editor-controls" aria-label="Editor controls">
        <button
          type="button"
          aria-label="Add punctum"
          disabled={!canInsertPunctum}
          onClick={handleAddPunctum}
        >
          Add punctum
        </button>
        <button
          type="button"
          disabled={!canInsertTwoNoteNeume}
          onClick={handleAddPodatus}
        >
          Add podatus
        </button>
        <button
          type="button"
          disabled={!canInsertTwoNoteNeume}
          onClick={handleAddClivis}
        >
          Add clivis
        </button>
        <button
          type="button"
          aria-label="Place punctum"
          aria-pressed={activeTool.kind === 'place-punctum'}
          disabled={!canInsertPunctum}
          onClick={() => setActiveTool(placePunctumTool())}
        >
          Place punctum
        </button>
        <button
          type="button"
          aria-label="Place podatus"
          aria-pressed={activeTool.kind === 'place-podatus'}
          disabled={!canInsertTwoNoteNeume}
          onClick={() => setActiveTool(placePodatusTool())}
        >
          Place podatus
        </button>
        <button
          type="button"
          aria-label="Place clivis"
          aria-pressed={activeTool.kind === 'place-clivis'}
          disabled={!canInsertTwoNoteNeume}
          onClick={() => setActiveTool(placeClivisTool())}
        >
          Place clivis
        </button>
        <button
          type="button"
          aria-label="Undo last edit"
          aria-keyshortcuts="Control+Z Meta+Z"
          disabled={!canUndo}
          onClick={() => setHistory(undoDocumentEdit)}
        >
          Undo
        </button>
        <button
          type="button"
          aria-label="Redo last undone edit"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          disabled={!canRedo}
          onClick={() => setHistory(redoDocumentEdit)}
        >
          Redo
        </button>
      </div>
      <section className="editor-lyrics" aria-labelledby="lyrics-heading">
        <h2 id="lyrics-heading">Lyrics</h2>
        <ol>
          {history.present.syllables.map((syllable, index) => {
            const position = index + 1
            const displayText = syllable.text || '(empty)'
            const accessibleText = syllable.text || 'empty'

            return (
              <li key={syllable.id}>
                <button
                  type="button"
                  aria-label={`Syllable ${position}: ${accessibleText}`}
                  aria-pressed={syllable.id === activeSyllable?.id}
                  onClick={() => handleSelectSyllable(syllable.id)}
                >
                  <span aria-hidden="true">{position}. </span>
                  {displayText}
                </button>
              </li>
            )
          })}
        </ol>
        <button type="button" onClick={handleAddSyllable}>
          Add syllable
        </button>
      </section>
      <section className="editor-properties" aria-label="Properties">
        <label htmlFor="lyric-syllable">Lyric syllable</label>
        <input
          ref={lyricInput}
          id="lyric-syllable"
          type="text"
          value={displayedLyricDraft}
          disabled={!activeSyllable}
          onChange={(event) => {
            skipNextLyricBlurCommit.current = false
            setLyricDraft(event.currentTarget.value)
            setDraftSyllableId(activeSyllable?.id ?? null)
          }}
          onKeyDown={handleLyricKeyDown}
          onBlur={(event) => {
            if (skipNextLyricBlurCommit.current) {
              skipNextLyricBlurCommit.current = false
              return
            }

            commitLyricDraft(event.currentTarget.value)
          }}
        />
      </section>
      <ScoreSvg
        layout={layout}
        placementPreview={placementPreview}
        selection={selection}
        activeTool={activeTool}
        pendingFocusNoteId={pendingFocusNoteId}
        onNoteFocusHandled={(noteId) =>
          setPendingFocusNoteId((currentNoteId) =>
            currentNoteId === noteId ? null : currentNoteId,
          )
        }
        onSelectNote={handleSelectNote}
        onSelectNeumeForNote={handleSelectNeumeForNote}
        onPlacementPointerMove={setHoveredScorePoint}
        onPlacementPointerLeave={() => setHoveredScorePoint(null)}
        onPlaceNeume={handlePlaceNeume}
        onMoveNote={(noteId, delta) =>
          setHistory((currentHistory) =>
            applyDocumentEdit(currentHistory, (currentDocument) =>
              moveNoteVertically(currentDocument, noteId, delta),
            ),
          )
        }
        onMoveNeume={(neumeId, delta) =>
          setHistory((currentHistory) =>
            applyDocumentEdit(currentHistory, (currentDocument) =>
              moveNeumeVertically(currentDocument, neumeId, delta),
            ),
          )
        }
        onDeleteNote={(noteId) => {
          setHistory((currentHistory) =>
            applyDocumentEdit(currentHistory, (currentDocument) =>
              deleteNote(currentDocument, noteId),
            ),
          )
          setSelection(clearSelection())
        }}
        onDeleteNeume={(neumeId) => {
          if (!findNeume(history.present, neumeId)) {
            return
          }

          setHistory((currentHistory) =>
            applyDocumentEdit(currentHistory, (currentDocument) =>
              deleteNeume(currentDocument, neumeId),
            ),
          )
          setSelection(clearSelection())
        }}
        onClearSelection={() => setSelection(clearSelection())}
      />
    </main>
  )
}

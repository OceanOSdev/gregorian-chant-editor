import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { appendLyricSyllable } from '../commands/append-lyric-syllable'
import { deleteNote } from '../commands/delete-note'
import { insertClivis } from '../commands/insert-clivis'
import { insertPodatus } from '../commands/insert-podatus'
import { insertPunctum } from '../commands/insert-punctum'
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
import { countNotes, findNote } from '../domain/neume'
import {
  canInsertNotesInSingleSystem,
  canInsertPunctumInSingleSystem,
  getSingleSystemPunctumPlacement,
  layoutChant,
} from '../layout/layout-chant'
import { ScoreSvg } from '../rendering/ScoreSvg'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import {
  placePunctumTool,
  selectTool,
  type EditorTool,
} from '../state/editor-tool'
import {
  clearSelection,
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

  function handleSelectNote(noteId: string) {
    const locatedNote = findNote(history.present, noteId)

    if (!locatedNote) {
      return
    }

    setSelection(selectNote(noteId))
    setActiveSyllableId(locatedNote.neume.lyricSyllableId)
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

    setHistory((currentHistory) =>
      applyDocumentEdit(currentHistory, (document) =>
        insertPodatus(document, podatus, insertion.insertionIndex),
      ),
    )
    setSelection(selectNote(lowerNoteId))
    setPendingFocusNoteId(lowerNoteId)
    setActiveTool(selectTool())
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

    setHistory((currentHistory) =>
      applyDocumentEdit(currentHistory, (document) =>
        insertClivis(document, clivis, insertion.insertionIndex),
      ),
    )
    setSelection(selectNote(upperNoteId))
    setPendingFocusNoteId(upperNoteId)
    setActiveTool(selectTool())
  }

  function handlePlacePunctum(x: number, y: number) {
    const placement = getSingleSystemPunctumPlacement(
      x,
      y,
      history.present.neumes,
    )

    if (!placement || !activeSyllable) {
      return
    }

    const insertionIndex = resolveSyllableNeumeInsertionIndex(
      history.present,
      activeSyllable.id,
      placement.neumeInsertionIndex,
    )

    if (insertionIndex === null) {
      return
    }

    const neumeId = globalThis.crypto.randomUUID()
    const noteId = globalThis.crypto.randomUUID()
    const punctum: PunctumNeume = {
      id: neumeId,
      kind: 'punctum',
      lyricSyllableId: activeSyllable.id,
      notes: [
        {
          id: noteId,
          staffPosition: placement.staffPosition,
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
    setActiveTool(selectTool())
  }

  useEffect(() => {
    const selectedDocumentNote =
      selection.kind === 'note'
        ? findNote(history.present, selection.noteId)
        : null

    setSelection((currentSelection) => {
      if (
        currentSelection.kind === 'note' &&
        !findNote(history.present, currentSelection.noteId)
      ) {
        return clearSelection()
      }

      return currentSelection
    })

    setActiveSyllableId((currentSyllableId) => {
      if (selectedDocumentNote) {
        return selectedDocumentNote.neume.lyricSyllableId
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
    if (activeTool.kind !== 'place-punctum') {
      return
    }

    function handlePlacementCancel(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      setActiveTool(selectTool())
    }

    globalThis.document.addEventListener('keydown', handlePlacementCancel)

    return () =>
      globalThis.document.removeEventListener(
        'keydown',
        handlePlacementCancel,
      )
  }, [activeTool.kind])

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
        selection={selection}
        activeTool={activeTool}
        pendingFocusNoteId={pendingFocusNoteId}
        onNoteFocusHandled={(noteId) =>
          setPendingFocusNoteId((currentNoteId) =>
            currentNoteId === noteId ? null : currentNoteId,
          )
        }
        onSelectNote={handleSelectNote}
        onPlacePunctum={({ x, y }) => handlePlacePunctum(x, y)}
        onMoveNote={(noteId, delta) =>
          setHistory((currentHistory) =>
            applyDocumentEdit(currentHistory, (currentDocument) =>
              moveNoteVertically(currentDocument, noteId, delta),
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
        onClearSelection={() => setSelection(clearSelection())}
      />
    </main>
  )
}

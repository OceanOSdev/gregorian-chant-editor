import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { deleteNote } from '../commands/delete-note'
import { insertPunctum } from '../commands/insert-punctum'
import { moveNoteVertically } from '../commands/move-note'
import { updateLyricSyllableText } from '../commands/update-lyric-syllable'
import {
  staffPosition,
  type ChantDocument,
  type Punctum,
} from '../domain/chant-document'
import {
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
  const [activeTool, setActiveTool] = useState<EditorTool>(selectTool)
  const [pendingFocusNoteId, setPendingFocusNoteId] = useState<string | null>(
    null,
  )
  const [lyricDraft, setLyricDraft] = useState('')
  const [draftSyllableId, setDraftSyllableId] = useState<string | null>(null)
  const skipNextLyricBlurCommit = useRef(false)
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const canInsertPunctum =
    history.present.syllables.length > 0 &&
    canInsertPunctumInSingleSystem(history.present.notes.length)
  const layout = layoutChant(history.present)
  const selectedNote =
    selection.kind === 'note'
      ? history.present.notes.find((note) => note.id === selection.noteId)
      : undefined
  const selectedSyllable = selectedNote
    ? history.present.syllables.find(
        (syllable) => syllable.id === selectedNote.lyricSyllableId,
      )
    : undefined
  const displayedLyricDraft =
    selectedSyllable?.id === draftSyllableId
      ? lyricDraft
      : (selectedSyllable?.text ?? '')

  function commitLyricDraft(text: string) {
    if (!selectedSyllable) {
      return
    }

    setHistory((currentHistory) =>
      applyDocumentEdit(currentHistory, (document) =>
        updateLyricSyllableText(document, selectedSyllable.id, text),
      ),
    )
    setLyricDraft(text)
    setDraftSyllableId(selectedSyllable.id)
  }

  function handleLyricKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitLyricDraft(event.currentTarget.value)
      return
    }

    if (event.key !== 'Escape' || !selectedSyllable) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    skipNextLyricBlurCommit.current = true
    setLyricDraft(selectedSyllable.text)
    setDraftSyllableId(selectedSyllable.id)
  }

  function handleAddPunctum() {
    if (!canInsertPunctum) {
      return
    }

    const selectedNoteIndex =
      selection.kind === 'note'
        ? history.present.notes.findIndex(
            (note) => note.id === selection.noteId,
          )
        : -1
    const referenceNote =
      selectedNoteIndex >= 0
        ? history.present.notes[selectedNoteIndex]
        : history.present.notes.at(-1)
    const firstSyllable = history.present.syllables[0]
    const lyricSyllableId =
      referenceNote?.lyricSyllableId ?? firstSyllable?.id

    if (!lyricSyllableId) {
      return
    }

    const noteId = globalThis.crypto.randomUUID()
    const punctum: Punctum = {
      id: noteId,
      kind: 'punctum',
      staffPosition: referenceNote?.staffPosition ?? staffPosition(2),
      lyricSyllableId,
    }
    const insertionIndex =
      selectedNoteIndex >= 0
        ? selectedNoteIndex + 1
        : history.present.notes.length

    setHistory((currentHistory) =>
      applyDocumentEdit(currentHistory, (document) =>
        insertPunctum(document, punctum, insertionIndex),
      ),
    )
    setSelection(selectNote(noteId))
    setPendingFocusNoteId(noteId)
  }

  function handlePlacePunctum(x: number, y: number) {
    const placement = getSingleSystemPunctumPlacement(
      x,
      y,
      history.present.notes.length,
    )

    if (!placement || history.present.syllables.length === 0) {
      return
    }

    const followingNote = history.present.notes[placement.insertionIndex]
    const precedingNote = history.present.notes[placement.insertionIndex - 1]
    const lyricSyllableId =
      followingNote?.lyricSyllableId ??
      precedingNote?.lyricSyllableId ??
      history.present.syllables[0]?.id

    if (!lyricSyllableId) {
      return
    }

    const noteId = globalThis.crypto.randomUUID()
    const punctum: Punctum = {
      id: noteId,
      kind: 'punctum',
      staffPosition: placement.staffPosition,
      lyricSyllableId,
    }

    setHistory((currentHistory) =>
      applyDocumentEdit(currentHistory, (document) =>
        insertPunctum(document, punctum, placement.insertionIndex),
      ),
    )
    setSelection(selectNote(noteId))
    setPendingFocusNoteId(noteId)
    setActiveTool(selectTool())
  }

  useEffect(() => {
    setSelection((currentSelection) => {
      if (
        currentSelection.kind === 'note' &&
        !history.present.notes.some(
          (note) => note.id === currentSelection.noteId,
        )
      ) {
        return clearSelection()
      }

      return currentSelection
    })
  }, [history.present])

  useEffect(() => {
    setLyricDraft(selectedSyllable?.text ?? '')
    setDraftSyllableId(selectedSyllable?.id ?? null)
    skipNextLyricBlurCommit.current = false
  }, [selectedSyllable?.id, selectedSyllable?.text])

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
      <section className="editor-properties" aria-label="Properties">
        <label htmlFor="lyric-syllable">Lyric syllable</label>
        <input
          id="lyric-syllable"
          type="text"
          value={displayedLyricDraft}
          disabled={!selectedSyllable}
          onChange={(event) => {
            skipNextLyricBlurCommit.current = false
            setLyricDraft(event.currentTarget.value)
            setDraftSyllableId(selectedSyllable?.id ?? null)
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
        onSelectNote={(noteId) => setSelection(selectNote(noteId))}
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

import { useEffect, useState } from 'react'
import { deleteNote } from '../commands/delete-note'
import { insertPunctum } from '../commands/insert-punctum'
import { moveNoteVertically } from '../commands/move-note'
import {
  staffPosition,
  type ChantDocument,
  type Punctum,
} from '../domain/chant-document'
import {
  canInsertPunctumInSingleSystem,
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
  const [pendingFocusNoteId, setPendingFocusNoteId] = useState<string | null>(
    null,
  )
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const canInsertPunctum =
    history.present.syllables.length > 0 &&
    canInsertPunctumInSingleSystem(history.present.notes.length)
  const layout = layoutChant(history.present)

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
      <ScoreSvg
        layout={layout}
        selection={selection}
        pendingFocusNoteId={pendingFocusNoteId}
        onNoteFocusHandled={(noteId) =>
          setPendingFocusNoteId((currentNoteId) =>
            currentNoteId === noteId ? null : currentNoteId,
          )
        }
        onSelectNote={(noteId) => setSelection(selectNote(noteId))}
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

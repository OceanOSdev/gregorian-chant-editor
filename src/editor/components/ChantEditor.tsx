import { useEffect, useState } from 'react'
import { deleteNote } from '../commands/delete-note'
import { moveNoteVertically } from '../commands/move-note'
import type { ChantDocument } from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
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
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const layout = layoutChant(history.present)

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
      <div className="editor-history-controls" aria-label="Edit history">
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

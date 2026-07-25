import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { appendLyricSyllable } from '../commands/append-lyric-syllable'
import { deleteNote } from '../commands/delete-note'
import { insertPunctum } from '../commands/insert-punctum'
import { moveNoteVertically } from '../commands/move-note'
import { resolveSyllableNoteInsertionIndex } from '../commands/resolve-syllable-note-insertion'
import { updateLyricSyllableText } from '../commands/update-lyric-syllable'
import {
  staffPosition,
  type ChantDocument,
  type LyricSyllable,
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
  const selectedNote =
    selection.kind === 'note'
      ? history.present.notes.find((note) => note.id === selection.noteId)
      : undefined
  const activeSyllable = history.present.syllables.find(
    (syllable) => syllable.id === activeSyllableId,
  )
  const canInsertPunctum =
    Boolean(activeSyllable) &&
    canInsertPunctumInSingleSystem(history.present.notes.length)
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
    const note = history.present.notes.find(
      (candidate) => candidate.id === noteId,
    )

    if (!note) {
      return
    }

    setSelection(selectNote(noteId))
    setActiveSyllableId(note.lyricSyllableId)
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

    const selectedNoteIndex = selectedNote
      ? history.present.notes.indexOf(selectedNote)
      : -1
    const selectedActiveNote =
      selectedNote?.lyricSyllableId === activeSyllable.id
        ? selectedNote
        : undefined
    const activeNoteIndexes = history.present.notes.flatMap((note, index) =>
      note.lyricSyllableId === activeSyllable.id ? [index] : [],
    )
    const finalActiveNoteIndex = activeNoteIndexes.at(-1)
    const preferredIndex = selectedActiveNote
      ? selectedNoteIndex + 1
      : (finalActiveNoteIndex ?? history.present.notes.length) + 1
    const insertionIndex = resolveSyllableNoteInsertionIndex(
      history.present,
      activeSyllable.id,
      preferredIndex,
    )

    if (insertionIndex === null) {
      return
    }

    const referenceNote =
      selectedActiveNote ??
      (finalActiveNoteIndex === undefined
        ? undefined
        : history.present.notes[finalActiveNoteIndex])

    const noteId = globalThis.crypto.randomUUID()
    const punctum: Punctum = {
      id: noteId,
      kind: 'punctum',
      staffPosition: referenceNote?.staffPosition ?? staffPosition(2),
      lyricSyllableId: activeSyllable.id,
    }

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

    if (!placement || !activeSyllable) {
      return
    }

    const insertionIndex = resolveSyllableNoteInsertionIndex(
      history.present,
      activeSyllable.id,
      placement.insertionIndex,
    )

    if (insertionIndex === null) {
      return
    }

    const noteId = globalThis.crypto.randomUUID()
    const punctum: Punctum = {
      id: noteId,
      kind: 'punctum',
      staffPosition: placement.staffPosition,
      lyricSyllableId: activeSyllable.id,
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
        ? history.present.notes.find((note) => note.id === selection.noteId)
        : undefined

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

    setActiveSyllableId((currentSyllableId) => {
      if (selectedDocumentNote) {
        return selectedDocumentNote.lyricSyllableId
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

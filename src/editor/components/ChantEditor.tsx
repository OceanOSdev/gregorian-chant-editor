import { useState } from 'react'
import type { ChantDocument } from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import { ScoreSvg } from '../rendering/ScoreSvg'
import {
  clearSelection,
  selectNote,
  type EditorSelection,
} from '../state/selection'

interface ChantEditorProps {
  document: ChantDocument
}

export function ChantEditor({ document }: ChantEditorProps) {
  const [selection, setSelection] = useState<EditorSelection>(clearSelection)
  const layout = layoutChant(document)

  return (
    <main className="chant-editor">
      <h1>{layout.title}</h1>
      <ScoreSvg
        layout={layout}
        selection={selection}
        onSelectNote={(noteId) => setSelection(selectNote(noteId))}
        onClearSelection={() => setSelection(clearSelection())}
      />
    </main>
  )
}

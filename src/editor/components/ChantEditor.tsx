import type { ChantDocument } from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import { ScoreSvg } from '../rendering/ScoreSvg'

interface ChantEditorProps {
  document: ChantDocument
}

export function ChantEditor({ document }: ChantEditorProps) {
  const layout = layoutChant(document)

  return (
    <main className="chant-editor">
      <h1>{layout.title}</h1>
      <ScoreSvg layout={layout} />
    </main>
  )
}

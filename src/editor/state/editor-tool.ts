export type EditorTool =
  | { kind: 'select' }
  | { kind: 'place-punctum' }
  | { kind: 'place-podatus' }
  | { kind: 'place-clivis' }
  | { kind: 'place-scandicus' }

export function selectTool(): EditorTool {
  return { kind: 'select' }
}

export function placePunctumTool(): EditorTool {
  return { kind: 'place-punctum' }
}

export function placePodatusTool(): EditorTool {
  return { kind: 'place-podatus' }
}

export function placeClivisTool(): EditorTool {
  return { kind: 'place-clivis' }
}

export function placeScandicusTool(): EditorTool {
  return { kind: 'place-scandicus' }
}

export function isPlacementTool(tool: EditorTool): boolean {
  return (
    tool.kind === 'place-punctum' ||
    tool.kind === 'place-podatus' ||
    tool.kind === 'place-clivis' ||
    tool.kind === 'place-scandicus'
  )
}

export type EditorTool =
  | { kind: 'select' }
  | { kind: 'place-punctum' }

export function selectTool(): EditorTool {
  return { kind: 'select' }
}

export function placePunctumTool(): EditorTool {
  return { kind: 'place-punctum' }
}

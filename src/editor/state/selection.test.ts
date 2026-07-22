import { describe, expect, it } from 'vitest'
import { clearSelection, selectNote } from './selection'

describe('selection', () => {
  it('represents an empty selection', () => {
    expect(clearSelection()).toEqual({ kind: 'none' })
  })

  it('selects a note by its stable semantic ID', () => {
    expect(selectNote('note-punctum-1')).toEqual({
      kind: 'note',
      noteId: 'note-punctum-1',
    })
  })
})

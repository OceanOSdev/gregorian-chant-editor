import { describe, expect, it } from 'vitest'
import { staffPosition, type ChantDocument } from '../domain/chant-document'
import { getSurvivingFocusNoteId } from './multi-system-editing'

const document: ChantDocument = {
  title: 'Test',
  clef: { type: 'c', staffLine: 3 },
  syllables: [{ id: 'syllable-1', text: 'Ky-' }],
  neumes: [{
    id: 'neume-1',
    kind: 'punctum',
    lyricSyllableId: 'syllable-1',
    notes: [{ id: 'note-1', staffPosition: staffPosition(2) }],
  }],
}

describe('multi-system focus targets', () => {
  it('restores only a grounded invoking note that survives', () => {
    expect(getSurvivingFocusNoteId(document, 'note-1')).toBe('note-1')
    expect(getSurvivingFocusNoteId(document, 'deleted')).toBeNull()
    expect(getSurvivingFocusNoteId(document, null)).toBeNull()
  })
})

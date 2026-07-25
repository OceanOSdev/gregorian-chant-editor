import { describe, expect, it } from 'vitest'
import {
  isPlacementTool,
  placeClivisTool,
  placePodatusTool,
  placePunctumTool,
  selectTool,
} from './editor-tool'

describe('editor tools', () => {
  it.each([
    { createTool: placePunctumTool, kind: 'place-punctum' },
    { createTool: placePodatusTool, kind: 'place-podatus' },
    { createTool: placeClivisTool, kind: 'place-clivis' },
  ])('constructs and recognizes $kind', ({ createTool, kind }) => {
    const tool = createTool()

    expect(tool).toEqual({ kind })
    expect(isPlacementTool(tool)).toBe(true)
  })

  it('does not recognize Select as a placement tool', () => {
    expect(isPlacementTool(selectTool())).toBe(false)
  })
})

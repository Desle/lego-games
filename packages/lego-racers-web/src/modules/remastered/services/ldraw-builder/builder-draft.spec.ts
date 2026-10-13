import { clearDraft, getStoredDraft, storeDraft } from './builder-draft.ts'
import type { BuilderPart } from './ldraw-builder.types.ts'

const part: BuilderPart = {
  colorCode: 4,
  position: [0, -24, 0],
  rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  partName: '3001.dat',
  commentLines: [],
}

describe('builder drafts', () => {
  afterEach(() => clearDraft('RRCM'))

  it('gives back the stored parts of an item', () => {
    // Arrange
    storeDraft('RRCM', [part])

    // Act
    const draft = getStoredDraft('RRCM')

    // Assert
    expect(draft?.parts).toEqual([part])
  })

  it('has nothing once cleared', () => {
    // Arrange
    storeDraft('RRCM', [part])

    // Act
    clearDraft('RRCM')

    // Assert
    expect(getStoredDraft('RRCM')).toBeNull()
  })

  it('ignores stored text that is not a draft', () => {
    // Arrange
    localStorage.setItem('ldraw-builder-draft:RRCM', '{"parts":[{"partName":3}]}')

    // Act
    const draft = getStoredDraft('RRCM')

    // Assert
    expect(draft).toBeNull()
  })
})

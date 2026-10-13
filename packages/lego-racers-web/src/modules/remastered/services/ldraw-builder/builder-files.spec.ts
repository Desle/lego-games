import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getBuilderSavePath, markBuilderItemDone, readBuilderProgress } from './builder-files.ts'

describe('getBuilderSavePath', () => {
  it('saves an item to the file already there, and refuses what is not an item', () => {
    // Arrange
    const existing = ['chassis/RRchas0.ldr']

    // Act
    const chassis = getBuilderSavePath({ itemId: 'chassis/rrchas0', text: '' }, existing)
    const unknown = getBuilderSavePath({ itemId: '../x', text: '' }, existing)
    const noItem = getBuilderSavePath({ path: 'RRCM.ldr', text: '' }, existing)

    // Assert
    expect(chassis).toBe('chassis/RRchas0.ldr')
    expect(unknown).toBeNull()
    expect(noItem).toBeNull()
  })
})

describe('markBuilderItemDone', () => {
  it('puts the item last in the progress, once', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-builder-'))
    markBuilderItemDone(root, { itemId: 'RRCM', text: '' })
    markBuilderItemDone(root, { itemId: 'chassis/rrchas0', text: '' })

    // Act
    const answer = markBuilderItemDone(root, { itemId: 'RRCM', text: '' })

    // Assert
    expect(answer).toEqual({ progress: { done: ['chassis/rrchas0', 'RRCM'] } })
    expect(readBuilderProgress(root)).toEqual(answer.progress)
  })
})

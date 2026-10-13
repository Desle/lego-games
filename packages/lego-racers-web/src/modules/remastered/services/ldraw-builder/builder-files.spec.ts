import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getBuilderItemPath,
  markBuilderItemDone,
  readBuilderProgress,
  unmarkBuilderItemDone,
} from './builder-files.ts'

describe('getBuilderItemPath', () => {
  it('saves an item to the file already there, and refuses what is not an item', () => {
    // Arrange
    const existing = ['chassis/RRchas0.ldr']

    // Act
    const chassis = getBuilderItemPath({ itemId: 'chassis/rrchas0', text: '' }, existing)
    const unknown = getBuilderItemPath({ itemId: '../x', text: '' }, existing)
    const noItem = getBuilderItemPath({ path: 'RRCM.ldr', text: '' }, existing)

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

describe('unmarkBuilderItemDone', () => {
  it('takes the removed item out of the progress and keeps the others in order', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-builder-'))
    markBuilderItemDone(root, { itemId: 'RRCM', text: '' })
    markBuilderItemDone(root, { itemId: 'powerups/BRICK', text: '' })
    markBuilderItemDone(root, { itemId: 'drivers/CAPTAIN', text: '' })

    // Act
    const answer = unmarkBuilderItemDone(root, { itemId: 'powerups/BRICK' })
    const notDone = unmarkBuilderItemDone(root, { itemId: 'particles/SMOKE' })

    // Assert
    expect(answer).toEqual({ progress: { done: ['RRCM', 'drivers/CAPTAIN'] } })
    expect(notDone).toEqual(answer)
    expect(readBuilderProgress(root)).toEqual(answer.progress)
  })
})

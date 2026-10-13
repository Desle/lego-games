import {
  createBuilderHistory,
  pushBuilderHistory,
  redoBuilderHistory,
  undoBuilderHistory,
} from './builder-history.ts'

const PART = {
  colorCode: 4,
  position: [0, 0, 0],
  rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  partName: '3001.dat',
  commentLines: [],
} as const

describe('builder history', () => {
  it('undoes and redoes a change', () => {
    // Arrange
    const changed = pushBuilderHistory(createBuilderHistory([]), [PART])

    // Act
    const undone = undoBuilderHistory(changed)
    const redone = redoBuilderHistory(undone)

    // Assert
    expect(undone.present).toEqual([])
    expect(redone.present).toEqual([PART])
  })

  it('forgets what was undone after a new change', () => {
    // Arrange
    const undone = undoBuilderHistory(pushBuilderHistory(createBuilderHistory([]), [PART]))

    // Act
    const changed = pushBuilderHistory(undone, [PART, PART])

    // Assert
    expect(redoBuilderHistory(changed)).toBe(changed)
  })
})

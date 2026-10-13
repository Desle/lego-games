import {
  addParts,
  getStudOffset,
  getStudStep,
  moveParts,
  removeParts,
  toggleIndex,
  turnParts,
} from './builder-editing.ts'

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const round = (values: readonly number[]) => values.map((value) => Number(value.toFixed(6)) + 0)
const createPart = (x: number, z: number) =>
  Object.freeze({
    colorCode: 4,
    position: [x, -24, z] as const,
    rotation: IDENTITY,
    partName: '3001.dat',
    commentLines: [],
  })

describe('builder editing', () => {
  it('moves and removes only the chosen parts', () => {
    // Arrange
    const parts = [createPart(0, 0), createPart(40, 0)]

    // Act
    const moved = moveParts(parts, [1], [20, -8, 0])
    const removed = removeParts(parts, [0])

    // Assert
    expect(moved.map((part) => part.position)).toEqual([
      [0, -24, 0],
      [60, -32, 0],
    ])
    expect(removed).toEqual([parts[1]])
  })

  it('turns a selection about its middle and back again', () => {
    // Arrange
    const parts = [createPart(-20, 0), createPart(20, 0)]

    // Act
    const turned = turnParts(parts, [0, 1], false)
    const back = turnParts(turned, [0, 1], true)

    // Assert
    expect(turned.map((part) => round(part.position))).toEqual([
      [0, -24, 20],
      [0, -24, -20],
    ])
    expect(back.map((part) => round(part.position))).toEqual([
      [-20, -24, 0],
      [20, -24, 0],
    ])
    expect(round(back[0]?.rotation ?? [])).toEqual(IDENTITY)
  })

  it('adds copies at the end and says where they went', () => {
    // Arrange
    const parts = [createPart(0, 0)]

    // Act
    const added = addParts(parts, parts, [20, 0, 0])

    // Assert
    expect(added.indices).toEqual([1])
    expect(added.parts[1]?.position).toEqual([20, -24, 0])
  })

  it('toggles a selection and snaps directions and drags to whole studs', () => {
    // Arrange
    const indices = [1, 2]

    // Act
    const toggled = [toggleIndex(indices, 2), toggleIndex(indices, 5)]
    const step = getStudStep([0.3, 0, -0.9])
    const offset = getStudOffset([0, 0, 0], [29, 5, -9])

    // Assert
    expect(toggled).toEqual([[1], [1, 2, 5]])
    expect(round(step)).toEqual([0, 0, -20])
    expect(round(offset)).toEqual([20, 0, 0])
  })
})

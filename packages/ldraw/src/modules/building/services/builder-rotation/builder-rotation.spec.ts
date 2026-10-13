import {
  multiplyRotations,
  rotateVector,
  turnQuarter,
} from '../builder-document/builder-document.ts'
import {
  getFacingRotation,
  getNearestAxis,
  getQuarterTurnAbout,
  PART_UP,
  turnAbout,
} from './builder-rotation.ts'

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const getTransposed = (rotation: readonly number[]) =>
  [0, 3, 6, 1, 4, 7, 2, 5, 8].map((index) => rotation[index] ?? 0)
const getIsValidTurn = (rotation: readonly number[]) =>
  rotation.every((value) => value === 0 || value === 1 || value === -1) &&
  multiplyRotations(rotation, getTransposed(rotation)).every(
    (value, index) => value === IDENTITY[index]
  )

describe('getQuarterTurnAbout', () => {
  it('makes a valid LDraw turn about each axis that comes back after four', () => {
    // Arrange
    const axes = [
      [1, 0, 0],
      [0, -1, 0],
      [0, 0, -1],
    ] as const

    // Act
    const turns = axes.map((axis) => getQuarterTurnAbout(axis))
    const fourTurns = axes.map((axis) =>
      [0, 1, 2, 3].reduce<readonly number[]>((rotation) => turnAbout(rotation, axis), IDENTITY)
    )

    // Assert
    expect(turns.every(getIsValidTurn)).toBe(true)
    expect(fourTurns).toEqual([IDENTITY, IDENTITY, IDENTITY])
  })

  it('turns about the vertical the way R does', () => {
    // Arrange
    const vertical = [0, 1, 0] as const

    // Act
    const turn = getQuarterTurnAbout(vertical)

    // Assert
    expect(turn).toEqual(turnQuarter(IDENTITY))
  })
})

describe('getFacingRotation', () => {
  it('points the studs along each axis with a valid turn', () => {
    // Arrange
    const directions = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0, 1, 0],
      [0, -1, 0],
    ] as const

    // Act
    const rotations = directions.map((direction) => getFacingRotation(IDENTITY, direction))

    // Assert
    expect(rotations.every(getIsValidTurn)).toBe(true)
    expect(
      rotations.map((rotation) => rotateVector(rotation, PART_UP).map((value) => value + 0))
    ).toEqual(directions)
    expect(rotations[5]).toEqual(IDENTITY)
  })

  it('keeps the spin a part had about the new direction', () => {
    // Arrange
    const spun = turnQuarter(IDENTITY)

    // Act
    const faced = getFacingRotation(spun, [0.02, 0, -0.98])

    // Assert
    expect(rotateVector(faced, PART_UP).map((value) => value + 0)).toEqual([0, 0, -1])
    expect(getIsValidTurn(faced)).toBe(true)
    expect(faced).not.toEqual(getFacingRotation(IDENTITY, [0, 0, -1]))
  })
})

describe('getNearestAxis', () => {
  it('snaps a direction to the nearest signed axis', () => {
    // Arrange
    const direction = [0.3, -0.2, -0.9] as const

    // Act
    const axis = getNearestAxis(direction)

    // Assert
    expect(axis).toEqual([0, 0, -1])
  })
})

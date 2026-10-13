import { Box3, Vector3 } from 'three'
import {
  getEmptyBuildArea,
  getPowerUpGridStuds,
  getPowerUpReferenceShape,
} from './builder-reference-shape.ts'
import { ReferenceShape } from './builder-reference.types.ts'

const createBox = (minimum: readonly number[], maximum: readonly number[]): Box3 =>
  new Box3(new Vector3().fromArray(minimum), new Vector3().fromArray(maximum))

const ROCKET = createBox([-1, -1, 0], [1, 1, 2])

describe('the power-up reference shape', () => {
  it('is solid for an opaque mesh with depth', () => {
    // Arrange
    const posed = ROCKET

    // Act
    const shape = getPowerUpReferenceShape(posed, ROCKET, false)

    // Assert
    expect(shape).toBe(ReferenceShape.SOLID)
  })

  it('is an effect when see-through, flat or with no posed triangle', () => {
    // Arrange
    const flat = createBox([-4, -4, 0], [4, 4, 1])

    // Act
    const shapes = [
      getPowerUpReferenceShape(ROCKET, ROCKET, true),
      getPowerUpReferenceShape(flat, flat, false),
      getPowerUpReferenceShape(new Box3(), ROCKET, false),
    ]

    // Assert
    expect(shapes).toEqual([ReferenceShape.EFFECT, ReferenceShape.EFFECT, ReferenceShape.EFFECT])
  })

  it('is none when nothing is shown', () => {
    // Arrange
    const empty = new Box3()

    // Act
    const shape = getPowerUpReferenceShape(empty, empty, false)

    // Assert
    expect(shape).toBe(ReferenceShape.NONE)
  })
})

describe('the power-up build grid', () => {
  it("covers the reference's footprint with a margin, at least eight studs, even", () => {
    // Arrange
    const wide = createBox([-5.5, -1, 0], [3, 1, 2])

    // Act
    const sides = [
      getPowerUpGridStuds(null),
      getPowerUpGridStuds(ROCKET),
      getPowerUpGridStuds(wide),
    ]

    // Assert
    expect(sides).toEqual([8, 8, 16])
  })

  it('frames a few studs for an empty power-up object and a car for anything else', () => {
    // Arrange
    const isPowerUp = true

    // Act
    const sizes = [getEmptyBuildArea(isPowerUp), getEmptyBuildArea(!isPowerUp)].map((box) =>
      box.getSize(new Vector3()).toArray()
    )

    // Assert
    expect(sizes).toEqual([
      [4, 4, 2],
      [8, 6, 3],
    ])
  })
})

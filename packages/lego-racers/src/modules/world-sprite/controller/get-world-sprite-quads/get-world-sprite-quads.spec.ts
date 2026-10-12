import type { SceneSprite } from '../../../scene/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { WorldSpriteCamera } from '../../types/world-sprite.types.ts'
import { getWorldSpriteQuads } from './get-world-sprite-quads.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const MATERIAL_NAMES = ['tree']
const LEVEL_CAMERA: WorldSpriteCamera = {
  position: { x: 0, y: 0, z: 0 },
  forward: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 0, z: -1 },
}
const PITCHED_CAMERA: WorldSpriteCamera = {
  position: { x: 0, y: 0, z: 0 },
  forward: { x: 0.6, y: 0, z: -0.8 },
  up: { x: -0.8, y: 0, z: -0.6 },
}

const createSprite = (overrides: Partial<SceneSprite>): SceneSprite => ({
  worldPath: 'TEST.WDB',
  materialIndex: 0,
  position: { x: 10, y: 0, z: 0 },
  axis: null,
  width: 4,
  height: 2,
  squaredDistance: Infinity,
  ...overrides,
})

const getCornerPositions = (sprite: SceneSprite, camera: WorldSpriteCamera, isMirrored = false) =>
  getWorldSpriteQuads(arithmetic, [sprite], MATERIAL_NAMES, camera, isMirrored).map((quad) =>
    quad.corners.map((corner) => [
      Math.round(corner.x * 1e4) / 1e4,
      Math.round(corner.y * 1e4) / 1e4,
      Math.round(corner.z * 1e4) / 1e4,
      corner.u,
      corner.v,
    ])
  )

describe('getWorldSpriteQuads', () => {
  it('centres a rectangle of the sprite size on the position, facing the camera', () => {
    // Arrange
    const sprite = createSprite({})

    // Act
    const quads = getCornerPositions(sprite, LEVEL_CAMERA)

    // Assert
    expect(quads).toEqual([
      [
        [10, 2, -1, 0, 1],
        [10, 2, 1, 0, 0],
        [10, -2, 1, 1, 0],
        [10, -2, -1, 1, 1],
      ],
    ])
  })

  it('names the quad after the sprite material', () => {
    // Arrange
    const sprite = createSprite({})

    // Act
    const quads = getWorldSpriteQuads(arithmetic, [sprite], MATERIAL_NAMES, LEVEL_CAMERA, false)

    // Assert
    expect(quads.map((quad) => quad.materialName)).toEqual(['tree'])
  })

  it('turns around its axis instead of tilting with a pitched camera', () => {
    // Arrange
    const sprite = createSprite({ axis: { x: 0, y: 0, z: 1 } })

    // Act
    const quads = getCornerPositions(sprite, PITCHED_CAMERA)

    // Assert
    expect(quads).toEqual([
      [
        [10, 2, -1, 0, 1],
        [10, 2, 1, 0, 0],
        [10, -2, 1, 1, 0],
        [10, -2, -1, 1, 1],
      ],
    ])
  })

  it('tilts a sprite without an axis with a pitched camera', () => {
    // Arrange
    const sprite = createSprite({})

    // Act
    const quads = getCornerPositions(sprite, PITCHED_CAMERA)

    // Assert
    expect(quads[0]?.[0]).toEqual([9.2, 2, -0.6, 0, 1])
  })

  it('draws nothing beyond the sprite distance, nor at the camera', () => {
    // Arrange
    const far = createSprite({ squaredDistance: 99 })
    const atCamera = createSprite({ position: { x: 0, y: 0, z: 0 } })
    const justWithin = createSprite({ squaredDistance: 100 })

    // Act
    const counts = [far, atCamera, justWithin].map(
      (sprite) => getCornerPositions(sprite, LEVEL_CAMERA).length
    )

    // Assert
    expect(counts).toEqual([0, 0, 1])
  })

  it('draws nothing for a sprite without a material', () => {
    // Arrange
    const sprite = createSprite({ materialIndex: null })

    // Act
    const quads = getCornerPositions(sprite, LEVEL_CAMERA)

    // Assert
    expect(quads).toEqual([])
  })

  it('negates y of the position in a mirrored race', () => {
    // Arrange
    const sprite = createSprite({ position: { x: 10, y: 5, z: 0 } })

    // Act
    const quads = getCornerPositions(sprite, LEVEL_CAMERA, true)

    // Assert
    expect(quads[0]?.[0]).toEqual([10, -3, -1, 0, 1])
  })
})

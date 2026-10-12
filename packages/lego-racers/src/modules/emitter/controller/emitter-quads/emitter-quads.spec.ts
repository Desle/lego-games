import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { EmitterSystem, Particle } from '../../types/emitter-pool.types.ts'
import { createIdleEmitterSystem } from '../emitter-system/emitter-system.ts'
import {
  getBillboardAxes,
  getEmitterQuadPixelArea,
  getIsEmitterQuadDrawn,
} from './emitter-quads.ts'
import { getEmitterQuads } from './emitter-quads.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const axes = { right: { x: 0, y: -1, z: 0 }, down: { x: 0, y: 0, z: -1 } }
const camera = { position: { x: 0, y: 0, z: 0 }, axes }

const createParticle = (isDrawable: boolean, x = 10): Particle => ({
  position: { x, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  ageMilliseconds: 100,
  lifetimeMilliseconds: 1000,
  tableIndex: null,
  isDrawable,
})

const createSystem = (overrides: Partial<EmitterSystem>): EmitterSystem => ({
  ...createIdleEmitterSystem(),
  isActive: true,
  firstFloat: 2,
  secondFloat: 4,
  squaredRadius: 10000,
  defaultMaterialName: 'smoke',
  particles: [createParticle(true)],
  ...overrides,
})

describe('getEmitterQuads', () => {
  it('puts the quad around the particle along the camera axes, with the picture from 0.01 to 0.98', () => {
    // Arrange
    const system = createSystem({})

    // Act
    const quads = getEmitterQuads(arithmetic, system, null, camera)

    // Assert
    expect(quads).toHaveLength(1)
    const corners = quads[0]?.corners.map((corner) => [corner.x, corner.y, corner.z]) ?? []
    expect(corners).toEqual([
      [10, 1, 2],
      [10, -1, 2],
      [10, -1, -2],
      [10, 1, -2],
    ])
    expect(quads[0]?.materialName).toBe('smoke')
    expect(quads[0]?.corners[2]?.u).toBeCloseTo(0.98)
  })

  it('draws nothing beyond the radius, for an inactive system or for a particle without a material', () => {
    // Arrange
    const far = createSystem({ squaredRadius: 99, framePosition: { x: 100, y: 0, z: 0 } })
    const inactive = createSystem({ isActive: false })
    const newborn = createSystem({ particles: [createParticle(false)] })

    // Act
    const results = [far, inactive, newborn].map((system) =>
      getEmitterQuads(arithmetic, system, null, camera)
    )

    // Assert
    expect(results.map((quads) => quads.length)).toEqual([0, 0, 0])
  })

  it('shrinks a moving system with the particle age and drops a size that is not above zero', () => {
    // Arrange
    const moving = createSystem({ isMoving: true, thirdFloat: -2, fourthFloat: -4 })
    const vanished = createSystem({
      isMoving: true,
      thirdFloat: -20,
      fourthFloat: -4,
    })

    // Act
    const shrunk = getEmitterQuads(arithmetic, moving, null, camera)
    const none = getEmitterQuads(arithmetic, vanished, null, camera)

    // Assert
    expect(shrunk[0]?.corners[0]?.y).toBeCloseTo(0.9)
    expect(none).toEqual([])
  })
})

describe('getBillboardAxes', () => {
  it('takes the right vector as up x forward and the down vector as the up it is given', () => {
    // Arrange
    const forward = { x: 1, y: 0, z: 0 }
    const up = { x: 0, y: 0, z: -1 }

    // Act
    const result = getBillboardAxes(arithmetic, forward, up)

    // Assert
    expect(result.right).toEqual({ x: 0, y: -1, z: 0 })
    expect(result.down).toBe(up)
  })
})

describe('getIsEmitterQuadDrawn', () => {
  const view = { position: { x: 0, y: 0, z: 0 }, forward: { x: 1, y: 0, z: 0 } }
  const getQuad = (side: number) =>
    ({
      materialName: 'snow',
      corners: [
        { x: 10, y: 0, z: 0, u: 0, v: 0 },
        { x: 10, y: side, z: 0, u: 1, v: 0 },
        { x: 10, y: side, z: side, u: 1, v: 1 },
        { x: 10, y: 0, z: side, u: 0, v: 1 },
      ],
    }) as const

  it('measures the pixels a billboard covers from its distance', () => {
    // Arrange
    const quad = getQuad(1)

    // Act
    const area = getEmitterQuadPixelArea(quad, view, 100)

    // Assert
    expect(area).toBeCloseTo(100)
  })

  it('draws a quad of 1.44 pixels across and drops one of 1.36 (measured)', () => {
    // Arrange
    const focalLengthPixels = 10

    // Act
    const isLargerDrawn = getIsEmitterQuadDrawn(getQuad(1.44), view, focalLengthPixels)
    const isSmallerDrawn = getIsEmitterQuadDrawn(getQuad(1.36), view, focalLengthPixels)

    // Assert
    expect(isLargerDrawn).toBe(true)
    expect(isSmallerDrawn).toBe(false)
  })
})

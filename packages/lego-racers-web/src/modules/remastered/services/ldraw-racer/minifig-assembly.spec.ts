import { Vector3 } from 'three'
import { LDRAW_HATS } from './ldraw-minifig-hats.ts'
import { createMinifigPartPlans, getDirectColor } from './minifig-assembly.ts'
import { MinifigPartKey, MinifigPosture } from './minifig-assembly.types.ts'
import type { MinifigSpec } from './minifig-spec.types.ts'

const HAT_COUNT = 36

const createSpec = (overrides: Partial<MinifigSpec> = {}): MinifigSpec => ({
  partBytes: [1, 0, 0, 0, 0],
  hat: LDRAW_HATS[1] ?? null,
  isHookTorso: false,
  isPegLegs: false,
  surfaces: {
    skinColor: 0xffdf00,
    torsoColor: 0xda1f1f,
    armColor: 0xda1f1f,
    hipsColor: 0x2d2d2d,
    legsColor: 0x0000ff,
    face: null,
    torso: null,
  },
  ...overrides,
})

const getPlanParts = (spec: MinifigSpec, posture: MinifigPosture) =>
  createMinifigPartPlans(spec, posture).map((plan) => `${plan.key}:${plan.part}`)

// Where the figure's own down (LDraw's +y, the way a hanging limb points) goes in a part's place.
const getHangingDirection = (key: MinifigPartKey, posture: MinifigPosture): Vector3 => {
  const plan = createMinifigPartPlans(createSpec(), posture).find((candidate) => candidate.key === key)
  if (plan === undefined) throw new Error(`The figure has no ${key}`)
  return new Vector3(0, 1, 0).transformDirection(plan.matrix)
}

describe('LDRAW_HATS', () => {
  it('has a place for each hat of the catalogue, the first being no hat', () => {
    // Arrange / Act
    const hats = LDRAW_HATS

    // Assert
    expect([hats.length, hats[0]]).toEqual([HAT_COUNT, null])
  })
})

describe('getDirectColor', () => {
  it('writes a colour as the library reads a direct one', () => {
    // Arrange / Act
    const color = getDirectColor(0x0a1b2c)

    // Assert
    expect(color).toBe('0x20A1B2C')
  })
})

describe('createMinifigPartPlans', () => {
  it('makes a minifigure of hips, legs, torso, head, hat, arms and hands', () => {
    // Arrange / Act
    const parts = getPlanParts(createSpec(), MinifigPosture.STANDING)

    // Assert
    expect(parts).toEqual([
      'hips:3815b',
      'left_leg:3817b',
      'right_leg:3816b',
      'torso:973',
      'head:3626b',
      'head:3842a',
      'left_arm:3819',
      'left_hand:3820',
      'right_arm:3818',
      'right_hand:3820',
    ])
  })

  it('leaves the hat out for a driver without one', () => {
    // Arrange / Act
    const parts = getPlanParts(createSpec({ hat: null }), MinifigPosture.STANDING)

    // Assert
    expect(parts.filter((part) => part.startsWith('head:'))).toEqual(['head:3626b'])
  })

  it('gives a hook torso a hook for its left hand and peg legs a wooden right leg', () => {
    // Arrange / Act
    const parts = getPlanParts(
      createSpec({ isHookTorso: true, isPegLegs: true }),
      MinifigPosture.STANDING
    )

    // Assert
    expect([parts.includes('left_hand:2531'), parts.includes('right_leg:2532')]).toEqual([
      true,
      true,
    ])
  })

  it('stretches the arms out sideways when standing and forward when seated', () => {
    // Arrange
    const standing = getHangingDirection(MinifigPartKey.LEFT_ARM, MinifigPosture.STANDING)
    const seated = getHangingDirection(MinifigPartKey.LEFT_ARM, MinifigPosture.SEATED)

    // Act
    const rounded = [Math.round(standing.x), Math.round(seated.z)]

    // Assert
    expect(rounded).toEqual([1, -1])
  })

  it('turns the legs forward about the hips when seated', () => {
    // Arrange
    const standing = getHangingDirection(MinifigPartKey.LEFT_LEG, MinifigPosture.STANDING)
    const seated = getHangingDirection(MinifigPartKey.LEFT_LEG, MinifigPosture.SEATED)

    // Act
    const rounded = [Math.round(standing.y), Math.round(seated.z)]

    // Assert
    expect(rounded).toEqual([1, -1])
  })
})

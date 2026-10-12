import { Vector3 } from 'three'
import { LDRAW_HATS, LDRAW_LEGS } from './ldraw-minifig-parts.ts'
import { createMinifigPartPlans, getDirectColor } from './minifig-assembly.ts'
import { MinifigPartKey, MinifigPosture } from './minifig-assembly.types.ts'
import type { MinifigSpec } from './minifig-spec.types.ts'

const PEG_LEGS_INDEX = 10

const createSpec = (overrides: Partial<MinifigSpec> = {}): MinifigSpec => ({
  partBytes: [1, 0, 0, 0, 0],
  hats: LDRAW_HATS[1]?.hats ?? [],
  face: null,
  torso: null,
  legs: null,
  isHookTorso: false,
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
  const plan = createMinifigPartPlans(createSpec(), posture).find(
    (candidate) => candidate.key === key
  )
  if (plan === undefined) throw new Error(`The figure has no ${key}`)
  return new Vector3(0, 1, 0).transformDirection(plan.matrix)
}

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
      'head:2447',
      'left_arm:3819',
      'left_hand:3820',
      'right_arm:3818',
      'right_hand:3820',
    ])
  })

  it('leaves the hat out for a driver without one', () => {
    // Arrange / Act
    const parts = getPlanParts(createSpec({ hats: [] }), MinifigPosture.STANDING)

    // Assert
    expect(parts.filter((part) => part.startsWith('head:'))).toEqual(['head:3626b'])
  })

  it('gives a hook torso a hook for its left hand and peg legs a wooden right leg', () => {
    // Arrange / Act
    const parts = getPlanParts(
      createSpec({ isHookTorso: true, legs: LDRAW_LEGS[PEG_LEGS_INDEX] ?? null }),
      MinifigPosture.STANDING
    )

    // Assert
    expect([parts.includes('left_hand:2531'), parts.includes('right_leg:2532')]).toEqual([
      true,
      true,
    ])
  })

  it('puts a printed head, torso and legs of the library in place of the plain parts, in the library colours', () => {
    // Arrange
    const spec = createSpec({
      face: { part: '3626bp3k', colorCode: 14 },
      torso: { part: '973p3h', torsoColorCode: 14, armColorCode: 14, handColorCode: 4 },
      legs: LDRAW_LEGS[13] ?? null,
    })

    // Act
    const plans = createMinifigPartPlans(spec, MinifigPosture.STANDING)

    // Assert
    expect(plans.map((plan) => `${plan.key}:${plan.part}:${String(plan.color)}`)).toEqual([
      'hips:3815b:2',
      'left_leg:3817cp3j:14',
      'right_leg:3816cp3j:14',
      'torso:973p3h:14',
      'head:3626bp3k:14',
      'head:3842a:0',
      'head:2447:40',
      'left_arm:3819:14',
      'left_hand:3820:4',
      'right_arm:3818:14',
      'right_hand:3820:4',
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

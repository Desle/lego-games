import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import {
  createExplosionPool,
  ExplosionState,
  getBlastImpulse,
  getPoolWithExplosion,
  getRecycledPool,
  getUpdatedExplosion,
  NORMAL_EXPLOSION_PARAMETERS,
} from './explosion.ts'
import type { BlastTarget } from './explosion.types.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const f = Math.fround
const ORIGIN = { x: 0, y: 0, z: 0 }

const getPool = (count = 2) => createExplosionPool(count, NORMAL_EXPLOSION_PARAMETERS)

const TARGET: BlastTarget = {
  isShielded: false,
  isStruckByLightning: false,
  isComputer: false,
  axis: { x: 1, y: 0, z: 0 },
}

describe('getPoolWithExplosion (0x0045b470, 0x00421520)', () => {
  it('starts an explosion from the free list at the head of the active list', () => {
    // Arrange
    const pool = getPool()

    // Act
    const first = getPoolWithExplosion(SINGLE, pool, { x: 1, y: 2, z: 3 }, true, 4)
    const second = getPoolWithExplosion(SINGLE, first, ORIGIN, false, null)

    // Assert
    expect(first.activeIndices).toEqual([0])
    expect(second.activeIndices).toEqual([1, 0])
    expect(first.explosions[0]).toMatchObject({
      state: ExplosionState.GROWING,
      position: { x: 1, y: 2, z: 3 },
      owner: 4,
      isGroundHit: true,
      remainingMilliseconds: 1000,
      progress: f(0.05),
    })
  })

  it('is not shown when further than 2048 units from the origin on an axis', () => {
    // Arrange / Act
    const pool = getPoolWithExplosion(SINGLE, getPool(), { x: 0, y: -2049, z: 0 }, false, null)

    // Assert
    expect(pool.explosions[0]?.state).toBe(ExplosionState.IDLE)
    expect(getRecycledPool(pool).freeIndices).toEqual([0, 1])
  })

  it('takes the fading explosion with the least time left when none is free (0x0045b3a0)', () => {
    // Arrange: two explosions, one fading with 300 ms, one growing.
    const full = getPoolWithExplosion(
      SINGLE,
      getPoolWithExplosion(SINGLE, getPool(), ORIGIN, true, null),
      ORIGIN,
      false,
      null
    )
    const fading = {
      ...full,
      explosions: [
        {
          ...(full.explosions[0] ?? NORMAL_EXPLOSION_PARAMETERS),
          state: ExplosionState.FADING,
          remainingMilliseconds: 300,
        },
        full.explosions[1],
      ],
    } as unknown as typeof full

    // Act
    const pool = getPoolWithExplosion(SINGLE, fading, { x: 9, y: 9, z: 9 }, false, 2)

    // Assert
    expect(pool.explosions[0]?.position).toEqual({ x: 9, y: 9, z: 9 })
    expect(pool.activeIndices).toEqual([0, 1])
  })
})

describe('getUpdatedExplosion (0x004217d0, 0x00421850)', () => {
  const growing = getPoolWithExplosion(SINGLE, getPool(), ORIGIN, true, null).explosions[0]

  it('grows with constant deceleration, one semi-implicit step at a time', () => {
    // Arrange
    if (growing === undefined) throw new Error('no explosion')

    // Act
    const first = getUpdatedExplosion(SINGLE, growing, 100)
    const second = getUpdatedExplosion(SINGLE, first, 100)

    // Assert: the rate is -2.1 * 0.1 + 2 = 1.79, the progress 1.79 * 0.1 + 0.05 = 0.229; the scale runs 0.1 to 5.
    expect(first.progressRate).toBeCloseTo(1.79, 5)
    expect(first.progress).toBeCloseTo(0.229, 5)
    expect(first.remainingMilliseconds).toBe(900)
    expect(second.progressRate).toBeCloseTo(1.58, 5)
    expect(second.progress).toBeCloseTo(0.387, 5)
    expect(second.scale).toBeCloseTo(0.1 + 4.9 * 0.387, 4)
  })

  it('leaves a scar for a ground burst, which fades for 5000 ms, and goes idle otherwise', () => {
    // Arrange
    if (growing === undefined) throw new Error('no explosion')
    const airburst = { ...growing, isGroundHit: false }

    // Act
    const scarred = getUpdatedExplosion(SINGLE, growing, 1000)
    const finished = getUpdatedExplosion(SINGLE, scarred, 5000)
    const gone = getUpdatedExplosion(SINGLE, airburst, 1000)

    // Assert: the fade starts in the same call and uses its time.
    expect(scarred).toMatchObject({ state: ExplosionState.FADING, remainingMilliseconds: 4000 })
    expect(finished.state).toBe(ExplosionState.IDLE)
    expect(gone.state).toBe(ExplosionState.IDLE)
  })
})

describe('getBlastImpulse (0x00421c00)', () => {
  const explosion = {
    ...(getPoolWithExplosion(SINGLE, getPool(), ORIGIN, false, 3).explosions[0] ??
      NORMAL_EXPLOSION_PARAMETERS),
  } as ReturnType<typeof getUpdatedExplosion>

  it('pushes 80 along the racer axis and lifts 200 at full strength', () => {
    // Arrange / Act
    const impulse = getBlastImpulse(SINGLE, explosion, 1, TARGET)

    // Assert
    expect(impulse).toEqual({ x: 80, y: 0, z: 200 })
  })

  it('weakens in the second half of the growth', () => {
    // Arrange: 250 of 1000 ms left, so the strength is 2 * 0.25 = 0.5.
    const late = { ...explosion, remainingMilliseconds: 250 }

    // Act
    const impulse = getBlastImpulse(SINGLE, late, 1, TARGET)

    // Assert
    expect(impulse).toEqual({ x: 40, y: 0, z: 100 })
  })

  it('does not hurt its owner, a shielded racer or a human struck by lightning', () => {
    // Arrange / Act
    const results = [
      getBlastImpulse(SINGLE, explosion, 3, TARGET),
      getBlastImpulse(SINGLE, explosion, 1, { ...TARGET, isShielded: true }),
      getBlastImpulse(SINGLE, explosion, 1, { ...TARGET, isStruckByLightning: true }),
      getBlastImpulse(SINGLE, explosion, 1, {
        ...TARGET,
        isStruckByLightning: true,
        isComputer: true,
      }),
    ]

    // Assert
    expect(results).toEqual([null, null, null, { x: 80, y: 0, z: 200 }])
  })
})

import { createEnum } from '../../../../shared/types/enum.types.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type {
  BlastTarget,
  Explosion,
  ExplosionParameters,
  ExplosionPool,
} from './explosion.types.ts'

// Explosion +0x04. The original's numbers are kept in the comments.
export const ExplosionState = createEnum({
  // 1: in its pool.
  IDLE: 'idle',
  // 2: growing.
  GROWING: 'growing',
  // 3: a ground burst's scar fading.
  FADING: 'fading',
})

// 0x00459b80: the "Explsn" pool, and the "spikexp" pool, which grows twice as large.
export const NORMAL_EXPLOSION_PARAMETERS: ExplosionParameters = Object.freeze({
  growthMilliseconds: 1000,
  scarMilliseconds: 5000,
  finalScale: 5,
  blastKind: 2,
})
export const SPIKED_EXPLOSION_PARAMETERS: ExplosionParameters = Object.freeze({
  ...NORMAL_EXPLOSION_PARAMETERS,
  finalScale: 10,
})
// 0x0045b9...: the pool sizes (power-ups.md): six explosions and two spiked ones.
export const NORMAL_EXPLOSION_COUNT = 6
export const SPIKED_EXPLOSION_COUNT = 2

// 0x004af220.
const SECONDS_PER_MILLISECOND = Math.fround(0.001)
// 0x004b014c: the growth starts at 0.05; 0x004b013c is the smallest scale.
const STARTING_PROGRESS = Math.fround(0.05)
const SMALLEST_SCALE = Math.fround(0.1)
// 0x004b0160: an explosion further than this from the origin on any axis is not shown or felt.
const WORLD_LIMIT = 2048
// 0x004b0150, 0x004b0154: the blast's push and lift.
const BLAST_PUSH = 80
const BLAST_LIFT = 200

const getIdleExplosion = (parameters: ExplosionParameters): Explosion =>
  Object.freeze({
    state: ExplosionState.IDLE,
    position: ZERO_VECTOR3,
    owner: null,
    isGroundHit: false,
    remainingMilliseconds: 0,
    progress: 0,
    progressRate: 0,
    startRate: 0,
    rateChange: 0,
    scale: 0,
    parameters,
  })

// 0x00459b80 builds the pool and chains the objects in index order.
export const createExplosionPool = (
  count: number,
  parameters: ExplosionParameters
): ExplosionPool =>
  Object.freeze({
    explosions: Object.freeze(Array.from({ length: count }, () => getIdleExplosion(parameters))),
    activeIndices: Object.freeze([]),
    freeIndices: Object.freeze(Array.from({ length: count }, (_, index) => index)),
  })

// 0x0045b3a0: with no free explosion, the fading one with the least time left goes, else the growing one with the
// least time left, else the newest.
const getStolenIndex = (pool: ExplosionPool): number => {
  for (const state of [ExplosionState.FADING, ExplosionState.GROWING]) {
    let best: number | null = null
    for (const index of pool.activeIndices) {
      const explosion = pool.explosions[index]
      const bestExplosion = best === null ? undefined : pool.explosions[best]
      if (
        explosion !== undefined &&
        explosion.state === state &&
        (bestExplosion === undefined ||
          explosion.remainingMilliseconds < bestExplosion.remainingMilliseconds)
      ) {
        best = index
      }
    }
    if (best !== null) return best
  }
  return pool.activeIndices[0] ?? 0
}

// 0x00421520: the explosion starts at the position unless that is outside the world.
const getStartedExplosion = (
  arithmetic: FloatArithmetic,
  explosion: Explosion,
  position: Vector3,
  isGroundHit: boolean,
  owner: number | null
): Explosion => {
  const { multiply, divide, add, subtract, storeFloat, getIsBelow } = arithmetic
  const isOutside = [position.x, position.y, position.z].some(
    (component) => getIsBelow(WORLD_LIMIT, component) || getIsBelow(component, -WORLD_LIMIT)
  )
  if (isOutside) return Object.freeze({ ...explosion, state: ExplosionState.IDLE })
  const growthSeconds = multiply(explosion.parameters.growthMilliseconds, SECONDS_PER_MILLISECOND)
  const inverse = divide(1, growthSeconds)
  const startRate = storeFloat(add(inverse, inverse))
  const slowdown = subtract(subtract(1, STARTING_PROGRESS), add(inverse, inverse))
  const rateChange = storeFloat(multiply(multiply(inverse, inverse), add(slowdown, slowdown)))
  return Object.freeze({
    ...explosion,
    state: ExplosionState.GROWING,
    position,
    owner,
    isGroundHit,
    remainingMilliseconds: explosion.parameters.growthMilliseconds,
    progress: STARTING_PROGRESS,
    progressRate: startRate,
    startRate,
    rateChange,
    scale: SMALLEST_SCALE,
  })
}

// 0x0045b470 and 0x0045b4f0: an explosion from the free list (or stolen) goes to the head of the active list.
export const getPoolWithExplosion = (
  arithmetic: FloatArithmetic,
  pool: ExplosionPool,
  position: Vector3,
  isGroundHit: boolean,
  owner: number | null
): ExplosionPool => {
  const freeIndex = pool.freeIndices[0]
  const index = freeIndex ?? getStolenIndex(pool)
  const explosion = pool.explosions[index]
  if (explosion === undefined) return pool
  const started = getStartedExplosion(arithmetic, explosion, position, isGroundHit, owner)
  return Object.freeze({
    explosions: Object.freeze(
      pool.explosions.map((current, currentIndex) => (currentIndex === index ? started : current))
    ),
    activeIndices: Object.freeze([
      index,
      ...pool.activeIndices.filter((activeIndex) => activeIndex !== index),
    ]),
    freeIndices: Object.freeze(pool.freeIndices.filter((candidate) => candidate !== index)),
  })
}

// 0x00421850 (state 2): the growth.
const getGrownExplosion = (
  arithmetic: FloatArithmetic,
  explosion: Explosion,
  stepMilliseconds: number
): Explosion => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  if (stepMilliseconds >= explosion.remainingMilliseconds) {
    if (explosion.isGroundHit) {
      return Object.freeze({
        ...explosion,
        state: ExplosionState.FADING,
        remainingMilliseconds: explosion.parameters.scarMilliseconds,
      })
    }
    return Object.freeze({ ...explosion, state: ExplosionState.IDLE })
  }
  const seconds = multiply(stepMilliseconds | 0, SECONDS_PER_MILLISECOND)
  const rate = add(multiply(explosion.rateChange, seconds), explosion.progressRate)
  const progress = add(multiply(rate, seconds), explosion.progress)
  return Object.freeze({
    ...explosion,
    remainingMilliseconds: explosion.remainingMilliseconds - stepMilliseconds,
    progressRate: storeFloat(rate),
    progress: storeFloat(progress),
    scale: storeFloat(
      add(
        multiply(subtract(explosion.parameters.finalScale, SMALLEST_SCALE), progress),
        SMALLEST_SCALE
      )
    ),
  })
}

// 0x004217d0 (thiscall: milliseconds): a growing explosion grows, and one that has started to fade fades in the
// same call.
export const getUpdatedExplosion = (
  arithmetic: FloatArithmetic,
  explosion: Explosion,
  stepMilliseconds: number
): Explosion => {
  const grown =
    explosion.state === ExplosionState.GROWING
      ? getGrownExplosion(arithmetic, explosion, stepMilliseconds)
      : explosion
  if (grown.state !== ExplosionState.FADING) return grown
  return grown.remainingMilliseconds <= stepMilliseconds
    ? Object.freeze({ ...grown, remainingMilliseconds: 0, state: ExplosionState.IDLE })
    : Object.freeze({
        ...grown,
        remainingMilliseconds: grown.remainingMilliseconds - stepMilliseconds,
      })
}

// The tail of PowerUps_Update: idle explosions go from the active list to the head of the free list, in list order.
export const getRecycledPool = (pool: ExplosionPool): ExplosionPool =>
  pool.activeIndices.reduce<ExplosionPool>((current, index) => {
    if (current.explosions[index]?.state !== ExplosionState.IDLE) return current
    return Object.freeze({
      explosions: current.explosions,
      activeIndices: Object.freeze(current.activeIndices.filter((active) => active !== index)),
      freeIndices: Object.freeze([index, ...current.freeIndices]),
    })
  }, pool)

// The impulse for car body slot 0x1c that throws a racer along its heading axis: 0x00421c00 scales it by the blast's
// power, 0x00455440 (the wand) by 1.
export const getThrowImpulse = (
  arithmetic: FloatArithmetic,
  axis: Vector3,
  power: number
): Vector3 => {
  const { add, multiply, storeFloat } = arithmetic
  const push = multiply(BLAST_PUSH, power)
  return Object.freeze({
    x: add(0, storeFloat(multiply(axis.x, push))),
    y: add(0, storeFloat(multiply(axis.y, push))),
    z: storeFloat(add(multiply(power, BLAST_LIFT), storeFloat(multiply(axis.z, push)))),
  })
}

// 0x00421c00 (the touch callback, kind 2): the explosion throws a racer it touches away. Returns the vector for car
// body slot 0x1c (0x00429a70), or null when the racer is not hurt. The racer's velocity is cleared and car body slot
// 0x38 (0x004397a0) called first.
export const getBlastImpulse = (
  arithmetic: FloatArithmetic,
  explosion: Explosion,
  racer: number,
  target: BlastTarget
): Vector3 | null => {
  const { add, divide, getIsBelowOrEqual, getIsBelow } = arithmetic
  if (explosion.parameters.blastKind === 0 || racer === explosion.owner || target.isShielded) {
    return null
  }
  if (target.isStruckByLightning && !target.isComputer) return null
  const { growthMilliseconds } = explosion.parameters
  let power = 1
  if (growthMilliseconds !== 0) {
    const quotient = divide(explosion.remainingMilliseconds, growthMilliseconds)
    const doubled = add(quotient, quotient)
    if (getIsBelowOrEqual(doubled, 1)) power = getIsBelow(doubled, 0) ? 0 : doubled
  }
  return getThrowImpulse(arithmetic, target.axis, power)
}

import { getMaterialAnimationRow } from '../../../material-animation/index.ts'
import type { MaterialAnimation } from '../../../material-animation/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getTruncatedInteger, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { EmitterSystem, Particle } from '../../types/emitter-pool.types.ts'
import type { Emitter } from '../../types/emitter.types.ts'

// FUN_00489520 calls FUN_00412430 with 16 particles.
export const PARTICLE_CAPACITY = 16
// 0x004af220 (0.001f) turns the elapsed milliseconds into seconds; 0x004af58c is 0.5f.
const SECONDS_PER_MILLISECOND = Math.fround(0.001)
const HALF = 0.5
const UINT32_MODULUS = 0x1_0000_0000

// FUN_00412430 and 0x00412970: a system that has never run.
export const createIdleEmitterSystem = (): EmitterSystem =>
  Object.freeze({
    particles: Object.freeze([]),
    capacity: PARTICLE_CAPACITY,
    isActive: false,
    isDying: false,
    isMoving: false,
    acceleration: ZERO_VECTOR3,
    entryIndex: null,
    firstFloat: 0,
    secondFloat: 0,
    thirdFloat: 0,
    fourthFloat: 0,
    squaredRadius: 0,
    bornCount: 0,
    framePosition: ZERO_VECTOR3,
  })

// 0x00412840: an active system drops its particles and its definition values; the born count stays.
export const getResetEmitterSystem = (system: EmitterSystem): EmitterSystem =>
  system.isActive
    ? Object.freeze({
        ...system,
        particles: Object.freeze([]),
        isActive: false,
        isDying: false,
        isMoving: false,
        entryIndex: null,
        firstFloat: 0,
        secondFloat: 0,
        thirdFloat: 0,
        fourthFloat: 0,
      })
    : system

// 0x00412820: the particles that are still alive finish their lives first.
export const getReleasedEmitterSystem = (system: EmitterSystem): EmitterSystem =>
  system.particles.length === 0
    ? getResetEmitterSystem(system)
    : Object.freeze({ ...system, isDying: true })

// 0x00412610 / 0x004125c0 and 0x00412660: the system takes the definition's values and becomes active.
export const getStartedEmitterSystem = (
  arithmetic: FloatArithmetic,
  system: EmitterSystem,
  emitter: Emitter
): EmitterSystem =>
  Object.freeze({
    ...system,
    particles: Object.freeze([]),
    entryIndex: emitter.entryIndex,
    firstFloat: emitter.firstFloat,
    secondFloat: emitter.secondFloat,
    thirdFloat: emitter.thirdFloat,
    fourthFloat: emitter.fourthFloat,
    isMoving: emitter.thirdFloat !== 0 || emitter.fourthFloat !== 0,
    acceleration: Object.freeze({
      x: emitter.vector[0],
      y: emitter.vector[1],
      z: emitter.vector[2],
    }),
    squaredRadius: arithmetic.storeFloat(
      arithmetic.multiply(emitter.fifthFloat, emitter.fifthFloat)
    ),
    bornCount: 0,
    isActive: true,
  })

// 0x00412a00: a free slot becomes the head of the live list; with none free the oldest live particle (the
// first of equal ages) is reused where it stands.
const getParticleIndexToFill = (system: EmitterSystem): number => {
  if (system.particles.length < system.capacity) return -1
  let oldest = 0
  system.particles.forEach((particle, index) => {
    const current = system.particles[oldest]
    if (current !== undefined && current.ageMilliseconds < particle.ageMilliseconds) oldest = index
  })
  return oldest
}

// 0x00412760: the particle starts at the offset of the emitter's position from the frame (the first particle
// puts the frame there), moving with `velocity`, for `lifetimeMilliseconds`.
export const getEmitterSystemWithBirth = (
  arithmetic: FloatArithmetic,
  system: EmitterSystem,
  emitterPosition: Vector3,
  velocity: Vector3,
  lifetimeMilliseconds: number
): EmitterSystem => {
  const { storeFloat, subtract } = arithmetic
  const framePosition = system.bornCount === 0 ? emitterPosition : system.framePosition
  const offset: Vector3 =
    system.bornCount === 0
      ? ZERO_VECTOR3
      : Object.freeze({
          x: storeFloat(subtract(emitterPosition.x, framePosition.x)),
          y: storeFloat(subtract(emitterPosition.y, framePosition.y)),
          z: storeFloat(subtract(emitterPosition.z, framePosition.z)),
        })
  const born: Particle = Object.freeze({
    position: offset,
    velocity,
    ageMilliseconds: 0,
    lifetimeMilliseconds,
    tableIndex: null,
  })
  const reusedIndex = getParticleIndexToFill(system)
  const particles =
    reusedIndex === -1
      ? [born, ...system.particles]
      : system.particles.map((particle, index) => (index === reusedIndex ? born : particle))
  return Object.freeze({
    ...system,
    framePosition,
    particles: Object.freeze(particles),
    bornCount: (system.bornCount + 1) >>> 0,
  })
}

// 0x00410560: the entry's rate times the age (an x87 product), truncated, selects the table row.
const getTableIndex = (
  arithmetic: FloatArithmetic,
  animation: MaterialAnimation,
  entryIndex: number,
  age: number
): number =>
  getMaterialAnimationRow(
    animation,
    entryIndex,
    getTruncatedInteger(
      arithmetic.multiply(animation.entries[entryIndex]?.keyword2aValue ?? 0, age)
    )
  )

// 0x00414600: position and velocity of one particle after `seconds` under the acceleration.
const getMovedParticle = (
  arithmetic: FloatArithmetic,
  particle: Particle,
  seconds: number,
  acceleration: Vector3
): Particle => {
  const { add, multiply, storeFloat } = arithmetic
  const half = multiply(seconds, HALF)
  const push = {
    x: storeFloat(multiply(seconds, acceleration.x)),
    y: storeFloat(multiply(seconds, acceleration.y)),
    z: storeFloat(multiply(seconds, acceleration.z)),
  }
  const { position, velocity } = particle
  return Object.freeze({
    ...particle,
    position: Object.freeze({
      x: storeFloat(add(add(multiply(velocity.x, seconds), multiply(push.x, half)), position.x)),
      y: storeFloat(add(add(multiply(velocity.y, seconds), multiply(push.y, half)), position.y)),
      z: storeFloat(add(add(multiply(velocity.z, seconds), multiply(push.z, half)), position.z)),
    }),
    velocity: Object.freeze({
      x: storeFloat(add(push.x, velocity.x)),
      y: storeFloat(add(push.y, velocity.y)),
      z: storeFloat(add(push.z, velocity.z)),
    }),
  })
}

// 0x00412890: every live particle ages by the milliseconds; those past their lifetime are freed, the others
// take their table row and move. A dying system with no particle left resets.
export const getAdvancedEmitterSystem = (
  arithmetic: FloatArithmetic,
  system: EmitterSystem,
  animation: MaterialAnimation | null,
  milliseconds: number
): EmitterSystem => {
  if (!system.isActive) return system
  if (system.particles.length === 0) return system.isDying ? getResetEmitterSystem(system) : system
  const seconds = arithmetic.storeFloat(arithmetic.multiply(milliseconds, SECONDS_PER_MILLISECOND))
  const particles = system.particles.flatMap((particle): readonly Particle[] => {
    const ageMilliseconds = (particle.ageMilliseconds + milliseconds) % UINT32_MODULUS
    if (ageMilliseconds > particle.lifetimeMilliseconds) return []
    const aged = Object.freeze({
      ...particle,
      ageMilliseconds,
      tableIndex:
        system.entryIndex === null || animation === null
          ? null
          : getTableIndex(arithmetic, animation, system.entryIndex, ageMilliseconds),
    })
    return [getMovedParticle(arithmetic, aged, seconds, system.acceleration)]
  })
  return Object.freeze({ ...system, particles: Object.freeze(particles) })
}

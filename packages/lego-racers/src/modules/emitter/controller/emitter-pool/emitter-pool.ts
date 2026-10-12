import { DuplicateNameError } from '../../../../shared/errors/gol-file-errors.ts'
import { drawRandomLowByte, drawRandomRemainder } from '../../../random-table/index.ts'
import type { FloatArithmetic, Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type {
  BirthProgress,
  EmitterHandle,
  EmitterInstance,
  EmitterPlacement,
  EmitterPool,
  EmitterPoolInput,
  EmitterPools,
  EmitterRandom,
  EmitterSpawn,
  EmitterUpdate,
  InstancePriority,
} from '../../types/emitter-pool.types.ts'
import type { Emitter } from '../../types/emitter.types.ts'
import {
  getEmitterBasis,
  getEmitterVelocity,
  IDENTITY_EMITTER_BASIS,
} from '../emitter-basis/emitter-basis.ts'
import {
  createIdleEmitterSystem,
  getAdvancedEmitterSystem,
  getEmitterSystemWithBirth,
  getReleasedEmitterSystem,
  getResetEmitterSystem,
  getStartedEmitterSystem,
} from '../emitter-system/emitter-system.ts'

// 0x00489d70 looks for a free handle among 100 slots.
export const EMITTER_HANDLE_COUNT = 100
// Names are compared over their first eight characters (0x004119a0).
const NAME_KEY_LENGTH = 8
const NO_LIFETIME = -1
const BYTE_MASK = 0xff
const UINT32_MODULUS = 0x1_0000_0000
// The priority a definition-less instance counts as (0x00489dd0).
const UNUSED_PRIORITY = 0

const getNameKey = (name: string): string => name.slice(0, NAME_KEY_LENGTH)

const createIdleInstance = (): EmitterInstance =>
  Object.freeze({
    definitionIndex: null,
    handleIndex: null,
    system: createIdleEmitterSystem(),
    velocityOffset: ZERO_VECTOR3,
    position: ZERO_VECTOR3,
    basis: IDENTITY_EMITTER_BASIS,
    millisecondsSinceBirth: 0,
    ageMilliseconds: 0,
  })

// Emitters_Load 0x00489af0 after the file: the definitions' names are registered (a repeat is fatal) and the
// pool's instances and handles are idle.
export const createEmitterPool = (input: EmitterPoolInput): EmitterPool => {
  const keys = new Set<string>()
  input.list.emitters.forEach((emitter) => {
    const key = getNameKey(emitter.name)
    if (keys.has(key)) throw new DuplicateNameError(emitter.name)
    keys.add(key)
  })
  return Object.freeze({
    list: input.list,
    instances: Object.freeze(Array.from({ length: input.instanceCount }, createIdleInstance)),
    handles: Object.freeze(
      Array.from({ length: EMITTER_HANDLE_COUNT }, (): EmitterHandle => IDLE_HANDLE)
    ),
    animation: input.animation,
  })
}

// A race with no emitter file has no pools.
export const NO_EMITTER_POOLS: EmitterPools = Object.freeze({ common: null, track: null })

const IDLE_HANDLE: EmitterHandle = Object.freeze({ isTaken: false, instanceIndex: null })

const getDefinitionIndex = (pool: EmitterPool, name: string): number => {
  const key = getNameKey(name)
  const index = pool.list.emitters.findIndex((emitter) => getNameKey(emitter.name) === key)
  if (index === -1) throw new RangeError(`${name}: the emitter pool has no such emitter`)
  return index
}

// 0x00489d50: the pool holds an emitter of this name (the hash lookup 0x004119a0 finds it).
export const getHasEmitterDefinition = (pool: EmitterPool, name: string): boolean => {
  const key = getNameKey(name)
  return pool.list.emitters.some((emitter) => getNameKey(emitter.name) === key)
}

const getDefinition = (pool: EmitterPool, instance: EmitterInstance): Emitter | null =>
  instance.definitionIndex === null ? null : (pool.list.emitters[instance.definitionIndex] ?? null)

const getPriority = (pool: EmitterPool, instance: EmitterInstance): number =>
  getDefinition(pool, instance)?.thirdInteger ?? UNUSED_PRIORITY

const getPoolWithInstance = (
  pool: EmitterPool,
  instanceIndex: number,
  instance: EmitterInstance
): EmitterPool =>
  Object.freeze({
    ...pool,
    instances: Object.freeze(
      pool.instances.map((current, index) => (index === instanceIndex ? instance : current))
    ),
  })

const getPoolWithHandle = (
  pool: EmitterPool,
  handleIndex: number,
  handle: EmitterHandle
): EmitterPool =>
  Object.freeze({
    ...pool,
    handles: Object.freeze(
      pool.handles.map((current, index) => (index === handleIndex ? handle : current))
    ),
  })

// 0x004896d0, with 0x00489540 and 0x00489660 for the placement: the instance starts the definition.
const getStartedInstance = (
  arithmetic: FloatArithmetic,
  pool: EmitterPool,
  instance: EmitterInstance,
  definitionIndex: number,
  placement: EmitterPlacement
): EmitterInstance => {
  const emitter = pool.list.emitters[definitionIndex]
  if (emitter === undefined) throw new RangeError(`No emitter ${String(definitionIndex)}`)
  return Object.freeze({
    ...instance,
    definitionIndex,
    system: getStartedEmitterSystem(arithmetic, instance.system, emitter),
    velocityOffset: ZERO_VECTOR3,
    basis:
      placement.orientation === null
        ? instance.basis
        : getEmitterBasis(arithmetic, placement.orientation.facing, placement.orientation.up),
    position: placement.position ?? instance.position,
    millisecondsSinceBirth: emitter.firstTruncatedValue >>> 0,
    ageMilliseconds: 0,
  })
}

// 0x004897a0: the instance stops at once, its particles vanish.
const getReleasedInstanceImmediately = (instance: EmitterInstance): EmitterInstance =>
  Object.freeze({
    ...instance,
    definitionIndex: null,
    handleIndex: null,
    system: getResetEmitterSystem(instance.system),
  })

// 0x004897c0: the instance stops making particles, those alive finish their lives.
const getReleasedInstance = (instance: EmitterInstance): EmitterInstance =>
  Object.freeze({
    ...instance,
    definitionIndex: null,
    handleIndex: null,
    system: getReleasedEmitterSystem(instance.system),
  })

const getFreeHandleIndex = (pool: EmitterPool): number =>
  pool.handles.findIndex((handle) => !handle.isTaken)

// The instance 0x00489d70 reuses when none is idle: the one with the lowest priority, the last of equals.
const getLeastImportantInstanceIndex = (pool: EmitterPool): InstancePriority =>
  pool.instances.reduce(
    (least, instance, index) => {
      const priority = getPriority(pool, instance)
      return priority <= least.priority ? { index, priority } : least
    },
    { index: -1, priority: BYTE_MASK }
  )

// 0x00489d70: a free handle and then an idle instance are needed; with every instance busy the one with the lowest
// priority is taken over when the new emitter has a higher one. A definition with a finite lifetime
// (`secondInteger`) runs without a handle.
export const spawnEmitter = (
  arithmetic: FloatArithmetic,
  pool: EmitterPool,
  name: string,
  placement: EmitterPlacement
): EmitterSpawn => {
  const definitionIndex = getDefinitionIndex(pool, name)
  const emitter = pool.list.emitters[definitionIndex]
  const handleIndex = getFreeHandleIndex(pool)
  if (emitter === undefined || handleIndex === -1) return Object.freeze({ pool, handleIndex: null })
  const idleIndex = pool.instances.findIndex((instance) => !instance.system.isActive)
  const least = getLeastImportantInstanceIndex(pool)
  const isTakingOver = idleIndex === -1
  if (isTakingOver && !(least.priority < emitter.thirdInteger)) {
    return Object.freeze({ pool, handleIndex: null })
  }
  const instanceIndex = isTakingOver ? least.index : idleIndex
  const taken = pool.instances[instanceIndex]
  if (taken === undefined) return Object.freeze({ pool, handleIndex: null })
  const unbound =
    isTakingOver && taken.handleIndex !== null
      ? getPoolWithHandle(pool, taken.handleIndex, {
          isTaken: true,
          instanceIndex: null,
        })
      : pool
  const released = isTakingOver ? getReleasedInstanceImmediately(taken) : taken
  const started = getStartedInstance(arithmetic, unbound, released, definitionIndex, placement)
  const isOneShot = emitter.secondInteger !== NO_LIFETIME
  const bound = isOneShot ? started : Object.freeze({ ...started, handleIndex })
  const poolWithInstance = getPoolWithInstance(unbound, instanceIndex, bound)
  if (isOneShot) return Object.freeze({ pool: poolWithInstance, handleIndex: null })
  return Object.freeze({
    pool: getPoolWithHandle(poolWithInstance, handleIndex, { isTaken: true, instanceIndex }),
    handleIndex,
  })
}

const getInstanceOfHandle = (pool: EmitterPool, handleIndex: number): number | null =>
  pool.handles[handleIndex]?.instanceIndex ?? null

const getPoolAfterHandleRelease = (
  pool: EmitterPool,
  handleIndex: number,
  release: (instance: EmitterInstance) => EmitterInstance
): EmitterPool => {
  const instanceIndex = getInstanceOfHandle(pool, handleIndex)
  const instance = instanceIndex === null ? undefined : pool.instances[instanceIndex]
  const withInstance =
    instanceIndex === null || instance === undefined
      ? pool
      : getPoolWithInstance(pool, instanceIndex, release(instance))
  return getPoolWithHandle(withInstance, handleIndex, IDLE_HANDLE)
}

// The handle's emitter (`*handle`), or null once the pool gave it to a newer one.
const getHandleInstance = (pool: EmitterPool, handleIndex: number): EmitterInstance | null => {
  const instanceIndex = getInstanceOfHandle(pool, handleIndex)
  return instanceIndex === null ? null : (pool.instances[instanceIndex] ?? null)
}

// `*handle != 0`: the handle still refers to an emitter.
export const getIsEmitterHandleLive = (pool: EmitterPool, handleIndex: number): boolean =>
  getHandleInstance(pool, handleIndex) !== null

// `*(uint *)(*handle + 0xf0)`: how many particles the handle's emitter has born since it started, or null while the
// handle refers to none.
export const getEmitterBornCount = (pool: EmitterPool, handleIndex: number): number | null =>
  getHandleInstance(pool, handleIndex)?.system.bornCount ?? null

// 0x00489f30: the owner lets go of its emitter; particles alive finish their lives.
export const releaseEmitter = (pool: EmitterPool, handleIndex: number): EmitterPool =>
  getPoolAfterHandleRelease(pool, handleIndex, getReleasedInstance)

// 0x00489f00: the owner lets go and the particles vanish at once.
export const releaseEmitterImmediately = (pool: EmitterPool, handleIndex: number): EmitterPool =>
  getPoolAfterHandleRelease(pool, handleIndex, getReleasedInstanceImmediately)

// 0x00489f60: every active emitter stops at once.
export const releaseAllEmitters = (pool: EmitterPool): EmitterPool =>
  Object.freeze({
    ...pool,
    instances: Object.freeze(
      pool.instances.map((instance) =>
        instance.system.isActive ? getReleasedInstanceImmediately(instance) : instance
      )
    ),
  })

// The handle's three setters 0x00489660, 0x00489540 and 0x00489690; a handle that refers to no instance (the
// original would write through a null pointer) is left alone.
const setInstance = (
  pool: EmitterPool,
  handleIndex: number,
  change: (instance: EmitterInstance) => EmitterInstance
): EmitterPool => {
  const instanceIndex = getInstanceOfHandle(pool, handleIndex)
  const instance = instanceIndex === null ? undefined : pool.instances[instanceIndex]
  return instanceIndex === null || instance === undefined
    ? pool
    : getPoolWithInstance(pool, instanceIndex, change(instance))
}

// 0x004af670.
const MILLISECONDS_PER_SECOND = 1000

export const setEmitterPosition = (
  pool: EmitterPool,
  handleIndex: number,
  position: Vector3
): EmitterPool => setInstance(pool, handleIndex, (instance) => ({ ...instance, position }))

// 0x0043e3fb and the like: the emitter's basis takes a frame's rotation as it is (frame slot +0x44).
export const setEmitterBasis = (
  pool: EmitterPool,
  handleIndex: number,
  basis: Matrix3
): EmitterPool => setInstance(pool, handleIndex, (instance) => ({ ...instance, basis }))

export const setEmitterOrientation = (
  arithmetic: FloatArithmetic,
  pool: EmitterPool,
  handleIndex: number,
  facing: Vector3,
  up: Vector3
): EmitterPool =>
  setInstance(pool, handleIndex, (instance) => ({
    ...instance,
    basis: getEmitterBasis(arithmetic, facing, up),
  }))

// 0x00489690: the vector, in units per millisecond, becomes the offset every particle's velocity (per second) gets.
export const setEmitterVelocityOffset = (
  arithmetic: FloatArithmetic,
  pool: EmitterPool,
  handleIndex: number,
  velocity: Vector3
): EmitterPool =>
  setInstance(pool, handleIndex, (instance) => ({
    ...instance,
    velocityOffset: Object.freeze({
      x: arithmetic.storeFloat(arithmetic.multiply(velocity.x, MILLISECONDS_PER_SECOND)),
      y: arithmetic.storeFloat(arithmetic.multiply(velocity.y, MILLISECONDS_PER_SECOND)),
      z: arithmetic.storeFloat(arithmetic.multiply(velocity.z, MILLISECONDS_PER_SECOND)),
    }),
  }))

// 0x004897e0 when the period has run out: the first draw's low byte must reach the chance, the second picks the
// definition point; the point becomes the velocity of a new particle.
const getInstanceAfterBirthPeriod = (
  arithmetic: FloatArithmetic,
  emitter: Emitter,
  instance: EmitterInstance,
  random: EmitterRandom
): BirthProgress => {
  const chance = drawRandomLowByte(random.table, random.position)
  if (chance.value < emitter.secondTruncatedValue) {
    return { instance: { ...instance, millisecondsSinceBirth: 0 }, position: chance.position }
  }
  const pick = drawRandomRemainder(random.table, chance.position, emitter.points.length)
  const point = emitter.points[pick.value] ?? [0, 0, 0]
  const velocity = getEmitterVelocity(
    arithmetic,
    instance.basis,
    { x: point[0], y: point[1], z: point[2] },
    instance.velocityOffset
  )
  return {
    instance: {
      ...instance,
      millisecondsSinceBirth: 0,
      system: getEmitterSystemWithBirth(
        arithmetic,
        instance.system,
        instance.position,
        velocity,
        emitter.firstInteger
      ),
    },
    position: pick.position,
  }
}

// 0x004897e0: one emitter's step. An emitter whose lifetime has run out is released and does nothing else.
const getInstanceAfterStep = (
  arithmetic: FloatArithmetic,
  pool: EmitterPool,
  instance: EmitterInstance,
  random: EmitterRandom,
  milliseconds: number
): BirthProgress => {
  const aged: EmitterInstance = {
    ...instance,
    millisecondsSinceBirth: (instance.millisecondsSinceBirth + milliseconds) % UINT32_MODULUS,
    ageMilliseconds: (instance.ageMilliseconds + milliseconds) % UINT32_MODULUS,
  }
  const emitter = getDefinition(pool, aged)
  if (emitter === null) {
    return {
      instance: advanceSystem(arithmetic, pool, aged, milliseconds),
      position: random.position,
    }
  }
  if (emitter.secondInteger >= 0 && emitter.secondInteger <= aged.ageMilliseconds) {
    return { instance: getReleasedInstance(aged), position: random.position }
  }
  const born =
    aged.millisecondsSinceBirth >= emitter.firstTruncatedValue >>> 0
      ? getInstanceAfterBirthPeriod(arithmetic, emitter, aged, random)
      : { instance: aged, position: random.position }
  return {
    instance: advanceSystem(arithmetic, pool, born.instance, milliseconds),
    position: born.position,
  }
}

const advanceSystem = (
  arithmetic: FloatArithmetic,
  pool: EmitterPool,
  instance: EmitterInstance,
  milliseconds: number
): EmitterInstance =>
  Object.freeze({
    ...instance,
    system: getAdvancedEmitterSystem(arithmetic, instance.system, pool.animation, milliseconds),
  })

// Emitters_Update 0x00489fa0: every active emitter steps, in index order, drawing from the random table.
export const updateEmitterPool = (
  arithmetic: FloatArithmetic,
  pool: EmitterPool,
  random: EmitterRandom,
  milliseconds: number
): EmitterUpdate => {
  let position = random.position
  const instances = pool.instances.map((instance) => {
    if (!instance.system.isActive) return instance
    const step = getInstanceAfterStep(
      arithmetic,
      pool,
      instance,
      { table: random.table, position },
      milliseconds
    )
    position = step.position
    return Object.freeze(step.instance)
  })
  return Object.freeze({
    pool: Object.freeze({ ...pool, instances: Object.freeze(instances) }),
    position,
  })
}

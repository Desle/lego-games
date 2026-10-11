import { DuplicateNameError } from '../../../../shared/errors/gol-file-errors.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { EmitterPlacement } from '../../types/emitter-pool.types.ts'
import type { Emitter } from '../../types/emitter.types.ts'
import {
  createEmitterPool,
  releaseAllEmitters,
  releaseEmitter,
  setEmitterPosition,
  spawnEmitter,
  updateEmitterPool,
} from './emitter-pool.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const NO_PLACEMENT: EmitterPlacement = Object.freeze({ position: null, orientation: null })

const createEmitter = (overrides: Partial<Emitter>): Emitter => ({
  name: 'spark',
  firstTruncatedValue: 100,
  secondTruncatedValue: 0,
  vector: [0, 0, -10],
  points: [
    [0, 0, 1],
    [1, 0, 0],
  ],
  firstFloat: 1,
  secondFloat: 1,
  thirdFloat: 0,
  fourthFloat: 0,
  fifthFloat: 10,
  entryIndex: null,
  firstInteger: 500,
  secondInteger: -1,
  thirdInteger: 1,
  linkedName: null,
  ...overrides,
})

const createPool = (emitters: readonly Emitter[], instanceCount: number) =>
  createEmitterPool({
    list: { emitters, readByteCount: 0 },
    instanceCount,
    animation: null,
  })

// Position `p` advances before the read: the first draw is values[p + 1].
const createRandom = (values: readonly number[], position = 0) => ({
  table: createRandomTable(Array.from({ length: 1024 }, (_, index) => values[index] ?? 0)),
  position,
})

describe('createEmitterPool', () => {
  it('refuses two definitions whose first eight characters agree', () => {
    // Arrange
    const emitters = [createEmitter({ name: 'abcdefgh1' }), createEmitter({ name: 'abcdefgh2' })]

    // Act
    const create = () => createPool(emitters, 2)

    // Assert
    expect(create).toThrow(DuplicateNameError)
  })
})

describe('spawnEmitter', () => {
  it('starts the emitter on an idle instance and returns a handle that refers to it', () => {
    // Arrange
    const pool = createPool([createEmitter({})], 2)

    // Act
    const spawn = spawnEmitter(arithmetic, pool, 'spark', {
      position: { x: 1, y: 2, z: 3 },
      orientation: null,
    })

    // Assert
    expect(spawn.handleIndex).toBe(0)
    expect(spawn.pool.handles[0]).toEqual({ isTaken: true, instanceIndex: 0 })
    expect(spawn.pool.instances[0]).toMatchObject({
      definitionIndex: 0,
      handleIndex: 0,
      position: { x: 1, y: 2, z: 3 },
      millisecondsSinceBirth: 100,
      ageMilliseconds: 0,
      system: { isActive: true, acceleration: { x: 0, y: 0, z: -10 } },
    })
  })

  it('runs an emitter with a finite lifetime without a handle', () => {
    // Arrange
    const pool = createPool([createEmitter({ secondInteger: 800 })], 1)

    // Act
    const spawn = spawnEmitter(arithmetic, pool, 'spark', NO_PLACEMENT)

    // Assert
    expect(spawn.handleIndex).toBeNull()
    expect(spawn.pool.instances[0]?.system.isActive).toBe(true)
    expect(spawn.pool.handles.every((handle) => !handle.isTaken)).toBe(true)
  })

  it('takes over the least important instance only for an emitter of a higher priority', () => {
    // Arrange
    const emitters = [
      createEmitter({ name: 'low', thirdInteger: 2 }),
      createEmitter({ name: 'same', thirdInteger: 2 }),
      createEmitter({ name: 'high', thirdInteger: 3 }),
    ]
    const full = spawnEmitter(
      arithmetic,
      spawnEmitter(arithmetic, createPool(emitters, 2), 'low', NO_PLACEMENT).pool,
      'low',
      NO_PLACEMENT
    ).pool

    // Act
    const refused = spawnEmitter(arithmetic, full, 'same', NO_PLACEMENT)
    const taken = spawnEmitter(arithmetic, full, 'high', NO_PLACEMENT)

    // Assert
    expect(refused.handleIndex).toBeNull()
    expect(taken.handleIndex).toBe(2)
    // The last of equals is the one taken over; the handle of the evicted instance stays taken but empty.
    expect(taken.pool.instances[1]?.definitionIndex).toBe(2)
    expect(taken.pool.instances[0]?.definitionIndex).toBe(0)
    expect(taken.pool.handles[1]).toEqual({ isTaken: true, instanceIndex: null })
  })

  it('gives no handle when the hundred slots are taken', () => {
    // Arrange
    const crowded = Array.from({ length: 100 }, () => 0).reduce(
      (pool) => spawnEmitter(arithmetic, pool, 'spark', NO_PLACEMENT).pool,
      createPool([createEmitter({})], 200)
    )

    // Act
    const spawn = spawnEmitter(arithmetic, crowded, 'spark', NO_PLACEMENT)

    // Assert
    expect(spawn.handleIndex).toBeNull()
    expect(spawn.pool).toBe(crowded)
  })
})

describe('updateEmitterPool', () => {
  const spawned = (emitter: Emitter) => {
    const spawn = spawnEmitter(arithmetic, createPool([emitter], 1), 'spark', {
      position: { x: 5, y: 0, z: 0 },
      orientation: null,
    })
    return spawn.pool
  }

  it('draws a chance and a point when the period is over, and bears a particle moving along the point', () => {
    // Arrange
    const pool = spawned(createEmitter({ secondTruncatedValue: 10 }))
    // Draws: 0x0111 (low byte 0x11 >= 10), then 3 (3 % 2 = point 1).
    const random = createRandom([0, 0x0111, 3])

    // Act
    const update = updateEmitterPool(arithmetic, pool, random, 16)

    // Assert
    const [instance] = update.pool.instances
    expect(update.position).toBe(2)
    expect(instance?.millisecondsSinceBirth).toBe(0)
    expect(instance?.system.particles).toHaveLength(1)
    expect(instance?.system.particles[0]).toMatchObject({
      velocity: { x: 1, y: 0, z: -0.1600000113248825 },
      lifetimeMilliseconds: 500,
    })
  })

  it('draws once and bears nothing when the low byte is below the chance', () => {
    // Arrange
    const pool = spawned(createEmitter({ secondTruncatedValue: 200 }))
    const random = createRandom([0, 0x0111, 3])

    // Act
    const update = updateEmitterPool(arithmetic, pool, random, 16)

    // Assert
    expect(update.position).toBe(1)
    expect(update.pool.instances[0]?.system.particles).toHaveLength(0)
    expect(update.pool.instances[0]?.millisecondsSinceBirth).toBe(0)
  })

  it('draws nothing while the period runs and ages the particles', () => {
    // Arrange
    const first = updateEmitterPool(
      arithmetic,
      spawned(createEmitter({})),
      createRandom([0, 5, 1]),
      16
    )
    const random = createRandom([], first.position)

    // Act
    const update = updateEmitterPool(arithmetic, first.pool, random, 32)

    // Assert
    expect(update.position).toBe(first.position)
    expect(update.pool.instances[0]?.millisecondsSinceBirth).toBe(32)
    expect(update.pool.instances[0]?.system.particles[0]).toMatchObject({ ageMilliseconds: 48 })
  })

  it('lets a particle fall under the acceleration', () => {
    // Arrange
    const born = updateEmitterPool(
      arithmetic,
      spawned(createEmitter({})),
      createRandom([0, 5, 0]),
      16
    )

    // Act
    const update = updateEmitterPool(arithmetic, born.pool, createRandom([], born.position), 1000)

    // Assert
    // The particle was born with velocity (0, 0, 1) and ages 16 + 1000 ms: past its 500 ms lifetime.
    expect(update.pool.instances[0]?.system.particles).toHaveLength(0)
  })

  it('moves a young particle by velocity times time plus half the acceleration times the square of time', () => {
    // Arrange
    const quiet = createEmitter({ firstTruncatedValue: 1000 })
    const born = updateEmitterPool(arithmetic, spawned(quiet), createRandom([0, 5, 0]), 16)

    // Act
    const update = updateEmitterPool(arithmetic, born.pool, createRandom([], born.position), 100)

    // Assert
    const particle = update.pool.instances[0]?.system.particles[0]
    expect(particle?.position.z).toBeCloseTo(0.016 - 0.00128 + 0.084 - 0.05, 5)
    expect(particle?.velocity.z).toBeCloseTo(1 - 0.16 - 1, 5)
  })

  it('releases an emitter whose lifetime is over before it does anything else', () => {
    // Arrange
    const pool = spawned(createEmitter({ secondInteger: 100, firstTruncatedValue: 10 }))

    // Act
    const update = updateEmitterPool(arithmetic, pool, createRandom([0, 5, 0]), 100)

    // Assert
    expect(update.position).toBe(0)
    expect(update.pool.instances[0]).toMatchObject({
      definitionIndex: null,
      system: { isActive: false },
    })
  })

  it('keeps a released emitter active until its last particle has died', () => {
    // Arrange
    const born = updateEmitterPool(
      arithmetic,
      spawned(createEmitter({})),
      createRandom([0, 5, 0]),
      16
    )
    const released = releaseEmitter(born.pool, 0)

    // Act
    const early = updateEmitterPool(arithmetic, released, createRandom([], born.position), 100)
    const late = updateEmitterPool(arithmetic, early.pool, createRandom([], born.position), 1000)

    // Assert
    expect(released.instances[0]?.system).toMatchObject({ isActive: true, isDying: true })
    expect(early.pool.instances[0]?.system.particles).toHaveLength(1)
    expect(late.pool.instances[0]?.system.particles).toHaveLength(0)
    expect(late.pool.instances[0]?.system.isActive).toBe(true)
    const final = updateEmitterPool(arithmetic, late.pool, createRandom([], born.position), 1)
    expect(final.pool.instances[0]?.system.isActive).toBe(false)
  })
})

describe('the handle setters and releases', () => {
  it('moves a running emitter and frees every emitter at once', () => {
    // Arrange
    const spawn = spawnEmitter(
      arithmetic,
      createPool([createEmitter({})], 2),
      'spark',
      NO_PLACEMENT
    )
    const handleIndex = spawn.handleIndex ?? -1

    // Act
    const moved = setEmitterPosition(spawn.pool, handleIndex, { x: 9, y: 8, z: 7 })
    const cleared = releaseAllEmitters(moved)

    // Assert
    expect(moved.instances[0]?.position).toEqual({ x: 9, y: 8, z: 7 })
    expect(cleared.instances.every((instance) => !instance.system.isActive)).toBe(true)
  })
})

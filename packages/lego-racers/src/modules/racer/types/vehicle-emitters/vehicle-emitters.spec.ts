import { createEmitterPool } from '../../../emitter/index.ts'
import type { Emitter, EmitterPool, EmitterPools } from '../../../emitter/index.ts'
import { createRacer, createRacerSet, getRacer } from '../racer-state/racer-state.ts'
import { createTestCarBody, createTestContext } from '../racer-fixtures/racer-fixtures.ts'
import type { Racer, RacerSet } from '../racer.types.ts'
import {
  clearVehicleWheelEmitter,
  setVehicleWheelEmitter,
  startVehicleDust,
  startVehicleTurboEffects,
  updateVehicleEmitters,
} from './vehicle-emitters.ts'

const COMPUTER_CONTROLLER = 2

const createEmitter = (name: string): Emitter => ({
  name,
  firstTruncatedValue: 100,
  secondTruncatedValue: 0,
  vector: [0, 0, 0],
  points: [[0, 0, 1]],
  firstFloat: 1,
  secondFloat: 1,
  thirdFloat: 0,
  fourthFloat: 0,
  fifthFloat: 10,
  entryIndex: null,
  firstInteger: 500,
  secondInteger: name === 'carland' ? 500 : -1,
  thirdInteger: 1,
  linkedName: null,
})

const createPool = (names: readonly string[]): EmitterPool =>
  createEmitterPool({
    list: { emitters: names.map(createEmitter), readByteCount: 0 },
    instanceCount: 6,
    animation: null,
  })

const createRacerSetWithPools = (pools: EmitterPools, change: Partial<Racer> = {}): RacerSet =>
  createRacerSet([{ ...createRacer(createTestCarBody()), controllerKind: 0, ...change }], 0, 0, pools)

const COMMON_NAMES = ['dust', 'carsmke', 'tiresmk', 'carland', 'grassemt'] as const
const context = createTestContext()

describe('the vehicle effects of a turbo start, 0x0043fd30', () => {
  it('starts the dust and the boost smoke of a racer that is not a computer', () => {
    // Arrange
    const racerSet = createRacerSetWithPools({ common: createPool(COMMON_NAMES), track: null })

    // Act
    const started = startVehicleTurboEffects(context, racerSet, 0)

    // Assert
    const { vehicle } = getRacer(started, 0)
    expect(vehicle.dustEmitter).toEqual({ isCommonPool: true, handleIndex: 0 })
    expect(vehicle.boostEmitter).toEqual({ isCommonPool: true, handleIndex: 1 })
    expect(vehicle.tireSmokeEmitter).toBeNull()
  })

  it('also starts the tire smoke when the previous turbo had a level', () => {
    // Arrange
    const racerSet = createRacerSetWithPools(
      { common: createPool(COMMON_NAMES), track: null },
      { turboLevel: 1 }
    )

    // Act
    const started = startVehicleTurboEffects(context, racerSet, 0)

    // Assert
    expect(getRacer(started, 0).vehicle.tireSmokeEmitter).toEqual({
      isCommonPool: true,
      handleIndex: 2,
    })
    expect(getRacer(started, 0).vehicle.flags & 0x8).toBe(0x8)
  })

  it('starts nothing for a computer', () => {
    // Arrange
    const racerSet = createRacerSetWithPools(
      { common: createPool(COMMON_NAMES), track: null },
      { controllerKind: COMPUTER_CONTROLLER }
    )

    // Act
    const started = startVehicleTurboEffects(context, racerSet, 0)

    // Assert
    expect(started).toBe(racerSet)
  })
})

describe('the wheels surface emitters, 0x0043dd50 and 0x0043de90', () => {
  it('takes the common pool when it holds the emitter, else the track pool', () => {
    // Arrange
    const racerSet = createRacerSetWithPools({
      common: createPool(COMMON_NAMES),
      track: createPool(['wizard']),
    })

    // Act
    const grass = setVehicleWheelEmitter(context, racerSet, 0, 0, 'grassemt')
    const wizard = setVehicleWheelEmitter(context, grass, 0, 1, 'wizard')

    // Assert
    const { vehicle } = getRacer(wizard, 0)
    expect(vehicle.wheelEmitters[0]).toEqual({ isCommonPool: true, handleIndex: 0 })
    expect(vehicle.wheelEmitters[1]).toEqual({ isCommonPool: false, handleIndex: 0 })
    expect(vehicle.wheelEmitterNames).toEqual(['grassemt', 'wizard', '', ''])
  })

  it('keeps an emitter of the same name and replaces one of another name at once', () => {
    // Arrange
    const racerSet = createRacerSetWithPools({ common: createPool(COMMON_NAMES), track: null })
    const grass = setVehicleWheelEmitter(context, racerSet, 0, 0, 'grassemt')

    // Act
    const same = setVehicleWheelEmitter(context, grass, 0, 0, 'grassemt')
    const replaced = setVehicleWheelEmitter(context, grass, 0, 0, 'dust')

    // Assert
    expect(same).toBe(grass)
    expect(getRacer(replaced, 0).vehicle.wheelEmitterNames[0]).toBe('dust')
    expect(replaced.emitters.common?.handles.filter((handle) => handle.isTaken)).toHaveLength(1)
  })

  it('clears an emitter and its name, and does nothing for a wheel without one', () => {
    // Arrange
    const racerSet = createRacerSetWithPools({ common: createPool(COMMON_NAMES), track: null })
    const grass = setVehicleWheelEmitter(context, racerSet, 0, 2, 'grassemt')

    // Act
    const cleared = clearVehicleWheelEmitter(grass, 0, 2)
    const untouched = clearVehicleWheelEmitter(grass, 0, 3)

    // Assert
    expect(getRacer(cleared, 0).vehicle.wheelEmitters[2]).toBeNull()
    expect(getRacer(cleared, 0).vehicle.wheelEmitterNames[2]).toBe('')
    expect(untouched).toBe(grass)
  })

  it('keeps the dust from starting while a rear wheel holds an emitter', () => {
    // Arrange
    const racerSet = createRacerSetWithPools({ common: createPool(COMMON_NAMES), track: null })
    const grass = setVehicleWheelEmitter(context, racerSet, 0, 3, 'grassemt')

    // Act
    const dusted = startVehicleDust(context, grass, 0)

    // Assert
    expect(getRacer(dusted, 0).vehicle.dustEmitter).toBeNull()
  })
})

describe('the vehicle effects of Vehicle_Update, 0x0043e070', () => {
  it('draws once for the dust and once for the tire smoke while they live', () => {
    // Arrange
    const racerSet = createRacerSetWithPools(
      { common: createPool(COMMON_NAMES), track: null },
      { turboLevel: 1 }
    )
    const started = startVehicleTurboEffects(context, racerSet, 0)

    // Act
    const updated = updateVehicleEmitters(context, started, 0)

    // Assert
    expect(updated.randomPosition).toBe(2)
  })

  it('draws nothing for a disabled racer', () => {
    // Arrange
    const racerSet = createRacerSetWithPools(
      { common: createPool(COMMON_NAMES), track: null },
      { turboLevel: 1 }
    )
    const started = startVehicleTurboEffects(context, racerSet, 0)
    const disabled = createRacerSet(
      [{ ...getRacer(started, 0), flags: 0x10 }],
      0,
      0,
      started.emitters
    )

    // Act
    const updated = updateVehicleEmitters(context, disabled, 0)

    // Assert
    expect(updated.randomPosition).toBe(0)
  })

  it('lets go of the dust after nine births and of the boost smoke after three', () => {
    // Arrange
    const racerSet = createRacerSetWithPools({ common: createPool(COMMON_NAMES), track: null })
    const started = startVehicleTurboEffects(context, racerSet, 0)
    const common = started.emitters.common
    if (common === null) throw new Error('No common pool')
    const born = createRacerSet(started.racers, 0, 0, {
      common: {
        ...common,
        instances: common.instances.map((instance, index) => ({
          ...instance,
          system: { ...instance.system, bornCount: index === 0 ? 10 : 4 },
        })),
      },
      track: null,
    })

    // Act
    const updated = updateVehicleEmitters(context, born, 0)

    // Assert
    expect(getRacer(updated, 0).vehicle.dustEmitter).toBeNull()
    expect(getRacer(updated, 0).vehicle.boostEmitter).toBeNull()
    expect(updated.randomPosition).toBe(0)
  })

  it('puts down the landing dust once the wheels touch the ground again after 400 ms in the air', () => {
    // Arrange
    const body = createTestCarBody()
    const airborne = {
      ...createRacer(body),
      carBody: {
        ...body,
        rigidBody: { ...body.rigidBody, airborneTime: 500, groundedWheelCount: 0 },
      },
    }
    const racerSet = createRacerSet([airborne], 0, 0, {
      common: createPool(COMMON_NAMES),
      track: null,
    })
    const aloft = updateVehicleEmitters(context, racerSet, 0)
    const landing = createRacerSet(
      [
        {
          ...getRacer(aloft, 0),
          carBody: {
            ...body,
            rigidBody: { ...body.rigidBody, airborneTime: 0, groundedWheelCount: 4 },
          },
        },
      ],
      0,
      0,
      aloft.emitters
    )

    // Act
    const landed = updateVehicleEmitters(context, landing, 0)

    // Assert
    const instances = landed.emitters.common?.instances ?? []
    expect(instances.filter((instance) => instance.system.isActive)).toHaveLength(1)
    expect(getRacer(landed, 0).vehicle.previousGroundedWheelCount).toBe(4)
  })
})

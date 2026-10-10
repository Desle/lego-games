import { IDENTITY_MATRIX3 } from '../../../simulation-math/index.ts'
import { createTestContext, createTestRacerSet } from '../../types/racer-fixtures/racer-fixtures.ts'
import { getRacer, setRacer } from '../../types/racer-state/racer-state.ts'
import type {
  Racer,
  RacerBoundary,
  RacerSet,
  RacerSetBoundary,
  RacerSetStepDependencies,
} from '../../types/racer.types.ts'
import { RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED, stepRacerSet } from './step-racer-set.ts'

const changeRacer = (racerSet: RacerSet, racerIndex: number, change: Partial<Racer>): RacerSet =>
  setRacer(racerSet, racerIndex, { ...getRacer(racerSet, racerIndex), ...change })

const recordRacer =
  (calls: string[], name: string): RacerBoundary =>
  (_context, racerSet, racerIndex) => {
    calls.push(`${name}:${String(racerIndex)}`)
    return racerSet
  }

const recordSet =
  (calls: string[], name: string): RacerSetBoundary =>
  (_context, racerSet) => {
    calls.push(name)
    return racerSet
  }

const createRecordingDependencies = (calls: string[]): RacerSetStepDependencies => ({
  ...RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED,
  stepRigidBody: recordRacer(calls, 'rigidBody'),
  updateEngineSound: recordRacer(calls, 'engineSound'),
  collideRacers: recordSet(calls, 'collide'),
  updateVehicle: recordRacer(calls, 'vehicle'),
  updateRacerSounds: recordRacer(calls, 'sounds'),
  updatePlayerGuidance: recordRacer(calls, 'guidance'),
  updateNearestRacerSound: recordSet(calls, 'nearestSound'),
})

describe('stepRacerSet (0x0043c030)', () => {
  it('runs the passes in the original order, each over all racers', () => {
    // Arrange
    const calls: string[] = []
    const racerSet = changeRacer(createTestRacerSet(2), 1, { controllerKind: 0 })

    // Act
    stepRacerSet({
      context: createTestContext(),
      racerSet,
      stepMilliseconds: 40,
      dependencies: createRecordingDependencies(calls),
    })

    // Assert
    expect(calls).toEqual([
      'rigidBody:0',
      'engineSound:0',
      'rigidBody:1',
      'engineSound:1',
      'collide',
      'vehicle:0',
      'vehicle:1',
      'sounds:0',
      'sounds:1',
      'guidance:1',
      'nearestSound',
    ])
  })

  it('returns a car body below -250 to its last safe pose at rest (CarBody_Update 0x004293f0)', () => {
    // Arrange
    const racerSet = createTestRacerSet(1)
    const racer = getRacer(racerSet, 0)
    const fallen = changeRacer(racerSet, 0, {
      carBody: {
        ...racer.carBody,
        safeOrientation: { x: 0, y: 0, z: 0, w: 1 },
        safePosition: { x: 1, y: 2, z: 3 },
        rigidBody: {
          ...racer.carBody.rigidBody,
          frame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: -251 } },
          linearVelocity: { x: 0, y: 0, z: -1 },
        },
      },
    })

    // Act
    const result = stepRacerSet({
      context: createTestContext(),
      racerSet: fallen,
      stepMilliseconds: 40,
      dependencies: RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED,
    })

    // Assert
    const { rigidBody } = getRacer(result, 0).carBody
    expect(rigidBody.frame.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(rigidBody.linearVelocity).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('saves the pose while all four wheels are down', () => {
    // Arrange
    const racerSet = createTestRacerSet(1)
    const racer = getRacer(racerSet, 0)
    const grounded = changeRacer(racerSet, 0, {
      carBody: {
        ...racer.carBody,
        groundedWheelCount: 4,
        rigidBody: {
          ...racer.carBody.rigidBody,
          frame: { rotation: IDENTITY_MATRIX3, position: { x: 4, y: 5, z: 6 } },
        },
      },
    })

    // Act
    const result = stepRacerSet({
      context: createTestContext(),
      racerSet: grounded,
      stepMilliseconds: 40,
      dependencies: RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED,
    })

    // Assert
    expect(getRacer(result, 0).carBody.safePosition).toEqual({ x: 4, y: 5, z: 6 })
  })

  it('runs the racer timers of 0x004377f0', () => {
    // Arrange
    const racerSet = changeRacer(createTestRacerSet(1), 0, {
      lapCount: 3,
      currentLap: 1,
      voiceMilliseconds: 30,
      fadeMilliseconds: 700,
      flags: 0x10000000,
      proximityCheckMilliseconds: 100,
    })

    // Act
    const result = stepRacerSet({
      context: createTestContext(),
      racerSet,
      stepMilliseconds: 40,
      dependencies: RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED,
    })

    // Assert: fade (660 - 500) · 0.004; no wheel down, so airborne.
    const racer = getRacer(result, 0)
    expect(racer).toMatchObject({
      lapMilliseconds: [0, 40, 0, 0, 0],
      // Counted down to 0 in pass 7, then pass 8 moves the racer from position 0 to 1: 2 · 4 + 5000.
      voiceMilliseconds: 5008,
      fadeMilliseconds: 660,
      flags: 0,
      airborneMilliseconds: 40,
      proximityCheckMilliseconds: 60,
      powerUpThinkMilliseconds: 40,
    })
    expect(racer.carBody.fadeFactor).toBe(Math.fround(160 * Math.fround(0.004)))
  })

  it('waits 2 s when no racer is near ahead of a computer racer (racer-ai taunt)', () => {
    // Arrange
    const racerSet = createTestRacerSet(1)

    // Act
    const result = stepRacerSet({
      context: createTestContext(),
      racerSet,
      stepMilliseconds: 40,
      dependencies: RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED,
    })

    // Assert
    expect(getRacer(result, 0).proximityCheckMilliseconds).toBe(2000)
  })

  it('turns a power-sliding vehicle by 0.06 · (1 - forward · row 0) (0x00437b50)', () => {
    // Arrange: resting forward (0, 1, 0) against row 0 (1, 0, 0); the driver is still sliding (flag 0x4).
    const racerSet = createTestRacerSet(1)
    const racer = getRacer(racerSet, 0)
    const sliding = changeRacer(racerSet, 0, {
      flags: 0x80,
      driver: { ...racer.driver, flags: 0x4 },
      carBody: { ...racer.carBody, restingForward: { x: 0, y: 1, z: 0 }, steering: -40 },
    })

    // Act
    const result = stepRacerSet({
      context: createTestContext(),
      racerSet: sliding,
      stepMilliseconds: 40,
      dependencies: RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED,
    })

    // Assert
    expect(getRacer(result, 0).vehicleSlideAngle).toBe(-Math.fround(0.06))
  })
})

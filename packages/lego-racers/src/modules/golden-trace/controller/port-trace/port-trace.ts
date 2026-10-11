import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import {
  createRace,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  RACE_PHASE_STATE_NUMBERS,
  stepRace,
} from '../../../race/index.ts'
import type { RaceDefinition, RaceState } from '../../../race/index.ts'
import { DEFAULT_KEYBOARD_BINDINGS, getRacerControls } from '../../../race-input/index.ts'
import { getRacerSphere } from '../../../racer/index.ts'
import type { Racer, RacerSetContext } from '../../../racer/index.ts'
import type { Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import { getTrackFields } from '../track-trace/track-trace.ts'
import type {
  GoldenTraceScenario,
  TraceFields,
  TraceFrame,
  TraceFrameInput,
} from '../../types/golden-trace.types.ts'

const SCAN_CODE_MASK = 0xff

const getFloatWords = (values: readonly number[]): readonly number[] =>
  values.map((value) => getBitsFromFloat(value))

const getVectorWords = (vector: Vector3): readonly number[] =>
  getFloatWords([vector.x, vector.y, vector.z])

const getMatrixWords = (matrix: Matrix3): readonly number[] => getFloatWords(matrix)

const getIntegerWords = (value: number): readonly number[] => [value >>> 0]

const getIntegerWords3 = (first: number, second: number, third: number): readonly number[] => [
  first >>> 0,
  second >>> 0,
  third >>> 0,
]

// Bytes stored one after the other, read back as little-endian 32-bit words.
const getPackedBytes = (bytes: readonly number[]): readonly number[] =>
  [0].map((start) =>
    bytes
      .slice(start, start + 4)
      .reduce((word, byte, index) => (word | (byte << (8 * index))) >>> 0, 0)
  )

const getRacerFields = (racer: Racer, index: number, context: RacerSetContext): TraceFields => {
  const { rigidBody } = racer.carBody
  const sphere = getRacerSphere(context, racer)
  const prefix = `racer${String(index)}`
  return {
    [`${prefix}.body.position`]: getVectorWords(rigidBody.frame.position),
    [`${prefix}.body.rotation`]: getMatrixWords(rigidBody.frame.rotation),
    [`${prefix}.body.velocity`]: getVectorWords(rigidBody.linearVelocity),
    [`${prefix}.body.centreOfMass`]: getVectorWords(rigidBody.worldCentreOfMass),
    [`${prefix}.body.angularVelocity`]: getVectorWords(rigidBody.angularVelocity),
    [`${prefix}.body.angularMomentum`]: getVectorWords(rigidBody.angularMomentum),
    [`${prefix}.body.mass`]: getFloatWords([rigidBody.mass]),
    [`${prefix}.body.groundedWheelCount`]: getIntegerWords(rigidBody.groundedWheelCount),
    [`${prefix}.body.contact`]: getIntegerWords(rigidBody.contactCount),
    [`${prefix}.body.speed`]: getFloatWords([rigidBody.speed]),
    [`${prefix}.body.forwardSpeed`]: getFloatWords([rigidBody.forwardSpeed]),
    [`${prefix}.body.throttle`]: getFloatWords([rigidBody.throttle]),
    [`${prefix}.body.centripetalForce`]: getFloatWords([rigidBody.centripetalForce]),
    [`${prefix}.body.turnRadius`]: getFloatWords([rigidBody.turnRadius]),
    [`${prefix}.body.yawRate`]: getFloatWords([rigidBody.yawRate]),
    [`${prefix}.body.flags`]: getIntegerWords(rigidBody.flags),
    [`${prefix}.body.travelDirection`]: getVectorWords(rigidBody.velocityDirection),
    [`${prefix}.body.heading`]: getVectorWords(rigidBody.heading),
    [`${prefix}.body.gripScale`]: getFloatWords([rigidBody.gripScale]),
    [`${prefix}.body.steeringScale`]: getFloatWords([racer.carBody.steeringScale]),
    [`${prefix}.body.throttleScale`]: getFloatWords([racer.carBody.throttleScale]),
    [`${prefix}.body.topSpeedScale`]: getFloatWords([racer.carBody.topSpeedScale]),
    [`${prefix}.driver.curvature`]: getFloatWords([racer.driver.curvature]),
    [`${prefix}.driver.throttle`]: getFloatWords([racer.driver.throttle]),
    [`${prefix}.driver.flags`]: getIntegerWords(racer.driver.flags),
    [`${prefix}.racer.lap`]: getIntegerWords(racer.currentLap),
    [`${prefix}.racer.crossings`]: getIntegerWords(racer.lapCrossings),
    [`${prefix}.racer.flags`]: getIntegerWords(racer.flags),
    [`${prefix}.racer.position`]: getIntegerWords(racer.racePosition),
    [`${prefix}.racer.kind`]: getIntegerWords(racer.controllerKind),
    [`${prefix}.racer.zones`]: getIntegerWords3(
      racer.zoneCurrent,
      racer.zonePrevious,
      racer.zoneBeforePrevious
    ),
    [`${prefix}.racer.lapNumber`]: getIntegerWords(racer.lap),
    [`${prefix}.racer.powerUpChances`]: getPackedBytes(racer.powerUpChances.slice(0, 4)),
    [`${prefix}.racer.checkpointSide`]: getIntegerWords(racer.checkpointSide),
    [`${prefix}.racer.heldPowerUp`]: getIntegerWords(racer.heldPowerUp),
    [`${prefix}.racer.powerUpThink`]: [
      racer.powerUpThinkMilliseconds >>> 0,
      racer.powerUpThinkIntervalMilliseconds >>> 0,
    ],
    [`${prefix}.body.wheels`]: rigidBody.wheels.flatMap((wheel) => [
      (wheel.isOnGround ? 1 : 0) | (wheel.isProbed ? 2 : 0),
      getBitsFromFloat(wheel.depthSquared),
      ...getVectorWords(wheel.contactPoint),
      ...getVectorWords(wheel.anchor),
    ]),
    [`${prefix}.body.wheelProbes`]: rigidBody.wheels.flatMap((wheel) => [
      ...getVectorWords(wheel.probeStart),
      ...getVectorWords(wheel.probeEnd),
      ...getVectorWords(wheel.groundForce),
      ...getFloatWords([wheel.surfaceDrag, wheel.surfaceGrip, wheel.surfaceSkidGrip, wheel.grip]),
    ]),
    [`${prefix}.volume.sphere`]: [
      ...getVectorWords(sphere.centre),
      ...getFloatWords([sphere.radius]),
    ],
    [`${prefix}.display.sphere`]: [
      ...getVectorWords(sphere.centre),
      ...getFloatWords([sphere.radius]),
    ],
    [`${prefix}.display.position`]: getVectorWords(rigidBody.displayFrame.position),
    [`${prefix}.display.rotation`]: getMatrixWords(rigidBody.displayFrame.rotation),
  }
}

const getPlayerFields = (raceState: RaceState, localPlayerCount: number): TraceFields =>
  Object.fromEntries(
    raceState.playerControllers.slice(0, localPlayerCount).flatMap((controller, index) => {
      const prefix = `player${String(index)}.controller`
      return [
        [`${prefix}.bindings`, getIntegerWords(controller.bindingFlags)],
        [`${prefix}.state`, getIntegerWords(controller.stateFlags)],
        [`${prefix}.boostWindow`, getIntegerWords(controller.startBoostMilliseconds)],
        [`${prefix}.acceleratingMilliseconds`, getIntegerWords(controller.accelerateMilliseconds)],
        [`${prefix}.steering`, getFloatWords([controller.steering])],
      ]
    })
  )

// The same named fields the emulator side reads from the original's memory (golden_trace.py).
export const getTraceFields = (raceState: RaceState, localPlayerCount: number): TraceFields => ({
  ...raceState.racerSet.racers.reduce<TraceFields>(
    (fields, racer, index) => ({
      ...fields,
      ...getRacerFields(racer, index, raceState.context),
    }),
    {}
  ),
  ...getPlayerFields(raceState, localPlayerCount),
  'race.phase': getIntegerWords(RACE_PHASE_STATE_NUMBERS[raceState.phase]),
  'race.phaseMilliseconds': getIntegerWords(raceState.phaseMilliseconds),
  'race.randomPosition': getIntegerWords(raceState.racerSet.randomPosition),
  ...getTrackFields(raceState),
})

const SCAN_CODE_KEYS = new Map(
  DEFAULT_KEYBOARD_BINDINGS.map((binding) => [
    binding.bindingCode & SCAN_CODE_MASK,
    binding.keyCode,
  ])
)

const getControls = (frame: TraceFrameInput) =>
  getRacerControls({
    pressedKeyCodes: new Set(
      frame.scanCodes.flatMap((scanCode) => {
        const keyCode = SCAN_CODE_KEYS.get(scanCode)
        return keyCode === undefined ? [] : [keyCode]
      })
    ),
    gamepad: null,
  })

// Steps the port with the scenario's frame times and keys and records the same fields the original trace holds.
export const getPortTrace = (
  scenario: GoldenTraceScenario,
  definition: RaceDefinition
): readonly TraceFrame[] => {
  let raceState = createRace(definition)
  return scenario.frames.map((input, frame) => {
    const controls = Array.from({ length: Math.max(scenario.localPlayerCount, 1) }, (_, index) =>
      index === 0 ? getControls(input) : IDLE_RACER_CONTROLS
    )
    raceState = stepRace(
      raceState,
      { controls, contacts: NO_RACE_CONTACTS },
      input.milliseconds
    ).raceState
    return {
      frame,
      milliseconds: input.milliseconds,
      fields: getTraceFields(raceState, scenario.localPlayerCount),
    }
  })
}

import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import {
  createRace,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  RACE_PHASE_STATE_NUMBERS,
  stepRace,
} from '../../../race/index.ts'
import { getRaceStateWithGrants } from '../../../race/index.ts'
import type { RaceDefinition, RaceState } from '../../../race/index.ts'
import { DEFAULT_KEYBOARD_BINDINGS, getRacerControls } from '../../../race-input/index.ts'
import { getRacerVolume, getRacerVolumeParts } from '../../../racer/index.ts'
import type { BoundingSphere } from '../../../racer-collision/index.ts'
import type { EmitterPool } from '../../../emitter/index.ts'
import type { Racer, RacerSetContext } from '../../../racer/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import { getFloatWords, getVectorWords } from '../trace-words/trace-words.ts'
import { getPowerUpTraceFields } from '../power-up-trace/power-up-trace.ts'
import { getComputerTraceFields } from '../computer-trace/computer-trace.ts'
import { getTrackFields } from '../track-trace/track-trace.ts'
import type {
  GoldenTraceScenario,
  TraceFieldProvider,
  TraceFields,
  TraceFrame,
  TraceFrameInput,
} from '../../types/golden-trace.types.ts'

const SCAN_CODE_MASK = 0xff

const getMatrixWords = (matrix: Matrix3): readonly number[] => getFloatWords(matrix)

const getSphereWords = (sphere: BoundingSphere | null): readonly number[] =>
  sphere === null ? [] : [...getVectorWords(sphere.centre), ...getFloatWords([sphere.radius])]

const getIntegerWords = (value: number): readonly number[] => [value >>> 0]

const getIntegerWords2 = (first: number, second: number): readonly number[] => [
  first >>> 0,
  second >>> 0,
]

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

const COMPUTER_CONTROLLER_KIND = 2

// The route follower and the speed state of a computer's route-driven body (car body +0x748 to +0x7ec).
const getComputerFields = (racer: Racer, prefix: string): TraceFields => {
  if (racer.controllerKind !== COMPUTER_CONTROLLER_KIND) return {}
  const { carBody } = racer
  const follower = carBody.routeFollower
  return {
    [`${prefix}.ai.held`]: getIntegerWords(carBody.isRouteHeld ? 1 : 0),
    [`${prefix}.ai.follower.position`]: getVectorWords(follower?.position ?? ZERO_VECTOR3),
    [`${prefix}.ai.follower.speedFactor`]: getFloatWords([carBody.speedFactor]),
    [`${prefix}.ai.follower.time`]: getFloatWords([follower?.time ?? 0]),
    [`${prefix}.ai.follower.indices`]: getIntegerWords2(
      follower?.previousSampleIndex ?? 0,
      follower?.nextSampleIndex ?? 0
    ),
    [`${prefix}.ai.follower.previousTime`]: getIntegerWords(follower?.previousTime ?? 0),
    [`${prefix}.ai.bounceOffset`]: getFloatWords([
      carBody.bounceHeight,
      carBody.lateralOffset,
      carBody.bounceVerticalSpeed,
    ]),
    [`${prefix}.ai.targetSpeedFactors`]: getFloatWords([
      carBody.defaultTargetSpeedFactor,
      carBody.targetSpeedFactor,
    ]),
    [`${prefix}.ai.flip`]: getFloatWords([carBody.flipRate, carBody.flipAngle, carBody.flipHeight]),
    [`${prefix}.ai.spin`]: getFloatWords([carBody.scriptedSpinPeriod, carBody.scriptedSpinTime]),
  }
}

const getRacerFields = (racer: Racer, index: number, context: RacerSetContext): TraceFields => {
  const { rigidBody } = racer.carBody
  const volume = racer.vehicle.volume ?? getRacerVolume(context.arithmetic, racer)
  const parts = getRacerVolumeParts(context.arithmetic, racer)
  const sphere = parts.wheels
  const prefix = `racer${String(index)}`
  return {
    ...getComputerFields(racer, prefix),
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
    [`${prefix}.racer.turboLevel`]: getIntegerWords(racer.turboLevel),
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
      ...getVectorWords(volume.centre),
      ...getFloatWords([volume.radius]),
    ],
    [`${prefix}.volume.body`]: getSphereWords(parts.body),
    [`${prefix}.volume.driver`]: getSphereWords(parts.driver),
    [`${prefix}.vehicle.bodyRotation`]: getMatrixWords(racer.vehicle.bodyRotation),
    [`${prefix}.vehicle.driverPosition`]: getVectorWords(racer.vehicle.driverPosition),
    [`${prefix}.display.sphere`]: [
      ...getVectorWords(sphere.centre),
      ...getFloatWords([sphere.radius]),
    ],
    [`${prefix}.display.position`]: getVectorWords(rigidBody.displayFrame.position),
    [`${prefix}.display.rotation`]: getMatrixWords(rigidBody.displayFrame.rotation),
  }
}

const getPlayerFields: TraceFieldProvider = (raceState, localPlayerCount) =>
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

const EMITTER_HANDLE_WORD_COUNT = 4
const EMITTER_HANDLES_PER_WORD = 32
const DYING_FLAG = 0x10
const ACTIVE_FLAG = 0x2

// What the emulator reads of an emitter pool: each instance's flags, its definition's period and chance and priority,
// the milliseconds since the last birth, its age and the particles born; and the taken handles as a bit set.
const getEmitterPoolFields = (name: string, pool: EmitterPool | null): TraceFields => {
  const instanceWords =
    pool === null
      ? []
      : pool.instances.flatMap((instance) => {
          const definition =
            instance.definitionIndex === null
              ? undefined
              : pool.list.emitters[instance.definitionIndex]
          return [
            (instance.system.isActive ? ACTIVE_FLAG : 0) |
              (instance.system.isDying ? DYING_FLAG : 0),
            (definition?.firstTruncatedValue ?? 0) >>> 0,
            ((definition?.secondTruncatedValue ?? 0) | ((definition?.thirdInteger ?? 0) << 8)) >>>
              0,
            instance.millisecondsSinceBirth >>> 0,
            instance.ageMilliseconds >>> 0,
            instance.system.bornCount >>> 0,
          ]
        })
  const handleWords = Array.from({ length: EMITTER_HANDLE_WORD_COUNT }, (_, wordIndex) =>
    (pool?.handles ?? []).reduce(
      (word, handle, handleIndex) =>
        handle.isTaken && Math.floor(handleIndex / EMITTER_HANDLES_PER_WORD) === wordIndex
          ? (word | (1 << (handleIndex % EMITTER_HANDLES_PER_WORD))) >>> 0
          : word,
      0
    )
  )
  return {
    [`emitters.${name}.instances`]: instanceWords,
    [`emitters.${name}.handles`]: handleWords,
  }
}

const getRacerSetFields: TraceFieldProvider = (raceState) =>
  raceState.racerSet.racers.reduce<TraceFields>(
    (fields, racer, index) => ({
      ...fields,
      ...getRacerFields(racer, index, raceState.context),
    }),
    {}
  )

const getEmitterFields: TraceFieldProvider = (raceState) => ({
  ...getEmitterPoolFields('common', raceState.racerSet.emitters.common),
  ...getEmitterPoolFields('track', raceState.racerSet.emitters.track),
})

const getRaceFields: TraceFieldProvider = (raceState) => ({
  'race.phase': getIntegerWords(RACE_PHASE_STATE_NUMBERS[raceState.phase]),
  'race.phaseMilliseconds': getIntegerWords(raceState.phaseMilliseconds),
  'race.randomPosition': getIntegerWords(raceState.racerSet.randomPosition),
})

// Every group of compared fields. To compare more of the race, add a provider here that returns the same names the
// emulator side writes in golden_trace.py (one `snapshot_*` function per group).
export const TRACE_FIELD_PROVIDERS: readonly TraceFieldProvider[] = [
  getEmitterFields,
  (raceState) => getComputerTraceFields(raceState.racerSet),
  (raceState) => getPowerUpTraceFields(raceState),
  getRacerSetFields,
  getPlayerFields,
  getRaceFields,
  getTrackFields,
]

export const getTraceFields = (raceState: RaceState, localPlayerCount: number): TraceFields =>
  TRACE_FIELD_PROVIDERS.reduce<TraceFields>(
    (fields, provider) => ({ ...fields, ...provider(raceState, localPlayerCount) }),
    {}
  )

const SCAN_CODE_KEYS = new Map(
  DEFAULT_KEYBOARD_BINDINGS.map((binding) => [
    binding.bindingCode & SCAN_CODE_MASK,
    binding.keyCode,
  ])
)

// The racer controls a frame's held scan codes make (the DirectInput codes the emulator is fed).
export const getFrameControls = (frame: TraceFrameInput) =>
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
  definition: RaceDefinition,
  onFrame: (raceState: RaceState, frame: number) => void = () => undefined
): readonly TraceFrame[] => {
  let raceState = createRace(definition)
  return scenario.frames.map((input, frame) => {
    const controls = Array.from({ length: Math.max(scenario.localPlayerCount, 1) }, (_, index) =>
      index === 0 ? getFrameControls(input) : IDLE_RACER_CONTROLS
    )
    raceState = stepRace(
      getRaceStateWithGrants(
        raceState,
        scenario.powerUpGrants.filter((grant) => grant.frame === frame)
      ),
      { controls, contacts: NO_RACE_CONTACTS },
      input.milliseconds
    ).raceState
    onFrame(raceState, frame)
    return {
      frame,
      milliseconds: input.milliseconds,
      fields: getTraceFields(raceState, scenario.localPlayerCount),
    }
  })
}

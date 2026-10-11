import {
  advanceBallisticFlight,
  BallisticFlightState,
  createBallisticFlight,
  launchFlightWithOffset,
} from '../../../projectiles/index.ts'
import type { BallisticFlight, BallisticLaunchParameters } from '../../../projectiles/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { CannonData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import type { CannonBlock, Vector3 } from '../../types/hazard.types.ts'
import { getHazard33, getHazard3D } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  getUpdatedAfterEndRequest,
  getWithData,
  NO_IDENTIFIER,
} from '../hazard-helpers/hazard-helpers.ts'

// The signals the events hear when the ball leaves (0x0048faa0) and when it lands (0x0048fbe0).
export const CANNON_FIRED_SIGNAL = 6
export const CANNON_LANDED_SIGNAL = 7
const ORIGIN: Vector3 = Object.freeze([0, 0, 0] as const)
// 0x0048faa0: the launch parameter block.
const LAUNCH_PARAMETERS: BallisticLaunchParameters = Object.freeze({
  gravity: getFloatFromBits(0xc200b439),
  speed: getFloatFromBits(0x43340000),
  targetOffset: Object.freeze({ x: 0, y: 0, z: 0 }),
  maximumDurationMilliseconds: 3000,
  heightOffset: 0,
})

const getIsCannonData = (data: HazardInstance['data']): data is CannonData =>
  data.keyword === HazardKeyword.HAZARD_33 || data.keyword === HazardKeyword.HAZARD_3D

const getVectorOrOrigin = (vector: Vector3 | null): Vector3 => vector ?? ORIGIN

const createCannonData = (
  keyword: 0x33 | 0x3d,
  block: CannonBlock
): Pick<CannonData, 'position' | 'target' | 'trigger' | 'squaredRange' | 'signalIdentifier'> &
  Pick<CannonData, 'keyword' | 'flight' | 'firstChoice' | 'secondChoice'> => ({
  keyword,
  position: getVectorOrOrigin(block.firstVector),
  target: getVectorOrOrigin(block.secondVector),
  trigger: getVectorOrOrigin(block.thirdVector),
  squaredRange: block.squaredFloat ?? 0,
  signalIdentifier: block.integer ?? NO_IDENTIFIER,
  flight: createBallisticFlight(),
  firstChoice: 0,
  secondChoice: 0,
})

// 0x0048faa0: the ball starts at the cannon and flies to the target; the events hear signal 6 at the cannon.
const fire = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsCannonData(data)) return instance
  const positioned: BallisticFlight = Object.freeze({
    ...data.flight,
    framePosition: Object.freeze({ x: data.position[0], y: data.position[1], z: data.position[2] }),
  })
  const flight = launchFlightWithOffset(session.arithmetic, positioned, LAUNCH_PARAMETERS, {
    x: data.target[0],
    y: data.target[1],
    z: data.target[2],
  })
  session.startStopSignal(CANNON_FIRED_SIGNAL, CANNON_FIRED_SIGNAL, data.position)
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.ACTIVE,
    data: Object.freeze({ ...data, flight }),
  })
}

// 0x0048fba0: the ball is released and the cannon is idle.
const stop = (instance: HazardInstance): HazardInstance => {
  const { data } = instance
  if (!getIsCannonData(data)) return instance
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.IDLE,
    data: Object.freeze({
      ...data,
      flight: Object.freeze({ ...data.flight, state: BallisticFlightState.IDLE }),
    }),
  })
}

// 0x0048fbe0: the ball flies; when it hits the ground an explosion starts there, the events hear signal 7 and the
// cannon is idle again. A ball a racer touched, or one that ran out of time, leaves the cannon active.
const update = (
  instance: HazardInstance,
  session: HazardSession,
  milliseconds: number
): HazardInstance => {
  if (instance.lifecycle === HazardLifecycle.IDLE) return instance
  const checked = getUpdatedAfterEndRequest(instance, stop)
  const { data } = checked
  if (!getIsCannonData(data)) return checked
  if (data.flight.state === BallisticFlightState.IDLE) return stop(checked)
  const advance = advanceBallisticFlight(
    session.arithmetic,
    session.probe,
    data.flight,
    milliseconds
  )
  const advanced = getWithData(checked, { ...data, flight: advance.flight })
  if (advance.result !== BallisticFlightState.HIT_GROUND) return advanced
  const landing: Vector3 = Object.freeze([
    advance.flight.endPosition.x,
    advance.flight.endPosition.y,
    advance.flight.endPosition.z,
  ] as const)
  session.emit({
    type: 'hazard.explosion_started',
    keyword: data.keyword,
    position: landing,
  })
  session.startStopSignal(CANNON_LANDED_SIGNAL, CANNON_LANDED_SIGNAL, landing)
  return stop(advanced)
}

// 0x0048fa30: a signal with the cannon\'s number fires it when it is idle and the signal came from near enough.
const getIsInRange = (
  session: HazardSession,
  data: CannonData,
  parameter: Vector3 | null
): boolean => {
  if (parameter === null) return true
  const { add, multiply, storeFloat, subtract } = session.arithmetic
  const [x, y, z] = data.trigger
  const differenceX = storeFloat(subtract(x, parameter[0]))
  const differenceY = storeFloat(subtract(y, parameter[1]))
  const differenceZ = storeFloat(subtract(z, parameter[2]))
  const distance = add(
    add(multiply(differenceX, differenceX), multiply(differenceY, differenceY)),
    multiply(differenceZ, differenceZ)
  )
  return distance < data.squaredRange
}

const createOnSignalStarted =
  (begin: HazardBehavior['begin']): HazardBehavior['onSignalStarted'] =>
  (instance, session, identifier, parameter) => {
    const { data } = instance
    if (!getIsCannonData(data)) return instance
    const isAddressed =
      data.signalIdentifier !== NO_IDENTIFIER && identifier === data.signalIdentifier
    return isAddressed &&
      instance.lifecycle === HazardLifecycle.IDLE &&
      getIsInRange(session, data, parameter)
      ? begin(instance, session, null)
      : instance
  }

// 0x0048f6e0 (constructor), 0x0048f830 (loader), 0x0048faa0 (Begin), 0x0048fba0 (End), 0x0048fbe0 (update),
// 0x0048fa30 (signal): a cannon that a signal fires. The ball is the ballistic flight of the projectiles module.
// Not ported: the ball\'s model and smoke trail.
export const CANNON: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition) =>
    Object.freeze({
      definition,
      identifier: NO_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze(createCannonData(HazardKeyword.HAZARD_33, getHazard33(definition))),
    }),
  begin: fire,
  end: stop,
  update,
  onSignalStarted: createOnSignalStarted(fire),
})

// 0x0048f200 (constructor), 0x0048f2b0 (loader), 0x0048f5b0 (Begin), 0x0048f680 (End): a battery of cannons that is
// one cannon at a time. Begin draws the point it fires from and the point it aims at; each announces the signal
// that belongs to it.
const beginBattery = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsCannonData(data)) return instance
  const { points, secondPoints } = getHazard3D(instance.definition)
  const firstChoice = session.drawRandomValue() % (points?.length ?? 0)
  const secondChoice = session.drawRandomValue() % (secondPoints?.length ?? 0)
  const first = points?.[firstChoice]
  const second = secondPoints?.[secondChoice]
  if (first === undefined || second === undefined) return instance
  const chosen: CannonData = {
    ...data,
    position: first.position,
    target: second.position,
    firstChoice,
    secondChoice,
  }
  session.startStopSignal(first.integer, first.integer, first.position)
  return fire(getWithData(instance, chosen), session)
}

const endBattery = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsCannonData(data)) return instance
  const second = getHazard3D(instance.definition).secondPoints?.[data.secondChoice]
  if (second !== undefined) {
    session.startStopSignal(second.integer, second.integer, data.target)
  }
  return stop(instance)
}

export const CANNON_BATTERY: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition) =>
    Object.freeze({
      definition,
      identifier: NO_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze(createCannonData(HazardKeyword.HAZARD_3D, getHazard3D(definition).block)),
    }),
  begin: beginBattery,
  end: endBattery,
  update,
  onSignalStarted: createOnSignalStarted(beginBattery),
})

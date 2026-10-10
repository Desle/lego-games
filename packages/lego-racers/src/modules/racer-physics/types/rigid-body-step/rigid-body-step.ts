import {
  getFloatFromBits,
  getRotationFromFrameAxes,
  getVectorRotatedAroundAxis,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { applyCarForces, getIsFlagSet, getRotationRow } from '../car-forces/car-forces.ts'
import {
  CarRigidBodyFlag,
  getWithWorldCentreOfMass,
  saveStepStart,
} from '../car-rigid-body/car-rigid-body.ts'
import { getWithTiltLimit, probeGround } from '../ground-probe/ground-probe.ts'
import { getWithVelocitySplit, updateHeading } from '../heading/heading.ts'
import { advanceToContact, respondToContact } from '../hull-contacts/hull-contacts.ts'
import { removeAngularMomentumAlongAxis } from '../rigid-body-forces/rigid-body-forces.ts'
import { integrateRigidBody } from '../rigid-body-integration/rigid-body-integration.ts'
import { getWorldInverseInertia } from '../rigid-body/rigid-body.ts'
import { TwoPointModeNotPortedError } from '../two-point-mode/two-point-mode.ts'
import type {
  CarRigidBody,
  CarRigidBodyHooks,
  CarRigidBodyStepInput,
} from '../racer-physics.types.ts'

const LEAN_RATE = getFloatFromBits(0x3b03126f) // 0x004b0d7c, 0.002 per millisecond
const MAXIMUM_LEAN = getFloatFromBits(0x3f000000) // 0x004b0d78
const LEAN_TURN_RADIUS = getFloatFromBits(0x42200000) // 0x004b0cd0, 40
const SPEED_SCALE = getFloatFromBits(0x447a0000) // 0x004af670, 1000

// The car rigid body's own slots (vtable 0x004b0d8c). The car body overrides +0x0c and +0x10
// with racer code (0x0042a830, 0x0042a900); its +0x2c and +0x3c (0x00429cd0, 0x00429c30) do
// what these do while car body +0x744 is 0, which it always is when RigidBody_Step runs.
export const CAR_RIGID_BODY_HOOKS: CarRigidBodyHooks = Object.freeze({
  decideHullContact: (body) => ({ isAccepted: true, body }),
  afterPass: (body) => body,
  // 0x004482e0: the sound object +0x6e4 is stopped and released there too, not modelled.
  onSpinEnded: (arithmetic, body) => {
    if (!getIsFlagSet(body, CarRigidBodyFlag.SPINNING)) return body
    const steadied = removeAngularMomentumAlongAxis(
      arithmetic,
      Object.freeze({ ...body, yawTimer: 0 }),
      getRotationRow(body, 2)
    )
    return Object.freeze({
      ...steadied,
      flags:
        steadied.flags &
        ~(CarRigidBodyFlag.SPINNING | CarRigidBodyFlag.SPIN_STARTED | CarRigidBodyFlag.WALL_TURN),
    })
  },
  // 0x00448820
  onFlaggedTimerEnded: (body) =>
    Object.freeze({ ...body, flaggedTimer: 0, flags: body.flags & ~CarRigidBodyFlag.FLAGGED }),
})

// 0x00447880
const clearContacts = (body: CarRigidBody): CarRigidBody =>
  Object.freeze({
    ...body,
    hullContacts: Object.freeze(body.hullContacts.map(() => false)),
    contactCount: 0,
  })

const getTimerRemovingMomentum = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  timer: 'rollTimer' | 'pitchTimer',
  row: 0 | 1,
  stepMilliseconds: number
): CarRigidBody => {
  const value = body[timer]
  if (value === 0) return body
  if (stepMilliseconds < value) return Object.freeze({ ...body, [timer]: value - stepMilliseconds })
  return removeAngularMomentumAlongAxis(
    arithmetic,
    Object.freeze({ ...body, [timer]: 0 }),
    getRotationRow(body, row)
  )
}

// 0x00444f0b..0x0044507d: the countdowns. While spinning (flag 0x2) the yaw timer shortens the
// sub-step to what is left of it; otherwise its end removes the yaw momentum and flag 0x800.
const getTimedBody = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number,
  hooks: CarRigidBodyHooks
): CarRigidBody => {
  const flagged = !getIsFlagSet(body, CarRigidBodyFlag.FLAGGED)
    ? body
    : stepMilliseconds < body.flaggedTimer
      ? Object.freeze({ ...body, flaggedTimer: body.flaggedTimer - stepMilliseconds })
      : hooks.onFlaggedTimerEnded(body)
  let step = stepMilliseconds
  let yawed: CarRigidBody
  if (getIsFlagSet(flagged, CarRigidBodyFlag.SPINNING)) {
    if (getIsFlagSet(flagged, CarRigidBodyFlag.SPIN_STARTED)) {
      yawed = Object.freeze({ ...flagged, flags: flagged.flags & ~CarRigidBodyFlag.SPIN_STARTED })
    } else if (step < flagged.yawTimer) {
      yawed = Object.freeze({ ...flagged, yawTimer: flagged.yawTimer - step })
    } else if (flagged.yawTimer !== 0) {
      step = flagged.yawTimer
      yawed = Object.freeze({ ...flagged, yawTimer: 0 })
    } else {
      yawed = hooks.onSpinEnded(arithmetic, flagged)
    }
  } else if (step < flagged.yawTimer) {
    yawed = Object.freeze({ ...flagged, yawTimer: flagged.yawTimer - step })
  } else {
    const steadied = removeAngularMomentumAlongAxis(
      arithmetic,
      Object.freeze({ ...flagged, yawTimer: 0 }),
      getRotationRow(flagged, 2)
    )
    yawed = Object.freeze({ ...steadied, flags: steadied.flags & ~CarRigidBodyFlag.WALL_TURN })
  }
  const spun = Object.freeze({
    ...yawed,
    spinTimer: step > yawed.spinTimer ? 0 : yawed.spinTimer - step,
  })
  const rolled = getTimerRemovingMomentum(arithmetic, spun, 'rollTimer', 0, step)
  const pitched = getTimerRemovingMomentum(arithmetic, rolled, 'pitchTimer', 1, step)
  if (getIsFlagSet(pitched, CarRigidBodyFlag.TWO_POINT))
    throw new TwoPointModeNotPortedError(0x00448840)
  return Object.freeze({ ...pitched, stepRemaining: step })
}

// One pass of RigidBody_Step's loop (0x00445098..0x004450fe) over the given milliseconds.
const runPass = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  milliseconds: number,
  input: CarRigidBodyStepInput,
  hooks: CarRigidBodyHooks
): CarRigidBody => {
  const pushed = applyCarForces(arithmetic, body)
  const integrated = integrateRigidBody(arithmetic, pushed, milliseconds)
  const limited = getWithTiltLimit(arithmetic, integrated)
  if (getIsFlagSet(limited, CarRigidBodyFlag.TWO_POINT))
    throw new TwoPointModeNotPortedError(0x004464a0)
  const probed = probeGround(arithmetic, limited, milliseconds, input.collisionObjects)
  const headed = updateHeading(arithmetic, probed, milliseconds)
  const split = getWithVelocitySplit(arithmetic, headed)
  const finished = getWithWorldCentreOfMass(arithmetic, hooks.afterPass(split))
  return Object.freeze({
    ...finished,
    worldInverseInertia: getWorldInverseInertia(arithmetic, finished),
  })
}

// 0x004452b0's target lean: into the turn when flag 0x400 is set and the turn radius is 40 or more.
const getLeanTarget = (arithmetic: FloatArithmetic, body: CarRigidBody): number => {
  const { multiply, divide, getIsBelow, getIsBelowOrEqual } = arithmetic
  if (getIsFlagSet(body, CarRigidBodyFlag.TWO_POINT)) return -body.twoPointTilt
  if (!getIsFlagSet(body, CarRigidBodyFlag.LEANING)) return 0
  const radius = body.turnRadius
  if (getIsBelow(-LEAN_TURN_RADIUS, radius) && getIsBelow(radius, LEAN_TURN_RADIUS)) return 0
  const lean = multiply(
    multiply(multiply(-divide(1, radius), LEAN_TURN_RADIUS), body.leanFactor),
    divide(multiply(body.speed, SPEED_SCALE), body.topSpeed)
  )
  if (!getIsBelowOrEqual(lean, MAXIMUM_LEAN)) return MAXIMUM_LEAN
  return getIsBelow(lean, -MAXIMUM_LEAN) ? -MAXIMUM_LEAN : lean
}

// 0x004452b0 (thiscall: step): the model leans toward the target by 0.002 radians per
// millisecond, about rotation row 0, and rises by tan(|lean|) × half the track width.
const getLeanedVisualFrame = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number
): CarRigidBody => {
  const { add, subtract, multiply, storeFloat, getTangent, getIsBelow, getIsEqual } = arithmetic
  const target = getLeanTarget(arithmetic, body)
  const change = multiply(stepMilliseconds, LEAN_RATE)
  let lean = body.lean
  if (getIsBelow(target, lean)) {
    const lowered = subtract(lean, change)
    lean = getIsBelow(lowered, target) ? storeFloat(target) : storeFloat(lowered)
  } else if (!arithmetic.getIsBelowOrEqual(target, lean)) {
    const raised = add(change, lean)
    lean = arithmetic.getIsBelowOrEqual(raised, target) ? storeFloat(raised) : storeFloat(target)
  }
  const magnitude = getIsBelow(lean, 0) ? -lean : lean
  if (getIsEqual(magnitude, 0)) return Object.freeze({ ...body, lean, displayFrame: body.frame })
  const first = getRotationRow(body, 0)
  const third = getVectorRotatedAroundAxis(arithmetic, getRotationRow(body, 2), first, lean)
  const rise = multiply(multiply(body.trackWidth, 0.5), getTangent(magnitude))
  const { position } = body.frame
  return Object.freeze({
    ...body,
    lean,
    displayFrame: Object.freeze({
      rotation: getRotationFromFrameAxes(arithmetic, { first, third }),
      position: Object.freeze({ ...position, z: storeFloat(add(position.z, storeFloat(rise))) }),
    }),
  })
}

// RigidBody_Step, 0x00444ef0 (car rigid body vtable 0x004b0d8c slot 1, thiscall: milliseconds).
// Counts the timers down, then runs passes of forces, integration, ground probes and heading
// until the step is used up. A pass that ends with a hull point inside the world is undone
// (0x004478b0) and re-run up to 5 ms before the contact; then 0x00447cf0 answers the contact
// and the rest of the step runs from there. A second contact within 5 ms ends the step with
// the body at the start of that pass and contact count 1. Finally the air time and the model's
// lean are updated. The sound objects (+0x6e4, +0x6e8) it also updates are not modelled.
export const stepCarRigidBody = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  input: CarRigidBodyStepInput,
  hooks: CarRigidBodyHooks = CAR_RIGID_BODY_HOOKS
): CarRigidBody => {
  const { stepMilliseconds, collisionObjects } = input
  let current = saveStepStart(
    getTimedBody(arithmetic, clearContacts(body), stepMilliseconds, hooks)
  )
  let remaining = current.stepRemaining
  let isContactAnswered = false
  for (;;) {
    if (remaining === 0 && current.contactCount === 0) break
    if (remaining !== 0) current = runPass(arithmetic, current, remaining, input, hooks)
    if (current.contactCount === 0) {
      const advance = advanceToContact(arithmetic, current, remaining, collisionObjects, hooks)
      current = advance.body
      remaining = advance.remainingMilliseconds
      if (remaining === 0 && isContactAnswered) break
      continue
    }
    if (remaining !== 0) {
      const advance = advanceToContact(arithmetic, current, remaining, collisionObjects, hooks)
      current = advance.body
      if (current.contactCount !== 0) {
        remaining = advance.remainingMilliseconds
        continue
      }
    }
    const answered = clearContacts(
      getWithVelocitySplit(arithmetic, respondToContact(arithmetic, current))
    )
    isContactAnswered = true
    current = saveStepStart(answered)
    current = Object.freeze({ ...current, stepRemaining: current.stepRemaining - remaining })
    remaining = current.stepRemaining
  }
  const settled = isContactAnswered ? Object.freeze({ ...current, contactCount: 1 }) : current
  const timed = Object.freeze({
    ...settled,
    airborneTime: settled.groundedWheelCount === 0 ? settled.airborneTime + stepMilliseconds : 0,
  })
  return getLeanedVisualFrame(arithmetic, timed, stepMilliseconds)
}

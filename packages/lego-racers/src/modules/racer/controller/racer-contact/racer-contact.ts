import type { BoxContact } from '../../../racer-collision/index.ts'
import { CarRigidBodyFlag, moveOutOfContact } from '../../../racer-physics/index.ts'
import { drawRandomValue } from '../../../random-table/index.ts'
import { getFloatFromBits, getNormalizedVector3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import {
  addCarBodyImpulse,
  setCarBodyPush,
  startCarBodySpin,
} from '../../types/car-body-commands/car-body-commands.ts'
import { getRestartedForceFeedback } from '../../types/force-feedback/force-feedback.ts'
import { startCarBodySlide } from '../../types/car-body/car-body.ts'
import { playRacerVoice } from '../../types/racer-ranking/racer-ranking.ts'
import { getRacer, setRacer, setRandomPosition } from '../../types/racer-state/racer-state.ts'
import type {
  Racer,
  RacerCollisionDependencies,
  RacerSet,
  RacerSetContext,
} from '../../types/racer.types.ts'

const RESTITUTION = getFloatFromBits(0x3f400000) // 0x004b0970, 0.75
const UNIT = getFloatFromBits(0x3f800000) // 0x004af388
const KICK_LIMIT = getFloatFromBits(0x3f333333) // 0x004b0980, 0.7
const KICK_SCALE = getFloatFromBits(0x43480000) // 0x004b09d4, 200
const KICK_SLIDE_STRENGTH = getFloatFromBits(0x40200000) // 2.5
const KICK_SLIDE_DAMPING = getFloatFromBits(0x3f666666) // 0.9
const KICK_SLIDE_RATE = getFloatFromBits(0x40490fdb) // π
const SPIN_RATE = getFloatFromBits(0x3c1374bc) // 0.00898
const SMALL_SPIN_FACTOR = getFloatFromBits(0x3f800000)
const LARGE_SPIN_FACTOR = getFloatFromBits(0x40000000)
const HIT_STRENGTH = 150 // 0x004220e0
const CONTACT_TIMER_MILLISECONDS = 750 // 0x2ee
const CONTACT_SOUND_MILLISECONDS = 250
const COMPUTER_CONTROLLER = 2
const RACER_DISABLED_FLAG = 0x10
const RACER_ATTACKING_FLAG = 0x1
const RACER_TIMED_EFFECT_FLAG = 0x800
const RACER_KICKED_FLAG = 0x100
const RACER_CONTACT_FLAG = 0x10000000
const KICK_EXTRA_FORCE_A = CarRigidBodyFlag.EXTRA_FORCE_A
const KICK_EXTRA_FORCE_B = CarRigidBodyFlag.EXTRA_FORCE_B

const updateRacer = (racerSet: RacerSet, racerIndex: number, change: (racer: Racer) => Racer) =>
  setRacer(racerSet, racerIndex, change(getRacer(racerSet, racerIndex)))

const getMatrixElement = (matrix: Matrix3, index: number): number => matrix[index] ?? 0

// One body's term of the impulse denominator: (r × n) through the first body's inverse inertia, crossed with r.
// `isLeading` is the first body's (0x0043865b..0x00438a2d), whose first component stays on the FPU stack.
const getAngularTerm = (
  arithmetic: FloatArithmetic,
  inertia: Matrix3,
  normal: Vector3,
  radius: Vector3,
  isLeading: boolean
): Vector3 => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const m = (index: number): number => getMatrixElement(inertia, index)
  const crossX = subtract(multiply(normal.z, radius.y), multiply(normal.y, radius.z))
  const crossXStored = storeFloat(crossX)
  const crossY = storeFloat(subtract(multiply(radius.z, normal.x), multiply(normal.z, radius.x)))
  const crossZ = storeFloat(subtract(multiply(normal.y, radius.x), multiply(radius.y, normal.x)))
  const x = isLeading ? crossX : crossXStored
  if (isLeading) {
    const partialX = storeFloat(multiply(m(0), x))
    const partialY = storeFloat(multiply(m(1), x))
    const partialZ = multiply(x, m(2))
    const turnedX = storeFloat(add(multiply(m(3), crossY), partialX))
    const turnedY = storeFloat(add(multiply(m(4), crossY), partialY))
    const turnedZ = add(partialZ, multiply(m(5), crossY))
    const finalX = storeFloat(add(multiply(m(6), crossZ), turnedX))
    const finalY = storeFloat(add(multiply(m(7), crossZ), turnedY))
    const finalZ = add(turnedZ, multiply(m(8), crossZ))
    return {
      x: storeFloat(subtract(multiply(finalY, radius.z), multiply(finalZ, radius.y))),
      y: storeFloat(subtract(multiply(finalZ, radius.x), multiply(radius.z, finalX))),
      z: storeFloat(subtract(multiply(radius.y, finalX), multiply(finalY, radius.x))),
    }
  }
  const leadingX = multiply(m(0), x)
  const partialY = storeFloat(multiply(x, m(1)))
  const partialZ = storeFloat(multiply(x, m(2)))
  const turnedX = add(leadingX, multiply(crossY, m(3)))
  const turnedY = storeFloat(add(multiply(crossY, m(4)), partialY))
  const turnedZ = storeFloat(add(multiply(crossY, m(5)), partialZ))
  const finalX = add(turnedX, multiply(crossZ, m(6)))
  const finalY = add(multiply(crossZ, m(7)), turnedY)
  const finalZ = add(multiply(crossZ, m(8)), turnedZ)
  return {
    x: storeFloat(subtract(multiply(finalY, radius.z), multiply(finalZ, radius.y))),
    y: storeFloat(subtract(multiply(finalZ, radius.x), multiply(radius.z, finalX))),
    z: subtract(multiply(finalX, radius.y), multiply(finalY, radius.x)),
  }
}

// The impulse 0x00438560 applies along the normal: restitution 0.75, the relative velocity along the
// normal, the inverse masses times |n|², and both bodies' angular terms, which the original takes
// both through the FIRST body's world inverse inertia.
const getImpulse = (
  arithmetic: FloatArithmetic,
  first: Racer,
  second: Racer,
  contact: BoxContact
): number => {
  const { add, subtract, multiply, divide, storeFloat } = arithmetic
  const { normal, point } = contact
  const body = first.carBody.rigidBody
  const other = second.carBody.rigidBody
  const relativeX = subtract(body.linearVelocity.x, other.linearVelocity.x)
  const relativeY = subtract(body.linearVelocity.y, other.linearVelocity.y)
  const relativeZ = subtract(body.linearVelocity.z, other.linearVelocity.z)
  const closing = add(
    add(multiply(normal.z, relativeZ), multiply(normal.y, relativeY)),
    multiply(normal.x, relativeX)
  )
  const numerator = storeFloat(multiply(add(RESTITUTION, UNIT), -closing))
  const squaredLength = add(
    add(multiply(normal.x, normal.x), multiply(normal.y, normal.y)),
    multiply(normal.z, normal.z)
  )
  const massTerm = storeFloat(multiply(add(other.inverseMass, body.inverseMass), squaredLength))
  const getRadius = (centre: Vector3): Vector3 =>
    getNormalizedVector3(
      arithmetic,
      Object.freeze({
        x: storeFloat(subtract(centre.x, point.x)),
        y: storeFloat(subtract(centre.y, point.y)),
        z: storeFloat(subtract(centre.z, point.z)),
      })
    )
  const firstRadius = getRadius(body.worldCentreOfMass)
  const secondRadius = getRadius(other.worldCentreOfMass)
  const inertia = body.worldInverseInertia
  const firstTerm = getAngularTerm(arithmetic, inertia, normal, firstRadius, true)
  const secondTerm = getAngularTerm(arithmetic, inertia, normal, secondRadius, false)
  const sumX = storeFloat(add(secondTerm.x, firstTerm.x))
  const sumY = storeFloat(add(secondTerm.y, firstTerm.y))
  const sumZ = add(secondTerm.z, firstTerm.z)
  const denominator = add(
    add(add(multiply(sumZ, normal.z), multiply(normal.y, sumY)), multiply(sumX, normal.x)),
    massTerm
  )
  return storeFloat(divide(numerator, denominator))
}

// 0x00438e60 (thiscall: direction): a racer hit by a flagged one is kicked sideways: a slide, a force
// on the car body (free to the first slot that is not already pushing), and a 750 ms timer to take it off.
const kickRacer = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  direction: Vector3
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  if ((racer.flags & RACER_KICKED_FLAG) !== 0) return racerSet
  const slid = startCarBodySlide(
    context.arithmetic,
    context.tables,
    racer.carBody,
    KICK_SLIDE_STRENGTH,
    KICK_SLIDE_DAMPING,
    KICK_SLIDE_RATE
  )
  const isFirstFree = (slid.rigidBody.flags & KICK_EXTRA_FORCE_A) === 0
  const isSecondFree = (slid.rigidBody.flags & KICK_EXTRA_FORCE_B) === 0
  const reactionKind = isFirstFree ? 1 : isSecondFree ? 2 : racer.reactionKind
  const carBody = isFirstFree
    ? setCarBodyPush(context.arithmetic, slid, 'extraForceA', direction)
    : isSecondFree
      ? setCarBodyPush(context.arithmetic, slid, 'extraForceB', direction)
      : slid
  return setRacer(
    racerSet,
    racerIndex,
    Object.freeze({
      ...racer,
      carBody,
      reactionKind,
      contactTimerMilliseconds: 0,
      flags: racer.flags | RACER_KICKED_FLAG,
    })
  )
}

// The 750 ms timer's event (0x00438560 with type 1): the kick ends. 0x00439870 is called only for a racer
// that is not power sliding, and returns at once then.
export const endRacerKick = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet =>
  updateRacer(racerSet, racerIndex, (racer) => {
    const released =
      racer.reactionKind === 1
        ? setCarBodyPush(context.arithmetic, racer.carBody, 'extraForceA', undefined)
        : racer.reactionKind === 2
          ? setCarBodyPush(context.arithmetic, racer.carBody, 'extraForceB', undefined)
          : racer.carBody
    return Object.freeze({
      ...racer,
      carBody: released,
      flags: racer.flags & ~RACER_KICKED_FLAG,
      reactionKind: 0,
      contactTimerMilliseconds: null,
    })
  })

// 0x00438bec..0x00438db0: a racer with flag 0x1 does its attack to one without it.
const attackRacer = (
  context: RacerSetContext,
  racerSet: RacerSet,
  attackerIndex: number,
  victimIndex: number,
  victimRadius: Vector3
): RacerSet => {
  const { arithmetic } = context
  const attacker = getRacer(racerSet, attackerIndex)
  const victim = getRacer(racerSet, victimIndex)
  if (attacker.attackKind === 1) {
    const { rotation } = victim.carBody.rigidBody.displayFrame
    const alignment = arithmetic.add(
      arithmetic.add(
        arithmetic.multiply(getMatrixElement(rotation, 2), victimRadius.z),
        arithmetic.multiply(getMatrixElement(rotation, 1), victimRadius.y)
      ),
      arithmetic.multiply(getMatrixElement(rotation, 0), victimRadius.x)
    )
    if (!arithmetic.getIsBelow(alignment, KICK_LIMIT)) return racerSet
    if (arithmetic.getIsBelowOrEqual(alignment, -KICK_LIMIT)) return racerSet
    const { storeFloat, multiply } = arithmetic
    return kickRacer(
      context,
      racerSet,
      victimIndex,
      Object.freeze({
        x: storeFloat(multiply(victimRadius.x, KICK_SCALE)),
        y: storeFloat(multiply(victimRadius.y, KICK_SCALE)),
        z: storeFloat(multiply(victimRadius.z, KICK_SCALE)),
      })
    )
  }
  const factor =
    attacker.attackKind === 2
      ? SMALL_SPIN_FACTOR
      : attacker.attackKind === 3
        ? LARGE_SPIN_FACTOR
        : undefined
  if (factor === undefined) return racerSet
  return setRacer(
    racerSet,
    victimIndex,
    Object.freeze({
      ...victim,
      carBody: startCarBodySpin(arithmetic, victim.carBody, factor, SPIN_RATE, 0),
    })
  )
}

// 0x00438560, type 3 event (thiscall on the first racer's listener): the response to two car bodies in contact.
// The first car body is moved out by depth · normal, then an impulse along the normal changes both
// velocities; computers fade, the slower human gets a voice line, and racers with flag 0x1 or a timed
// effect pass them on. Presentation (sounds, sparks) is not modelled; the random draw that picks the
// collision sound is.
export const respondToRacerContact = (
  context: RacerSetContext,
  racerSet: RacerSet,
  firstIndex: number,
  secondIndex: number,
  contact: BoxContact,
  dependencies: RacerCollisionDependencies
): RacerSet => {
  const { arithmetic } = context
  const { subtract, multiply, storeFloat, getIsBelow, getIsEqual } = arithmetic
  const initialFirst = getRacer(racerSet, firstIndex)
  const initialSecond = getRacer(racerSet, secondIndex)
  if ((initialFirst.flags & RACER_DISABLED_FLAG) !== 0) return racerSet
  if ((initialSecond.flags & RACER_DISABLED_FLAG) !== 0) return racerSet
  if ((initialFirst.carBody.rigidBody.flags & CarRigidBodyFlag.FLAGGED) !== 0) return racerSet
  if ((initialSecond.carBody.rigidBody.flags & CarRigidBodyFlag.FLAGGED) !== 0) return racerSet
  const { normal, depth } = contact
  const displacement = Object.freeze({
    x: storeFloat(multiply(depth, normal.x)),
    y: storeFloat(multiply(normal.y, depth)),
    z: storeFloat(multiply(normal.z, depth)),
  })
  // 0x00429680
  const separated = initialFirst.carBody.isScripted
    ? dependencies.separateScriptedCarBody(context, racerSet, firstIndex, displacement)
    : updateRacer(racerSet, firstIndex, (racer) =>
        Object.freeze({
          ...racer,
          carBody: Object.freeze({
            ...racer.carBody,
            rigidBody: moveOutOfContact(
              arithmetic,
              racer.carBody.rigidBody,
              displacement,
              context.collisionObjects
            ),
          }),
        })
      )
  const first = getRacer(separated, firstIndex)
  const second = getRacer(separated, secondIndex)
  const impulse = getImpulse(arithmetic, first, second, contact)
  const hitFirst = updateRacer(separated, firstIndex, (racer) =>
    Object.freeze({
      ...racer,
      carBody: addCarBodyImpulse(arithmetic, racer.carBody, normal, impulse),
      forceFeedback: getRestartedForceFeedback(racer.forceFeedback, HIT_STRENGTH),
    })
  )
  const hit = updateRacer(hitFirst, secondIndex, (racer) =>
    Object.freeze({
      ...racer,
      carBody: addCarBodyImpulse(arithmetic, racer.carBody, normal, -impulse),
      forceFeedback: getRestartedForceFeedback(racer.forceFeedback, HIT_STRENGTH),
    })
  )
  // 0x00438aac..0x00438bec
  const hitFirstRacer = getRacer(hit, firstIndex)
  const hitSecondRacer = getRacer(hit, secondIndex)
  let current = hit
  if (
    hitFirstRacer.controllerKind === COMPUTER_CONTROLLER &&
    hitSecondRacer.controllerKind === COMPUTER_CONTROLLER
  ) {
    const fade = (racerIndex: number): RacerSet =>
      updateRacer(current, racerIndex, (racer) =>
        getIsEqual(racer.carBody.fadeFactor, UNIT)
          ? Object.freeze({ ...racer, fadeMilliseconds: CONTACT_TIMER_MILLISECONDS })
          : racer
      )
    current = fade(firstIndex)
    current = fade(secondIndex)
  } else if (
    getIsBelow(hitSecondRacer.carBody.rigidBody.speed, hitFirstRacer.carBody.rigidBody.speed)
  ) {
    if (
      hitFirstRacer.collisionSoundMilliseconds === 0 &&
      hitSecondRacer.collisionSoundMilliseconds === 0
    ) {
      const draw = drawRandomValue(context.tables.randomTable, current.randomPosition)
      current = setRandomPosition(
        updateRacer(
          updateRacer(current, firstIndex, (racer) =>
            Object.freeze({ ...racer, collisionSoundMilliseconds: CONTACT_SOUND_MILLISECONDS })
          ),
          secondIndex,
          (racer) =>
            Object.freeze({ ...racer, collisionSoundMilliseconds: CONTACT_SOUND_MILLISECONDS })
        ),
        draw.position
      )
    }
    current = playRacerVoice(context, current, secondIndex)
  } else {
    current = playRacerVoice(context, current, firstIndex)
  }
  // 0x00438bec..0x00438db0
  const radiusOf = (racerIndex: number): Vector3 => {
    const racer = getRacer(current, racerIndex)
    const centre = racer.carBody.rigidBody.worldCentreOfMass
    return getNormalizedVector3(
      arithmetic,
      Object.freeze({
        x: storeFloat(subtract(centre.x, contact.point.x)),
        y: storeFloat(subtract(centre.y, contact.point.y)),
        z: storeFloat(subtract(centre.z, contact.point.z)),
      })
    )
  }
  const isFirstAttacking = (getRacer(current, firstIndex).flags & RACER_ATTACKING_FLAG) !== 0
  const isSecondAttacking = (getRacer(current, secondIndex).flags & RACER_ATTACKING_FLAG) !== 0
  if (isFirstAttacking && !isSecondAttacking) {
    current = attackRacer(context, current, firstIndex, secondIndex, radiusOf(secondIndex))
  } else if (!isFirstAttacking && isSecondAttacking) {
    current = attackRacer(context, current, secondIndex, firstIndex, radiusOf(firstIndex))
  }
  // 0x00438db0..0x00438e2c
  const firstAfter = getRacer(current, firstIndex)
  const secondAfter = getRacer(current, secondIndex)
  const canPassOn = (giver: Racer, receiver: Racer): boolean =>
    (giver.flags & RACER_TIMED_EFFECT_FLAG) !== 0 &&
    (receiver.flags & RACER_TIMED_EFFECT_FLAG) === 0 &&
    giver.timedEffectCharge !== 0 &&
    (receiver.flags & RACER_ATTACKING_FLAG) === 0
  if (canPassOn(firstAfter, secondAfter)) {
    current = dependencies.transferTimedEffect(context, current, secondIndex, firstIndex)
    current = dependencies.endTimedEffect(context, current, firstIndex, 0)
  } else if (canPassOn(secondAfter, firstAfter)) {
    current = dependencies.transferTimedEffect(context, current, firstIndex, secondIndex)
    current = dependencies.endTimedEffect(context, current, secondIndex, 0)
  }
  const mark = (racerIndex: number): RacerSet =>
    updateRacer(current, racerIndex, (racer) =>
      Object.freeze({ ...racer, flags: racer.flags | RACER_CONTACT_FLAG })
    )
  current = mark(firstIndex)
  return mark(secondIndex)
}

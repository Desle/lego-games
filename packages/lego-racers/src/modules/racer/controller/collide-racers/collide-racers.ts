import { getRegistryContacts, getSortedRegistryEntries } from '../../../projectiles/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import {
  getBoundingInterval,
  getBoundingSphere,
  getBoxContact,
  getSpheresOverlap,
} from '../../../racer-collision/index.ts'
import type {
  BoundingInterval,
  BoundingSphere,
  OrientedBox,
} from '../../../racer-collision/index.ts'
import { getFigureBounds } from '../../types/figure/figure.ts'
import { getRacer, setRacer } from '../../types/racer-state/racer-state.ts'
import type {
  Racer,
  RacerCollisionDependencies,
  RacerPassDependencies,
  RacerSet,
  RacerSetBoundary,
  RacerSetContext,
} from '../../types/racer.types.ts'
import { endRacerKick, respondToRacerContact } from '../racer-contact/racer-contact.ts'
import { endTimedEffect, transferTimedEffect } from '../timed-effect/timed-effect.ts'

const CONTACT_TIMER_PERIOD_MILLISECONDS = 750 // 0x2ee, 0x00438e60

// 0x004113c0 -> 0x0040e0b0 on the display figure (racer +0x5c): its animation decides the sphere. A figure without
// a model part has radius 0 around the origin.
export const getRacerSphere = (context: RacerSetContext, racer: Racer): BoundingSphere => {
  const bounds = getFigureBounds(context.arithmetic, racer.figure)
  if (bounds === null) return { centre: ZERO_VECTOR3, radius: 0 }
  return getBoundingSphere(
    context.arithmetic,
    racer.carBody.rigidBody.displayFrame,
    bounds.centre,
    bounds.radius
  )
}

const getInterval = (context: RacerSetContext, racer: Racer): BoundingInterval =>
  getBoundingInterval(context.arithmetic, getRacerSphere(context, racer))

// The box 0x00441790 and 0x00441330 read: the physics frame's rotation, the world centre of mass, the
// dimensions and the car body's scale (+0xdc).
const getBox = (racer: Racer): OrientedBox => {
  const { rigidBody, fadeFactor } = racer.carBody
  return Object.freeze({
    rotation: rigidBody.frame.rotation,
    centre: rigidBody.worldCentreOfMass,
    dimensions: rigidBody.dimensions,
    scale: fadeFactor,
  })
}

// 0x0042fc10: every timer counts the step; one that reaches its period fires its event and ends.
const stepContactTimers = (
  context: RacerSetContext,
  racerSet: RacerSet,
  stepMilliseconds: number
): RacerSet =>
  racerSet.racers.reduce((current, _racer, racerIndex) => {
    const racer = getRacer(current, racerIndex)
    if (racer.contactTimerMilliseconds === null) return current
    const elapsed = (racer.contactTimerMilliseconds + stepMilliseconds) >>> 0
    if (elapsed < CONTACT_TIMER_PERIOD_MILLISECONDS) {
      return setRacer(
        current,
        racerIndex,
        Object.freeze({ ...racer, contactTimerMilliseconds: elapsed })
      )
    }
    return endRacerKick(context, current, racerIndex)
  }, racerSet)

// 0x0043aca0: an insertion sort of list +0x2c by the lowest x of each bounding sphere. An element smaller
// than the largest so far is moved back past every element larger than it (equal keys stay in order).
const sortByIntervalMinimum = (context: RacerSetContext, racerSet: RacerSet): readonly number[] => {
  const { getIsBelow, getIsBelowOrEqual } = context.arithmetic
  const getKey = (racerIndex: number): number =>
    getInterval(context, getRacer(racerSet, racerIndex)).minimum
  const order = [...racerSet.collisionOrder]
  for (let position = 1; position < order.length; position += 1) {
    const racerIndex = order[position]
    const previous = order[position - 1]
    if (racerIndex === undefined || previous === undefined) continue
    const key = getKey(racerIndex)
    if (!getIsBelow(key, getKey(previous))) continue
    order.splice(position, 1)
    let target = 0
    for (let candidate = position - 2; candidate >= 0; candidate -= 1) {
      const candidateIndex = order[candidate]
      if (candidateIndex !== undefined && getIsBelowOrEqual(getKey(candidateIndex), key)) {
        target = candidate + 1
        break
      }
    }
    order.splice(target, 0, racerIndex)
  }
  return Object.freeze(order)
}

// 0x0043ab90 with 0x0043ab10: for each racer in list order, the racers after it whose sphere starts no
// further than the end of its own are tested; spheres that overlap go on to the box test, and a
// contact with a depth that is not 0 is answered by the first racer's listener (node flags 0x5: no
// reciprocal call). The first racer's sphere is read again for every candidate because the answer moves it.
const sweepRacerPairs = (
  context: RacerSetContext,
  racerSet: RacerSet,
  dependencies: RacerCollisionDependencies
): RacerSet => {
  const { getIsEqual, getIsBelowOrEqual } = context.arithmetic
  const order = racerSet.collisionOrder
  let current = racerSet
  for (const [position, firstIndex] of order.entries()) {
    for (const secondIndex of order.slice(position + 1)) {
      const first = getRacer(current, firstIndex)
      const second = getRacer(current, secondIndex)
      const firstSphere = getRacerSphere(context, first)
      const firstMaximum = getBoundingInterval(context.arithmetic, firstSphere).maximum
      if (!getIsBelowOrEqual(getInterval(context, second).minimum, firstMaximum)) break
      if (!getSpheresOverlap(context.arithmetic, firstSphere, getRacerSphere(context, second)))
        continue
      const contact = getBoxContact(context.arithmetic, getBox(first), getBox(second))
      if (contact === undefined || getIsEqual(contact.depth, 0)) continue
      current = respondToRacerContact(
        context,
        current,
        firstIndex,
        secondIndex,
        contact,
        dependencies
      )
    }
  }
  return current
}

const COMPUTER_CONTROLLER = 2

// 0x0043d270 with 0x0043d200: the entries registered with the manager are sorted, each racer in list order is
// matched against the entries along its sphere's x extent (projectiles' registry), and the entries sort again.
// Every racer node is active.
const touchRegistryEntries = (
  context: RacerSetContext,
  racerSet: RacerSet,
  dependencies: RacerPassDependencies
): RacerSet => {
  const racers = racerSet.collisionOrder.map((racerIndex) => {
    const racer = getRacer(racerSet, racerIndex)
    const interval = getInterval(context, racer)
    return {
      racer: racerIndex,
      isComputer: racer.controllerKind === COMPUTER_CONTROLLER,
      isActive: true,
      minimumExtent: interval.minimum,
      maximumExtent: interval.maximum,
    }
  })
  const result = getRegistryContacts(
    getSortedRegistryEntries(racerSet.registryEntries),
    racers,
    (racerIndex, entry) =>
      dependencies.getIsTouchingRegistryEntry(context, racerSet, racerIndex, entry)
  )
  return Object.freeze({
    ...racerSet,
    registryEntries: getSortedRegistryEntries(result.entries),
    registryContacts: result.contacts,
  })
}

// Pass 4 of RacerSet_Step: the collision manager at racer set +0xf0 (0x0043d180, vtable 0x004b0aa8 slot 4):
// timers (0x0042fc10), the sort (0x0043aca0), the sweep (0x0043ab90). List +0x28 (events between two
// shapes) holds nothing from racers and is not modelled.
export const collideRacers = (
  context: RacerSetContext,
  racerSet: RacerSet,
  stepMilliseconds: number,
  dependencies: RacerPassDependencies
): RacerSet => {
  const timed = stepContactTimers(context, racerSet, stepMilliseconds)
  const sorted: RacerSet = Object.freeze({
    ...timed,
    collisionOrder: sortByIntervalMinimum(context, timed),
  })
  return touchRegistryEntries(context, sweepRacerPairs(context, sorted, dependencies), dependencies)
}

const keepRacerSet = (_context: RacerSetContext, racerSet: RacerSet): RacerSet => racerSet

// Stand-ins for the calls the collision response makes into code this module does not port.
export const RACER_COLLISION_DEPENDENCIES_NOT_YET_PORTED: RacerPassDependencies = Object.freeze({
  getIsTouchingRegistryEntry: () => false,
  separateScriptedCarBody: keepRacerSet,
  transferTimedEffect,
  endTimedEffect,
})

export const createCollideRacers =
  (dependencies: RacerPassDependencies): RacerSetBoundary =>
  (context, racerSet, stepMilliseconds) =>
    collideRacers(context, racerSet, stepMilliseconds, dependencies)

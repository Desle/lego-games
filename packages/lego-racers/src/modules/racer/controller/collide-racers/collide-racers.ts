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
  CollisionBodyNode,
  Racer,
  RacerCollisionDependencies,
  RacerPassDependencies,
  RacerSet,
  RacerSetBoundary,
  RacerSetContext,
} from '../../types/racer.types.ts'
import {
  endRacerKick,
  respondToBodyContact,
  respondToRacerContact,
} from '../racer-contact/racer-contact.ts'
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

const getIsRacerNode = (racerSet: RacerSet, nodeNumber: number): boolean =>
  nodeNumber < racerSet.racers.length

const getBodyNode = (racerSet: RacerSet, nodeNumber: number): CollisionBodyNode | undefined =>
  racerSet.collisionBodies[nodeNumber - racerSet.racers.length]

// The shape a node holds, whichever it is: a racer's display figure, or a registered body's figure (rigid body +4).
const getNodeSphere = (
  context: RacerSetContext,
  racerSet: RacerSet,
  nodeNumber: number
): BoundingSphere =>
  getIsRacerNode(racerSet, nodeNumber)
    ? getRacerSphere(context, getRacer(racerSet, nodeNumber))
    : (getBodyNode(racerSet, nodeNumber)?.body.sphere ?? { centre: ZERO_VECTOR3, radius: 0 })

const getNodeInterval = (
  context: RacerSetContext,
  racerSet: RacerSet,
  nodeNumber: number
): BoundingInterval =>
  getBoundingInterval(context.arithmetic, getNodeSphere(context, racerSet, nodeNumber))

// The node's `+0x24`: a racer's node always is active; a body's ends with its hazard.
const getIsNodeActive = (racerSet: RacerSet, nodeNumber: number): boolean =>
  getIsRacerNode(racerSet, nodeNumber) || getBodyNode(racerSet, nodeNumber)?.isActive === true

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
  const getKey = (nodeNumber: number): number =>
    getNodeInterval(context, racerSet, nodeNumber).minimum
  const order = [...racerSet.collisionOrder]
  for (let position = 1; position < order.length; position += 1) {
    const nodeNumber = order[position]
    const previous = order[position - 1]
    if (nodeNumber === undefined || previous === undefined) continue
    const key = getKey(nodeNumber)
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
    order.splice(target, 0, nodeNumber)
  }
  return Object.freeze(order)
}

// 0x0043ab10: the box test of two shapes that met, and the answer of the racer's listener (0x00438560). A pair of two
// racers is answered by the first (node flags 0x5: no reciprocal call); a racer and a registered body (node flags
// 0x1) by the racer whichever comes first, because the body's own listener (0x004513d0) does nothing and the
// reciprocal call gives the racer the pair with itself first. Two bodies do nothing.
const answerOverlap = (
  context: RacerSetContext,
  racerSet: RacerSet,
  firstNode: number,
  secondNode: number,
  dependencies: RacerCollisionDependencies
): RacerSet => {
  const { getIsEqual } = context.arithmetic
  const isFirstRacer = getIsRacerNode(racerSet, firstNode)
  const isSecondRacer = getIsRacerNode(racerSet, secondNode)
  if (isFirstRacer && isSecondRacer) {
    const contact = getBoxContact(
      context.arithmetic,
      getBox(getRacer(racerSet, firstNode)),
      getBox(getRacer(racerSet, secondNode))
    )
    if (contact === undefined || getIsEqual(contact.depth, 0)) return racerSet
    return respondToRacerContact(context, racerSet, firstNode, secondNode, contact, dependencies)
  }
  if (!isFirstRacer && !isSecondRacer) return racerSet
  const racerIndex = isFirstRacer ? firstNode : secondNode
  const bodyNode = getBodyNode(racerSet, isFirstRacer ? secondNode : firstNode)
  if (bodyNode === undefined) return racerSet
  const contact = getBoxContact(
    context.arithmetic,
    getBox(getRacer(racerSet, racerIndex)),
    bodyNode.body.box
  )
  if (contact === undefined || getIsEqual(contact.depth, 0)) return racerSet
  return respondToBodyContact(context, racerSet, racerIndex, bodyNode.body, contact, dependencies)
}

// 0x0043ab90 with 0x0043ab10: for each node in list order, the nodes after it whose sphere starts no
// further than the end of its own are tested; spheres that overlap go on to the box test, and a
// contact with a depth that is not 0 is answered. The first node's sphere is read again for every
// candidate because the answer moves it.
const sweepRacerPairs = (
  context: RacerSetContext,
  racerSet: RacerSet,
  dependencies: RacerCollisionDependencies
): RacerSet => {
  const { getIsBelowOrEqual } = context.arithmetic
  const order = racerSet.collisionOrder
  let current = racerSet
  for (const [position, firstNode] of order.entries()) {
    if (!getIsNodeActive(current, firstNode)) continue
    for (const secondNode of order.slice(position + 1)) {
      const firstSphere = getNodeSphere(context, current, firstNode)
      const firstMaximum = getBoundingInterval(context.arithmetic, firstSphere).maximum
      const secondSphere = getNodeSphere(context, current, secondNode)
      if (
        !getIsBelowOrEqual(
          getBoundingInterval(context.arithmetic, secondSphere).minimum,
          firstMaximum
        )
      )
        break
      if (!getIsNodeActive(current, secondNode)) continue
      if (!getSpheresOverlap(context.arithmetic, firstSphere, secondSphere)) continue
      current = answerOverlap(context, current, firstNode, secondNode, dependencies)
    }
  }
  return current
}

const COMPUTER_CONTROLLER = 2

// 0x0043d270 with 0x0043d200: the entries registered with the manager are sorted, each racer in list order is
// matched against the entries along its volume's x extent (the volume the last Vehicle_Update measured, 0x0043aaf0) (projectiles' registry), and the entries sort again.
// Every racer node is active.
const touchRegistryEntries = (
  context: RacerSetContext,
  racerSet: RacerSet,
  dependencies: RacerPassDependencies
): RacerSet => {
  const racers = racerSet.collisionOrder
    .filter((nodeNumber) => getIsRacerNode(racerSet, nodeNumber))
    .map((racerIndex) => {
      const racer = getRacer(racerSet, racerIndex)
      // 0x0043aaf0: the registry walk reads the racer's composite volume (racer +0x1c) and its cached x extents, as
      // the touch test does; the sort and the racer pairs read the figure's sphere.
      const interval =
        racer.vehicle.volume === null
          ? getInterval(context, racer)
          : getBoundingInterval(context.arithmetic, racer.vehicle.volume)
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

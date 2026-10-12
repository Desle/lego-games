import { getHazardCollisionBody } from '../../../hazard/index.ts'
import type { CollisionBodyNode } from '../../../racer/index.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'

// The hazards that sit in the racers' collision list (0x0048be00 registers the hammer's rigid body through 0x0042fb50
// and 0x0043aa40, which prepend it to list +0x2c; 0x0048be50 ends the node, +0x24 = 0) as nodes of that list. A node
// that began since the last call goes to the head of `collisionOrder`, one that ended leaves it, and each live node
// takes the pose its hazard's last update gave it.
export const getRacerSetWithCollisionBodies = (racerSet: RaceRacerSet): RaceRacerSet => {
  const { hazards } = racerSet.trackLogic
  const racerCount = racerSet.racers.length
  let bodies = racerSet.collisionBodies
  let order = racerSet.collisionOrder
  hazards.instances.forEach((_instance, hazardIndex) => {
    const body = getHazardCollisionBody(hazards, hazardIndex)
    const nodeIndex = bodies.findIndex((node) => node.isActive && node.owner === hazardIndex)
    const node = bodies[nodeIndex]
    if (node === undefined) {
      if (body === null) return
      const fresh: CollisionBodyNode = Object.freeze({ owner: hazardIndex, isActive: true, body })
      order = Object.freeze([racerCount + bodies.length, ...order])
      bodies = Object.freeze([...bodies, fresh])
      return
    }
    if (body === node.body) return
    const changed: CollisionBodyNode = Object.freeze(
      body === null ? { ...node, isActive: false } : { ...node, body }
    )
    if (body === null) {
      order = Object.freeze(order.filter((entry) => entry !== racerCount + nodeIndex))
    }
    bodies = Object.freeze(
      bodies.map((candidate, index) => (index === nodeIndex ? changed : candidate))
    )
  })
  return bodies === racerSet.collisionBodies && order === racerSet.collisionOrder
    ? racerSet
    : Object.freeze({ ...racerSet, collisionBodies: bodies, collisionOrder: order })
}

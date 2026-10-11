import { loadCollisionObject } from '../../../collision/index.ts'
import type { CollisionObject } from '../../../collision/index.ts'
import { getRotationFromFrameAxes } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { readWorld } from '../../../world/index.ts'
import type { CollisionWorld } from './load-race.types.ts'

// The collision world of a race (RAB keyword 0x2b, race +0x3a0, loaded by 0x00432e20): a world file whose BSP volume
// instances name the .BVB files the cars collide with and place them (position, forward and up axes). The instances
// are kept in world order; the race looks them up by name (the hash table at world +0xd8).
export const loadCollisionWorld = (
  arithmetic: FloatArithmetic,
  worldBytes: Uint8Array | null,
  readFile: (name: string) => Uint8Array
): CollisionWorld => {
  if (worldBytes === null) return { objects: [], names: [] }
  const world = readWorld(worldBytes)
  const objects = world.bspVolumeInstances.map((instance): CollisionObject => {
    const volumeName = world.bspVolumes[instance.bspVolumeIndex]
    if (volumeName === undefined) {
      throw new RangeError(`The instance ${instance.name} names no volume`)
    }
    if (instance.materialAssignmentIndex !== -1) {
      throw new RangeError(`The instance ${instance.name} replaces its material list`)
    }
    return loadCollisionObject({
      bytes: readFile(`${volumeName.toUpperCase()}.BVB`),
      isMirrored: false,
      frame: Object.freeze({
        rotation: getRotationFromFrameAxes(arithmetic, {
          first: instance.forward,
          third: instance.up,
        }),
        position: instance.position,
      }),
    })
  })
  return { objects, names: world.bspVolumeInstances.map((instance) => instance.name) }
}

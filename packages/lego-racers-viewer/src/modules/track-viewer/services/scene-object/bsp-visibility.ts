import { getVisibleBspLeaves } from '@lego-games/lego-racers/bsp-tree'
import type { BspPlane, BspTree, BspVisibilityQuery } from '@lego-games/lego-racers/bsp-tree'
import type { Matrix4, Mesh } from 'three'
import { Plane, Vector3 } from 'three'
import type { FrustumView } from '../race-viewport/race-viewport.types.ts'
import type { BspLevelMeshes } from './scene-object.types.ts'

// The first command of the draw batch a mesh shows (GolDP.dll 0x10006c50 walks the commands in order).
export const batchFirstCommands = new WeakMap<Mesh, number>()

// The camera's position and frustum planes in the frame of the track's group (a mirrored race scales it).
export const getLocalVisibilityQuery = (
  view: FrustumView,
  worldToLocal: Matrix4
): BspVisibilityQuery => {
  const eye = new Vector3(view.eye.x, view.eye.y, view.eye.z).applyMatrix4(worldToLocal)
  const planes = view.planes.map(([normalX, normalY, normalZ, offset]): BspPlane => {
    const plane = new Plane(new Vector3(normalX, normalY, normalZ), offset)
    plane.applyMatrix4(worldToLocal)
    return [plane.normal.x, plane.normal.y, plane.normal.z, plane.constant]
  })
  return Object.freeze({ eye: [eye.x, eye.y, eye.z], planes })
}

const getIsCommandVisible = (
  leaves: ReturnType<typeof getVisibleBspLeaves>,
  command: number
): boolean =>
  leaves.some(
    (leaf) => leaf.firstCommand <= command && command < leaf.firstCommand + leaf.commandCount
  )

// GolDP.dll 0x100092a0: a BSP tree instance draws only the leaves the camera's visibility list names, whose volume
// the frustum does not reject.
export const showVisibleLeaves = (
  tree: BspTree,
  levelMeshes: readonly BspLevelMeshes[],
  query: BspVisibilityQuery
): void => {
  const leaves = getVisibleBspLeaves(tree, query)
  for (const { meshes } of levelMeshes) {
    for (const mesh of meshes) {
      mesh.visible = getIsCommandVisible(leaves, batchFirstCommands.get(mesh) ?? 0)
    }
  }
}

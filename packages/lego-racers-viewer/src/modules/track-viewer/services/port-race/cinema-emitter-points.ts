import { getBillboardAxes, getEmitterQuads } from '@lego-games/lego-racers/emitter'
import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import type { SceneCamera } from '@lego-games/lego-racers/scene'
import type { ScreenRectangle } from './cinema-emitter-points.types.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '@lego-games/lego-racers/simulation-math'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

const subtract = (left: readonly number[], right: readonly number[]): number[] =>
  left.map((value, index) => value - (right[index] ?? 0))
const dot = (left: readonly number[], right: readonly number[]): number =>
  left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0)
const cross = (left: readonly number[], right: readonly number[]): number[] => [
  (left[1] ?? 0) * (right[2] ?? 0) - (left[2] ?? 0) * (right[1] ?? 0),
  (left[2] ?? 0) * (right[0] ?? 0) - (left[0] ?? 0) * (right[2] ?? 0),
  (left[0] ?? 0) * (right[1] ?? 0) - (left[1] ?? 0) * (right[0] ?? 0),
]
const normalize = (vector: readonly number[]): number[] => {
  const length = Math.hypot(...vector)
  return vector.map((value) => value / length)
}

// The screen positions (pixels of the menu surface) of the corners of the pool's particle quads seen from the world camera
// through the item's rectangle: a pinhole camera with the camera's vertical field of view and the rectangle's aspect.
export const getEmitterScreenPoints = (
  pool: EmitterPool,
  camera: SceneCamera,
  rectangle: ScreenRectangle
): readonly (readonly number[])[] => {
  const forward = normalize([camera.forward.x, camera.forward.y, camera.forward.z])
  const up = normalize([camera.up.x, camera.up.y, camera.up.z])
  const right = normalize(cross(forward, up))
  const position = [camera.position.x, camera.position.y, camera.position.z]
  const axes = getBillboardAxes(
    arithmetic,
    { x: forward[0] ?? 0, y: forward[1] ?? 0, z: forward[2] ?? 0 },
    { x: up[0] ?? 0, y: up[1] ?? 0, z: up[2] ?? 0 }
  )
  const halfHeight = Math.tan((camera.fieldOfViewDegrees * Math.PI) / 360)
  const halfWidth = (halfHeight * rectangle.width) / rectangle.height
  return pool.instances.flatMap((instance) =>
    getEmitterQuads(arithmetic, instance.system, pool.animation, {
      position: camera.position,
      axes,
    }).flatMap((quad) => {
      const corners = quad.corners.map((corner) => {
        const relative = subtract([corner.x, corner.y, corner.z], position)
        const depth = dot(relative, forward)
        return [
          rectangle.left + (0.5 + dot(relative, right) / (depth * 2 * halfWidth)) * rectangle.width,
          rectangle.top + (0.5 - dot(relative, up) / (depth * 2 * halfHeight)) * rectangle.height,
        ]
      })
      return corners
    })
  )
}

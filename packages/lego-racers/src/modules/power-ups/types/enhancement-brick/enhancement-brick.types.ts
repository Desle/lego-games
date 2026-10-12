import type { Vector3 } from '../../../simulation-math/index.ts'

// The track world's line query 0x0041f4d0 (owned by the world module): the point it writes, or null for a miss. On a hit
// `onNormal` receives the normal of the triangle (the plane it writes at +0x24 of its third argument).
export type GroundQuery = (
  start: Vector3,
  end: Vector3,
  onNormal?: (normal: Vector3) => void
) => Vector3 | null

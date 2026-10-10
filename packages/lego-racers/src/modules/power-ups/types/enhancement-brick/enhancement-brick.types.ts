import type { Vector3 } from '../../../simulation-math/index.ts'

// The track world's line query 0x0041f4d0 (owned by the world module): the point it writes, or null for a miss.
export type GroundQuery = (start: Vector3, end: Vector3) => Vector3 | null

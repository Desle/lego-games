import { getSegmentQueryResult } from '../../../collision/index.ts'
import type { CollisionVolume } from '../../../collision/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { LineProbe } from '../projectiles.types.ts'

// 0x0041f730 over the track's collision volume (the last step of 0x0041f4d0, which first tests the world's
// dynamic sphere objects at +0xa8; those are not ported). A hit on a material with flag 0x20000 counts as a miss.
export const createTrackLineProbe =
  (
    arithmetic: FloatArithmetic,
    volume: CollisionVolume,
    getIsMaterialPassThrough: (materialIndex: number) => boolean
  ): LineProbe =>
  (start, end) => {
    const { intersection } = getSegmentQueryResult(arithmetic, volume, start, end)
    if (intersection === undefined || getIsMaterialPassThrough(intersection.materialIndex)) {
      return null
    }
    return Object.freeze({ point: intersection.point, normal: intersection.triangle.normal })
  }

import { getSegmentQueryResult } from '../../../collision/index.ts'
import type { CollisionVolume } from '../../../collision/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { LineProbe } from '../projectiles.types.ts'
import type { ProbeSurface } from './track-line-probe.types.ts'

export const NO_PROBE_SURFACE: ProbeSurface = Object.freeze({
  isPassThrough: false,
  signalIdentifier: null,
})

// 0x0041f730 over the track's collision volume (the last step of 0x0041f4d0, which first tests the world's
// dynamic sphere objects at +0xa8; those are not ported). A hit on a material with flag 0x10 starts and stops its
// signal at the hit point; one with flag 0x20000 counts as a miss (the signal comes first).
export const createTrackLineProbe =
  (
    arithmetic: FloatArithmetic,
    volume: CollisionVolume,
    getSurface: (materialIndex: number) => ProbeSurface
  ): LineProbe =>
  (start, end, onSurfaceSignal) => {
    const { intersection } = getSegmentQueryResult(arithmetic, volume, start, end)
    if (intersection === undefined) return null
    const surface = getSurface(intersection.materialIndex)
    if (surface.signalIdentifier !== null) {
      onSurfaceSignal?.(surface.signalIdentifier, intersection.point)
    }
    if (surface.isPassThrough) return null
    return Object.freeze({ point: intersection.point, normal: intersection.triangle.normal })
  }

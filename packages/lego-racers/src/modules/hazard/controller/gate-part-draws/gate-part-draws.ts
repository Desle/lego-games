import { getTruncatedInteger } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { RaceWorlds, SkeletonInstanceRuntime } from '../../../world-animation/index.ts'
import type { GatePartDraw } from '../../types/gate-part-draw.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardRuntime } from '../../types/hazard-runtime.types.ts'

// 0x0048f0f8 multiplies by the float 255.0 at 0x004b09c0.
const OPAQUE_ALPHA = 255

// 0x0048f0c2..0x0048f0fe: ftol((frame count - time) / frame count * 255) of the clip the part plays (instance +0xbc, the
// clip's int16 +0x24, the time +0xb4), so the pieces fade out as their clip runs.
const getPartAlpha = (arithmetic: FloatArithmetic, part: SkeletonInstanceRuntime): number => {
  const { animation, clip } = part
  const frameCount = clip === null ? undefined : animation?.clips[clip.clip.clipIndex]?.frameCount
  if (clip === null || frameCount === undefined) return OPAQUE_ALPHA
  const remaining = arithmetic.subtract(frameCount, clip.clip.timeInFrames)
  return getTruncatedInteger(
    arithmetic.multiply(arithmetic.divide(remaining, frameCount), OPAQUE_ALPHA)
  )
}

// 0x0048f080 (the gate's draw slot, from the race's per-frame draw 0x00435a00 through 0x0048ae30): a gate that is not idle
// draws each of its parts itself, with the first part's distances as it loaded and the alpha of its clip; Begin
// (0x0048ef70) has zeroed the parts' own distances, so once the gate is idle again nothing draws them.
export const getGatePartDraws = (
  arithmetic: FloatArithmetic,
  runtime: HazardRuntime,
  worlds: Pick<RaceWorlds, 'track' | 'blended'>
): readonly GatePartDraw[] =>
  runtime.instances.flatMap((hazard): readonly GatePartDraw[] => {
    const { data } = hazard
    if (data.keyword !== HazardKeyword.HAZARD_34 || hazard.lifecycle === HazardLifecycle.IDLE) {
      return []
    }
    return data.parts.flatMap((reference): readonly GatePartDraw[] => {
      if (reference === null || reference.kind !== 'skeleton') return []
      const part = worlds[reference.world].skeletonInstances[reference.index]
      if (part === undefined) return []
      return [
        Object.freeze({
          world: reference.world,
          instanceName: part.name,
          levelSquaredDistances: data.drawnLevelSquaredDistances,
          alpha: getPartAlpha(arithmetic, part),
        }),
      ]
    })
  })

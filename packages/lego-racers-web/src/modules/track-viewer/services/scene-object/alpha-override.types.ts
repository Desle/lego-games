import type { SceneRenderState } from '@lego-games/lego-racers/scene'
import type { Blending, BlendingDstFactor, BlendingSrcFactor } from 'three'

// What a material was built with, kept while an alpha override stands in for its blend.
export type AlphaOverrideOriginal = {
  readonly blending: Blending
  readonly blendSrc: BlendingSrcFactor
  readonly blendDst: BlendingDstFactor
  readonly blendSrcAlpha: BlendingSrcFactor | null
  readonly blendDstAlpha: BlendingDstFactor | null
  readonly isTransparent: boolean
  readonly renderState: SceneRenderState | undefined
}

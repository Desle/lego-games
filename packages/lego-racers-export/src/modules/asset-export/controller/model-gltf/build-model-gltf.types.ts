import type { Scene } from '@lego-games/lego-racers/scene'
import type { SkeletalAnimation } from '@lego-games/lego-racers/skeletal-animation'
import type { Skeleton } from '@lego-games/lego-racers/skeleton'
import type { TextureUriResolver } from './texture-references.types.ts'

export type ModelGltfInput = {
  readonly name: string
  readonly scene: Scene
  readonly meshIndex: number
  // GDB keyword 0x33.
  readonly scale: number
  readonly skeleton: Skeleton | null
  readonly animation: SkeletalAnimation | null
  readonly getTextureUri: TextureUriResolver
  readonly binaryUri: string
}

export type WorldGltfInput = {
  readonly name: string
  // Only the instances this world defined are written; the scene may hold the worlds it was loaded on top of.
  readonly worldPath: string
  readonly scene: Scene
  readonly getTextureUri: TextureUriResolver
  readonly binaryUri: string
}

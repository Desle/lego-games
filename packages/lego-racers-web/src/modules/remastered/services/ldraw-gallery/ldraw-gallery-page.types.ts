import type { Scene } from 'three'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

export const GalleryMode = createEnum({
  LDRAW: 'ldraw',
  GAME: 'game',
  OVERLAY: 'overlay',
})
export type GalleryMode = EnumValues<typeof GalleryMode>

export const GalleryView = createEnum({
  FRONT: 'front',
  REAR: 'rear',
  TOP: 'top',
  BOTTOM: 'bottom',
  SIDE: 'side',
})
export type GalleryView = EnumValues<typeof GalleryView>

export type GalleryResult = {
  readonly name: string
  readonly brickCount: number
  readonly unmappedNames: readonly string[]
}

export type PieceSheetResult = {
  readonly width: number
  readonly height: number
  readonly missing: readonly string[]
}

export type GalleryScene = {
  readonly scene: Scene
  readonly unmappedNames: readonly string[]
}

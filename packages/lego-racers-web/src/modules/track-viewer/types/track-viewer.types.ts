// @check-allow layer-boundaries: a type-only import of the sky's shape
import type { Sky } from '@lego-games/lego-racers/sky'
import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { ViewerStatus as ViewerStatusValues } from './viewer-status/viewer-status.ts'

export type ViewerStatus = EnumValues<typeof ViewerStatusValues>

// One choice in the world list: the worlds loaded together, in the game's order.
export type WorldEntry = {
  readonly id: string
  readonly label: string
  readonly worldPaths: readonly string[]
  // The race's sky file and background world; only the _Whole race_ entry draws them.
  readonly skyPath: string | null
  readonly backgroundWorldPath: string | null
}

// What a race loads for its track: its worlds in the game's order, and the sky and background it draws first.
export type RaceContent = {
  readonly worldPaths: readonly string[]
  readonly skyPath: string | null
  readonly backgroundWorldPath: string | null
}

export type WorldGroup = {
  readonly directory: string
  readonly entries: readonly WorldEntry[]
}

export type SceneSummary = {
  readonly worldPaths: readonly string[]
  readonly instanceCount: number
  readonly animatedInstanceCount: number
  readonly meshCount: number
  readonly triangleCount: number
  readonly materialCount: number
  readonly textureCount: number
  readonly missingTextures: readonly string[]
  readonly cameraNames: readonly string[]
  readonly lightCount: number
}

// What a race draws before its track: the sky, and the world whose instances follow the camera with it.
export type SceneBackground = {
  readonly sky: Sky | null
  readonly backgroundWorldPath: string | null
}

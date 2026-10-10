import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { ViewerStatus as ViewerStatusValues } from './viewer-status/viewer-status.ts'

export type ViewerStatus = EnumValues<typeof ViewerStatusValues>

// One choice in the world list: the worlds loaded together, in the game's order.
export type WorldEntry = {
  readonly id: string
  readonly label: string
  readonly worldPaths: readonly string[]
}

export type WorldGroup = {
  readonly directory: string
  readonly entries: readonly WorldEntry[]
}

export type SceneSummary = {
  readonly worldPaths: readonly string[]
  readonly instanceCount: number
  readonly meshCount: number
  readonly triangleCount: number
  readonly materialCount: number
  readonly textureCount: number
  readonly missingTextures: readonly string[]
  readonly cameraNames: readonly string[]
  readonly lightCount: number
}

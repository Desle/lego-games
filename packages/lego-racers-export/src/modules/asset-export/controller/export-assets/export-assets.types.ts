import type { ExportOptions, ExportReport, Manifest } from '../../types/export.types.ts'

export type ExportAssetsOptions = ExportOptions & {
  // Which exporters run: any of textures, audio, video, models, worlds.
  readonly exportedKinds: readonly string[]
}

export type ExportAssetsResult = {
  readonly reports: readonly ExportReport[]
  readonly manifest: Manifest
}

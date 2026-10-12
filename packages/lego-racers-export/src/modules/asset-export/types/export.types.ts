import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { AssetType as AssetTypeValues } from './asset-type/asset-type.ts'

export type AssetType = EnumValues<typeof AssetTypeValues>

export type ManifestEntry = {
  // Path relative to the output folder, always with forward slashes.
  readonly file: string
  readonly type: AssetType
  // The archive path inside LEGO.JAM, or the file name in the game folder.
  readonly source: string
}

export type OutputWriter = {
  // Writes the file (creating its folders) and records it in the manifest; a file written twice is recorded once.
  readonly writeFile: (file: string, bytes: Uint8Array, type: AssetType, source: string) => void
  // Records a file another program wrote into the output folder.
  readonly recordFile: (file: string, type: AssetType, source: string) => void
  readonly getEntries: () => readonly ManifestEntry[]
  readonly getAbsolutePath: (file: string) => string
}

// What one exporter did: how many files it wrote and what it could not export (with the reason).
export type ExportReport = {
  readonly label: string
  readonly writtenCount: number
  readonly failures: readonly string[]
  // Why a whole exporter did nothing (ffmpeg missing), else null.
  readonly skipMessage: string | null
}

export type Manifest = {
  readonly generatedAt: string
  readonly entries: readonly ManifestEntry[]
  readonly countsByType: Readonly<Record<string, number>>
  // Assets that could not be exported, with the reason.
  readonly failures: readonly string[]
}

// Pixels as RGBA bytes, rows top to bottom.
export type RgbaImage = {
  readonly width: number
  readonly height: number
  readonly colors: Uint8Array
}

export type ExportOptions = {
  readonly gameDirectory: string
  readonly outputDirectory: string
}

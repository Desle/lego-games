import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { createOutputWriter } from '../../services/output-writer/output-writer.ts'
import type { ExportReport, Manifest, ManifestEntry } from '../../types/export.types.ts'
import { createTextureReferences } from '../model-gltf/texture-references.ts'
import { exportAudio } from '../export-audio/export-audio.ts'
import { exportModels } from '../export-models/export-models.ts'
import { exportTextures } from '../export-textures/export-textures.ts'
import { exportVideo } from '../export-video/export-video.ts'
import { exportWorlds } from '../export-worlds/export-worlds.ts'
import type { ExportAssetsOptions, ExportAssetsResult } from './export-assets.types.ts'

const MANIFEST_FILE = 'manifest.json'

const getCountsByType = (entries: readonly ManifestEntry[]): Readonly<Record<string, number>> =>
  Object.freeze(
    entries.reduce<Record<string, number>>(
      (counts, entry) => ({ ...counts, [entry.type]: (counts[entry.type] ?? 0) + 1 }),
      {}
    )
  )

// Exports the assets of the player's game folder into the output folder, then writes manifest.json listing every file.
// Textures come first because models reference them.
export const exportAssets = (
  options: ExportAssetsOptions,
  logProgress: (message: string) => void
): ExportAssetsResult => {
  const archive = openJamArchive(
    new Uint8Array(readFileSync(join(options.gameDirectory, 'LEGO.JAM')))
  )
  mkdirSync(options.outputDirectory, { recursive: true })
  const writer = createOutputWriter(options.outputDirectory)
  const references = createTextureReferences(writer)
  const steps: readonly (readonly [string, () => ExportReport])[] = [
    ['textures', () => exportTextures(archive, options.gameDirectory, writer)],
    ['audio', () => exportAudio(archive, options.gameDirectory, writer)],
    ['video', () => exportVideo(options.gameDirectory, writer)],
    ['models', () => exportModels(archive, writer, references)],
    ['worlds', () => exportWorlds(archive, writer, references)],
  ]
  const reports = steps
    .filter(([label]) => options.exportedKinds.includes(label))
    .map(([label, run]) => {
      logProgress(`Exporting ${label}...`)
      return run()
    })
  const entries = writer.getEntries()
  const manifest: Manifest = Object.freeze({
    generatedAt: new Date().toISOString(),
    countsByType: getCountsByType(entries),
    failures: reports.flatMap((report) => report.failures),
    entries,
  })
  writeFileSync(
    join(options.outputDirectory, MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
  return Object.freeze({ reports, manifest })
}

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AssetType, ManifestEntry, OutputWriter } from '../../types/export.types.ts'

const getManifestFile = (file: string): string => file.replaceAll('\\', '/')

export const createOutputWriter = (outputDirectory: string): OutputWriter => {
  const entriesByFile = new Map<string, ManifestEntry>()
  const getAbsolutePath = (file: string): string => join(outputDirectory, file)
  const recordFile = (file: string, type: AssetType, source: string): void => {
    const manifestFile = getManifestFile(file)
    entriesByFile.set(manifestFile, Object.freeze({ file: manifestFile, type, source }))
  }
  const writeFile = (file: string, bytes: Uint8Array, type: AssetType, source: string): void => {
    const target = getAbsolutePath(file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
    recordFile(file, type, source)
  }
  return Object.freeze({
    writeFile,
    recordFile,
    getAbsolutePath,
    getEntries: () => [...entriesByFile.values()],
  })
}

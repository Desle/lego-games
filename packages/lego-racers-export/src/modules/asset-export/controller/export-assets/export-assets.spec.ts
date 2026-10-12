import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { exportAssets } from './export-assets.ts'

const GAME_DIRECTORY = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files'
)
const isOriginalPresent = existsSync(join(GAME_DIRECTORY, 'LEGO.JAM'))

describe.runIf(isOriginalPresent)('exportAssets on the original game files', () => {
  it('writes textures, models and worlds whose materials reference exported PNGs', () => {
    // Arrange
    const outputDirectory = mkdtempSync(join(tmpdir(), 'lego-racers-export-'))

    try {
      // Act
      const { manifest } = exportAssets(
        {
          gameDirectory: GAME_DIRECTORY,
          outputDirectory,
          exportedKinds: ['textures', 'models', 'worlds'],
        },
        () => undefined
      )

      // Assert
      expect(manifest.countsByType['texture']).toBeGreaterThan(1600)
      expect(manifest.countsByType['model']).toBeGreaterThan(700)
      expect(manifest.countsByType['world']).toBeGreaterThan(30)
      const manifestOnDisk = JSON.parse(
        readFileSync(join(outputDirectory, 'manifest.json'), 'utf8')
      ) as { entries: { file: string }[] }
      expect(
        manifestOnDisk.entries.every((entry) => existsSync(join(outputDirectory, entry.file)))
      ).toBe(true)
      const gltfFile = 'models/MENUDATA/PIECEDB/DAJMW.gltf'
      const gltf = JSON.parse(readFileSync(join(outputDirectory, gltfFile), 'utf8')) as {
        images: { uri: string }[]
        skins: unknown[]
        animations: unknown[]
      }
      expect(gltf.skins).toHaveLength(1)
      expect(gltf.animations.length).toBeGreaterThan(0)
      for (const image of gltf.images) {
        expect(
          existsSync(join(outputDirectory, dirname(gltfFile), decodeURIComponent(image.uri)))
        ).toBe(true)
      }
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true })
    }
  }, 120_000)

  it('writes only the kinds asked for', () => {
    // Arrange
    const outputDirectory = mkdtempSync(join(tmpdir(), 'lego-racers-export-'))

    try {
      // Act
      const { manifest } = exportAssets(
        { gameDirectory: GAME_DIRECTORY, outputDirectory, exportedKinds: ['audio'] },
        () => undefined
      )

      // Assert
      expect(Object.keys(manifest.countsByType).sort()).toEqual(['music', 'sound_effect'])
      expect(manifest.countsByType['sound_effect']).toBeGreaterThan(700)
      expect(existsSync(join(outputDirectory, 'audio/MUSIC/theme.wav'))).toBe(true)
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true })
    }
  })
})

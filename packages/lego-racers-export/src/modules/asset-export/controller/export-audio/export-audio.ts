import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeMusic, decodeSoundEffect } from '@lego-games/lego-racers/audio'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { AssetType } from '../../types/asset-type/asset-type.ts'
import type { ExportReport, OutputWriter } from '../../types/export.types.ts'
import { getErrorMessage, getMirroredFile } from '../../services/export-paths/export-paths.ts'
import { encodeWav } from '../../services/wav-encoder/wav-encoder.ts'

const AUDIO_DIRECTORY = 'audio'
const MUSIC_DIRECTORY = 'audio/MUSIC'

// Every PCM sound effect of LEGO.JAM (paths mirrored under audio/) and every .tun music track of the game folder
// (under audio/MUSIC/) as 16-bit WAV.
export const exportAudio = (
  archive: JamArchive,
  gameDirectory: string,
  writer: OutputWriter
): ExportReport => {
  const failures: string[] = []
  let writtenCount = 0
  const exportSound = (
    file: string,
    source: string,
    getSound: () => Parameters<typeof encodeWav>[0],
    type: typeof AssetType.SOUND_EFFECT | typeof AssetType.MUSIC
  ): void => {
    try {
      writer.writeFile(file, encodeWav(getSound()), type, source)
      writtenCount++
    } catch (error) {
      failures.push(`${source}: ${getErrorMessage(error)}`)
    }
  }
  for (const path of archive.getFilePaths().filter((candidate) => /\.pcm$/i.test(candidate))) {
    exportSound(
      getMirroredFile(AUDIO_DIRECTORY, path, '.wav'),
      path,
      () => decodeSoundEffect(archive.readFile(path)),
      AssetType.SOUND_EFFECT
    )
  }
  for (const name of readdirSync(gameDirectory).filter((candidate) => /\.tun$/i.test(candidate))) {
    exportSound(
      getMirroredFile(MUSIC_DIRECTORY, name, '.wav'),
      name,
      () => decodeMusic(new Uint8Array(readFileSync(join(gameDirectory, name)))),
      AssetType.MUSIC
    )
  }
  return Object.freeze({ label: 'audio', writtenCount, failures, skipMessage: null })
}

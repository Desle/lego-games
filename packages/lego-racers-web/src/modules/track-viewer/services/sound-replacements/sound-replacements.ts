import { getSoundReplacement } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { SoundReplacements } from './sound-replacements.types.ts'

// What extensions have to play in place of the archive's sounds and tunes (nothing, in Classic): each path is asked once.
export const createSoundReplacements = (context: AudioContext): SoundReplacements => {
  const requests = new Map<string, Promise<AudioBuffer | null>>()
  const loaded = new Map<string, AudioBuffer>()
  const load = (archivePath: string): Promise<AudioBuffer | null> => {
    const known = requests.get(archivePath)
    if (known !== undefined) return known
    const request = getSoundReplacement(context, archivePath)
      .catch(() => null)
      .then((buffer) => {
        if (buffer !== null) loaded.set(archivePath, buffer)
        return buffer
      })
    requests.set(archivePath, request)
    return request
  }
  return Object.freeze({
    getLoaded: (archivePath: string) => {
      void load(archivePath)
      return loaded.get(archivePath) ?? null
    },
    load,
    preload: (archivePaths: readonly string[]) => {
      for (const archivePath of archivePaths) void load(archivePath)
    },
  })
}

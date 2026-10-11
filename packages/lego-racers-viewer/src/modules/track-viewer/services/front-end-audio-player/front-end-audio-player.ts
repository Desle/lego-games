import { decodeMusic, decodeSoundBank, decodeSoundEffect } from '@lego-games/lego-racers/audio'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  createAudioBuffer,
  createAudioContext,
  SILENT_PLAYER,
} from '../audio-buffer/audio-buffer.ts'
import type { FrontEndAudioPlayer } from './front-end-audio-player.types.ts'

const SOUND_DIRECTORY = 'MENUDATA\\SOUNDS'
const MUSIC_LIST_PATH = 'MENUDATA\\LEGOMSC'
// The volume FrontEnd_SetMusic passes is DirectSound's; Web Audio gain above 1 would clip.
const MUSIC_GAIN = 1

// The menu sounds (`.PCM` in MENUDATA\SOUNDS) and the menu music (the `.tun` files MENUDATA\LEGOMSC lists), decoded by
// the audio module and played through Web Audio.
export const createFrontEndAudioPlayer = (
  archive: JamArchive,
  readTune: ((name: string) => Promise<Uint8Array | null>) | null
): FrontEndAudioPlayer => {
  const context = createAudioContext()
  if (context === null) return SILENT_PLAYER
  const buffers = new Map<string, AudioBuffer | null>()
  const tuneNames = decodeSoundBank(archive.readFile(MUSIC_LIST_PATH)).soundPaths
  let music: AudioBufferSourceNode | null = null
  // A tune that finishes loading after another was asked for must not start.
  let musicRequest = 0
  const getBuffer = (name: string): AudioBuffer | null => {
    if (buffers.has(name)) return buffers.get(name) ?? null
    try {
      const effect = decodeSoundEffect(
        archive.readFile(`${SOUND_DIRECTORY}\\${name.toUpperCase()}.PCM`)
      )
      const buffer =
        Math.floor(effect.samples.length / effect.channelCount) > 0
          ? createAudioBuffer(context, effect.samples, effect.channelCount, effect.sampleRate)
          : null
      buffers.set(name, buffer)
      return buffer
    } catch {
      buffers.set(name, null)
      return null
    }
  }
  return Object.freeze({
    resume: () => void context.resume(),
    playSound: (name: string) => {
      const buffer = getBuffer(name)
      if (buffer === null) return
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.start()
    },
    playMusic: (listIndex: number | null) => {
      musicRequest += 1
      const request = musicRequest
      music?.stop()
      music = null
      const tuneName = listIndex === null ? undefined : tuneNames[listIndex]
      if (tuneName === undefined || readTune === null) return
      readTune(tuneName.toLowerCase())
        .then((bytes) => {
          if (bytes === null || request !== musicRequest) return
          const decoded = decodeMusic(bytes)
          const source = context.createBufferSource()
          const gain = context.createGain()
          source.buffer = createAudioBuffer(
            context,
            decoded.samples,
            decoded.channelCount,
            decoded.sampleRate
          )
          source.loop = true
          gain.gain.value = MUSIC_GAIN
          source.connect(gain).connect(context.destination)
          source.start()
          music = source
        })
        .catch(() => undefined)
    },
    dispose: () => {
      musicRequest += 1
      music?.stop()
      void context.close()
    },
  })
}

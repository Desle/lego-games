import { decodeSoundEffect } from '@lego-games/lego-racers/audio'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { FrontEndAudioPlayer } from './front-end-audio-player.types.ts'

const SOUND_DIRECTORY = 'MENUDATA\\SOUNDS'
const INT16_RANGE = 32768

// The menu sounds (`.PCM` in MENUDATA\SOUNDS), decoded by the audio module and played through Web Audio.
export const createFrontEndAudioPlayer = (archive: JamArchive): FrontEndAudioPlayer => {
  const AudioContextConstructor = typeof AudioContext === 'undefined' ? null : AudioContext
  if (AudioContextConstructor === null) {
    return Object.freeze({
      resume: () => undefined,
      playSound: () => undefined,
      dispose: () => undefined,
    })
  }
  const context = new AudioContextConstructor()
  const buffers = new Map<string, AudioBuffer | null>()
  const getBuffer = (name: string): AudioBuffer | null => {
    if (buffers.has(name)) return buffers.get(name) ?? null
    try {
      const effect = decodeSoundEffect(
        archive.readFile(`${SOUND_DIRECTORY}\\${name.toUpperCase()}.PCM`)
      )
      const frameCount = Math.floor(effect.samples.length / effect.channelCount)
      let buffer: AudioBuffer | null = null
      if (frameCount > 0) {
        buffer = context.createBuffer(effect.channelCount, frameCount, effect.sampleRate)
        for (let channel = 0; channel < effect.channelCount; channel += 1) {
          const data = buffer.getChannelData(channel)
          for (let frame = 0; frame < frameCount; frame += 1) {
            data[frame] = (effect.samples[frame * effect.channelCount + channel] ?? 0) / INT16_RANGE
          }
        }
      }
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
    dispose: () => void context.close(),
  })
}

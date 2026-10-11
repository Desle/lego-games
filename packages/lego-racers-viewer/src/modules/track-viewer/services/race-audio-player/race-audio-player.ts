import { decodeMusic, decodeSoundEffect } from '@lego-games/lego-racers/audio'
import type { MusicCue, SoundRequest } from '@lego-games/lego-racers/race-audio'
import { RACE_MUSIC_VOLUME, SoundBankKind } from '@lego-games/lego-racers/race-audio'
import { COMMON_DIRECTORY } from '@lego-games/lego-racers/scene'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { RaceAudioPlayer } from './race-audio-player.types.ts'

const INT16_RANGE = 32768

// Interleaved 16-bit samples → one Float32 array per channel.
const createBuffer = (
  context: AudioContext,
  samples: Int16Array,
  channelCount: number,
  sampleRate: number
): AudioBuffer => {
  const frameCount = Math.floor(samples.length / channelCount)
  const buffer = context.createBuffer(channelCount, Math.max(frameCount, 1), sampleRate)
  for (let channel = 0; channel < channelCount; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let frame = 0; frame < frameCount; frame += 1) {
      data[frame] = (samples[frame * channelCount + channel] ?? 0) / INT16_RANGE
    }
  }
  return buffer
}

// The race's sound effects (`.PCM` in LEGO.JAM, the entries of GENERAL.SBK and the track's bank) and its music
// (`.tun` files), decoded by the audio module and played through Web Audio. Music loops as the cue says; a new
// track stops the old one (LEGORacers.exe 0x00434b00).
export const createRaceAudioPlayer = (assets: RaceAssets): RaceAudioPlayer => {
  const AudioContextConstructor = typeof AudioContext === 'undefined' ? null : AudioContext
  if (AudioContextConstructor === null) {
    return Object.freeze({
      resume: () => undefined,
      playSound: () => undefined,
      playMusic: () => undefined,
      dispose: () => undefined,
    })
  }
  const context = new AudioContextConstructor()
  const buffers = new Map<string, AudioBuffer | null>()
  let music: AudioBufferSourceNode | null = null

  const getSoundPath = (request: SoundRequest): string | null => {
    if (request.location.bank === SoundBankKind.GENERAL) {
      const name = assets.generalSounds.soundPaths[request.location.index]
      return name === undefined ? null : `${COMMON_DIRECTORY}\\${name.toUpperCase()}`
    }
    if (request.location.bank === SoundBankKind.TRACK) {
      const name = assets.trackSounds.soundPaths[request.location.index]
      return name === undefined ? null : `${assets.trackSoundDirectory}\\${name.toUpperCase()}`
    }
    return null
  }

  const getSoundBuffer = (path: string): AudioBuffer | null => {
    if (buffers.has(path)) return buffers.get(path) ?? null
    try {
      const effect = decodeSoundEffect(assets.archive.readFile(path))
      const buffer =
        effect.samples.length === 0
          ? null
          : createBuffer(context, effect.samples, effect.channelCount, effect.sampleRate)
      buffers.set(path, buffer)
      return buffer
    } catch {
      buffers.set(path, null)
      return null
    }
  }

  const start = (buffer: AudioBuffer, isLooping: boolean, volume: number) => {
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    source.loop = isLooping
    gain.gain.value = volume
    source.connect(gain).connect(context.destination)
    source.start()
    return source
  }

  return Object.freeze({
    resume: () => void context.resume(),
    playSound: (request: SoundRequest) => {
      const path = getSoundPath(request)
      const buffer = path === null ? null : getSoundBuffer(path)
      if (buffer !== null) start(buffer, false, 1)
    },
    playMusic: (cue: MusicCue) => {
      music?.stop()
      music = null
      const tune = assets.tunes.get((assets.musicNames[cue.listIndex] ?? '').toLowerCase())
      if (tune === undefined) return
      const decoded = decodeMusic(tune)
      // The volume the race passes (1.2) is DirectSound's; Web Audio gain above 1 would clip.
      music = start(
        createBuffer(context, decoded.samples, decoded.channelCount, decoded.sampleRate),
        cue.isLooping,
        Math.min(RACE_MUSIC_VOLUME, 1)
      )
    },
    dispose: () => {
      music?.stop()
      void context.close()
    },
  })
}

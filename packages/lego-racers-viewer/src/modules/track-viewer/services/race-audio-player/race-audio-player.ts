import { decodeMusic, decodeSoundEffect } from '@lego-games/lego-racers/audio'
import type { MusicCue, SoundRequest } from '@lego-games/lego-racers/race-audio'
import { RACE_MUSIC_VOLUME, SoundBankKind } from '@lego-games/lego-racers/race-audio'
import { COMMON_DIRECTORY } from '@lego-games/lego-racers/scene'
import {
  createAudioBuffer,
  createAudioContext,
  SILENT_PLAYER,
} from '../audio-buffer/audio-buffer.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { RaceAudioPlayer } from './race-audio-player.types.ts'

// The race's sound effects (`.PCM` in LEGO.JAM, the entries of GENERAL.SBK and the track's bank) and its music
// (`.tun` files), decoded by the audio module and played through Web Audio. Music loops as the cue says; a new
// track stops the old one (LEGORacers.exe 0x00434b00).
export const createRaceAudioPlayer = (assets: RaceAssets): RaceAudioPlayer => {
  const context = createAudioContext()
  if (context === null) return SILENT_PLAYER
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
          : createAudioBuffer(context, effect.samples, effect.channelCount, effect.sampleRate)
      buffers.set(path, buffer)
      return buffer
    } catch {
      buffers.set(path, null)
      return null
    }
  }

  let isDisposed = false
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
      if (isDisposed) return
      const path = getSoundPath(request)
      const buffer = path === null ? null : getSoundBuffer(path)
      if (buffer !== null) start(buffer, false, 1)
    },
    playMusic: (cue: MusicCue) => {
      if (isDisposed) return
      music?.stop()
      music = null
      const tune = assets.tunes.get((assets.musicNames[cue.listIndex] ?? '').toLowerCase())
      if (tune === undefined) return
      const decoded = decodeMusic(tune)
      // The volume the race passes (1.2) is DirectSound's; Web Audio gain above 1 would clip.
      music = start(
        createAudioBuffer(context, decoded.samples, decoded.channelCount, decoded.sampleRate),
        cue.isLooping,
        Math.min(RACE_MUSIC_VOLUME, 1)
      )
    },
    dispose: () => {
      isDisposed = true
      music?.stop()
      void context.close()
    },
  })
}

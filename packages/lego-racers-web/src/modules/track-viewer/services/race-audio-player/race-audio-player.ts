import { decodeSoundEffect } from '@lego-games/lego-racers/audio'
import type { MusicCue, SoundRequest } from '@lego-games/lego-racers/race-audio'
import type { RacerEngineLoops } from '@lego-games/lego-racers/race-presentation'
import type { Vector3 } from '@lego-games/lego-racers/simulation-math'
import { RACE_MUSIC_VOLUME, SoundBankKind } from '@lego-games/lego-racers/race-audio'
import { COMMON_DIRECTORY } from '@lego-games/lego-racers/scene'
import {
  createAudioBuffer,
  createAudioContext,
  createMusicBuffer,
  SILENT_PLAYER,
} from '../audio-buffer/audio-buffer.ts'
import { createSoundReplacements } from '../sound-replacements/sound-replacements.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { PlayingSound, RaceAudioPlayer } from './race-audio-player.types.ts'

const MUSIC_DIRECTORY = 'MUSIC'
const MINIMUM_HEARING_DISTANCE = 30
const MAXIMUM_HEARING_DISTANCE = 300
const MINIMUM_PLAYBACK_RATE = 0.05

// The race's sound effects (`.PCM` in LEGO.JAM, the entries of GENERAL.SBK and the track's bank) and its music
// (`.tun` files), decoded by the audio module and played through Web Audio. Music loops as the cue says; a new
// track stops the old one (LEGORacers.exe 0x00434b00).
export const createRaceAudioPlayer = (assets: RaceAssets): RaceAudioPlayer => {
  const context = createAudioContext()
  if (context === null) return SILENT_PLAYER
  const buffers = new Map<string, AudioBuffer | null>()
  const replacements = createSoundReplacements(context)
  let music: AudioBufferSourceNode | null = null
  // A tune that finishes loading after another was asked for must not start.
  let musicRequest = 0

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
    const replacement = replacements.getLoaded(path)
    if (replacement !== null) return replacement
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

  replacements.preload(
    [...assets.generalSounds.soundPaths.keys()]
      .map((index) =>
        getSoundPath({ soundId: 0, location: { bank: SoundBankKind.GENERAL, index }, address: '' })
      )
      .concat(
        [...assets.trackSounds.soundPaths.keys()].map((index) =>
          getSoundPath({ soundId: 0, location: { bank: SoundBankKind.TRACK, index }, address: '' })
        )
      )
      .flatMap((path) => (path === null ? [] : [path]))
  )
  let isDisposed = false
  // Racer +0xd9c..+0xda8: every racer's loops, by racer and kind. The sound objects hear within 30 to 300 units
  // (0x004b0958, 0x004b095c): full volume inside the first, none beyond the second.
  const loops = new Map<string, PlayingSound>()
  const stopLoop = (key: string) => {
    loops.get(key)?.source.stop()
    loops.delete(key)
  }
  const setEngineLoops = (racers: readonly RacerEngineLoops[], listener: Vector3) => {
    if (isDisposed) return
    for (const { racerIndex, position, loops: racerLoops } of racers) {
      const distance = Math.hypot(
        position.x - listener.x,
        position.y - listener.y,
        position.z - listener.z
      )
      const hearing = Math.min(
        Math.max(
          (MAXIMUM_HEARING_DISTANCE - distance) /
            (MAXIMUM_HEARING_DISTANCE - MINIMUM_HEARING_DISTANCE),
          0
        ),
        1
      )
      for (const loop of racerLoops) {
        const key = `${String(racerIndex)}:${loop.kind}`
        if (!loop.isPlaying) {
          stopLoop(key)
          continue
        }
        const known = loops.get(key)
        const path = getSoundPath({ soundId: loop.soundId, location: loop.location, address: '' })
        const buffer = path === null ? null : getSoundBuffer(path)
        if (known === undefined && buffer !== null) {
          const created = start(buffer, true, 0)
          loops.set(key, created)
        }
        const current = loops.get(key)
        if (current === undefined) continue
        current.gain.gain.value = loop.volume * hearing
        current.source.playbackRate.value = Math.max(loop.pitch, MINIMUM_PLAYBACK_RATE)
      }
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
    return { source, gain }
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
      musicRequest += 1
      const request = musicRequest
      music?.stop()
      music = null
      const tuneName = (assets.musicNames[cue.listIndex] ?? '').toLowerCase()
      const tune = assets.tunes.get(tuneName)
      void replacements.load(`${MUSIC_DIRECTORY}\\${tuneName}.tun`).then((replacement) => {
        if (isDisposed || request !== musicRequest) return
        const buffer = replacement ?? (tune === undefined ? null : createMusicBuffer(context, tune))
        if (buffer === null) return
        // The volume the race passes (1.2) is DirectSound's; Web Audio gain above 1 would clip.
        music = start(buffer, cue.isLooping, Math.min(RACE_MUSIC_VOLUME, 1)).source
      })
    },
    setEngineLoops,
    dispose: () => {
      isDisposed = true
      musicRequest += 1
      for (const key of [...loops.keys()]) stopLoop(key)
      music?.stop()
      void context.close()
    },
  })
}

import { decodeSoundEffect } from '@lego-games/lego-racers/audio'
import type {
  LoopedSoundRequest,
  MusicCue,
  NearestRacerSound,
  SoundListener,
  SoundLocation,
  SoundMix,
  SoundRequest,
  SoundSource,
} from '@lego-games/lego-racers/race-audio'
import type { RacerEngineLoops } from '@lego-games/lego-racers/race-presentation'
import type { Vector3 } from '@lego-games/lego-racers/simulation-math'
import {
  getSoundLocation,
  getSoundMix,
  RACE_MUSIC_VOLUME,
  SoundBankKind,
} from '@lego-games/lego-racers/race-audio'
import { COMMON_DIRECTORY } from '@lego-games/lego-racers/scene'
import {
  createAudioBuffer,
  createAudioContext,
  createMusicBuffer,
  SILENT_PLAYER,
} from '../audio-buffer/audio-buffer.ts'
import { createSoundReplacements } from '../sound-replacements/sound-replacements.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { PlayingSound, PositionedLoop, RaceAudioPlayer } from './race-audio-player.types.ts'

const MUSIC_DIRECTORY = 'MUSIC'
// The distances 0x004b0958 and 0x004b095c that every racer's sound objects hear within.
const ENGINE_MINIMUM_DISTANCE = 30
const ENGINE_MAXIMUM_DISTANCE = 300
const MINIMUM_PLAYBACK_RATE = 0.05
const NEAREST_RACER_SOUND_ID = 0x4f
const NEAREST_RACER_MAXIMUM_DISTANCE = 200
const NEAREST_RACER_VOLUME = 0.8
// DirectSound volumes and pans are hundredths of a decibel; a buffer at -10000 is silent.
const SILENT_DIRECT_SOUND_VOLUME = -10000
const DIRECT_SOUND_UNITS_PER_AMPLITUDE_DECADE = 2000

const getAmplitude = (hundredthsOfDecibels: number): number =>
  hundredthsOfDecibels <= SILENT_DIRECT_SOUND_VOLUME
    ? 0
    : 10 ** (hundredthsOfDecibels / DIRECT_SOUND_UNITS_PER_AMPLITUDE_DECADE)

// A sound heard in the middle at full volume (RaceSounds_Play, and calls that have no source yet).
const CENTRED_MIX: SoundMix = Object.freeze({
  volume: 1,
  directSoundVolume: 0,
  pan: 0,
  directSoundPan: 0,
  pitch: 1,
})

// The race's sound effects (`.PCM` in LEGO.JAM, the entries of GENERAL.SBK, the voice banks and the track's bank) and its
// music (`.tun` files), decoded by the audio module and played through Web Audio. Music loops as the cue says; a new
// track stops the old one (LEGORacers.exe 0x00434b00). A sound with a source is mixed the way 0x00417de0 does for the
// listener: volume by the squared distance, pan by the side it is on.
export const createRaceAudioPlayer = (assets: RaceAssets): RaceAudioPlayer => {
  const context = createAudioContext()
  if (context === null) return SILENT_PLAYER
  const buffers = new Map<string, AudioBuffer | null>()
  const replacements = createSoundReplacements(context)
  let music: AudioBufferSourceNode | null = null
  // A tune that finishes loading after another was asked for must not start.
  let musicRequest = 0
  let listener: SoundListener | null = null

  const getSoundPath = (location: SoundLocation): string | null => {
    const getPath = (directory: string, names: readonly string[]) => {
      const name = names[location.index]
      return name === undefined ? null : `${directory}\\${name.toUpperCase()}`
    }
    switch (location.bank) {
      case SoundBankKind.GENERAL:
        return getPath(COMMON_DIRECTORY, assets.generalSounds.soundPaths)
      case SoundBankKind.TRACK:
        return getPath(assets.trackSoundDirectory, assets.trackSounds.soundPaths)
      case SoundBankKind.VOICE:
        return getPath(assets.voiceDirectory, assets.voiceSounds.soundPaths)
      case SoundBankKind.VOICE_FOLDER:
        return getPath(assets.voiceDirectory, assets.voiceFolderSounds.soundPaths)
      default:
        return null
    }
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

  const getLocationBuffer = (location: SoundLocation): AudioBuffer | null => {
    const path = getSoundPath(location)
    return path === null ? null : getSoundBuffer(path)
  }

  replacements.preload(
    [
      ...[...assets.generalSounds.soundPaths.keys()].map((index) =>
        getSoundPath({ bank: SoundBankKind.GENERAL, index })
      ),
      ...[...assets.trackSounds.soundPaths.keys()].map((index) =>
        getSoundPath({ bank: SoundBankKind.TRACK, index })
      ),
    ].flatMap((path) => (path === null ? [] : [path]))
  )
  let isDisposed = false

  // source → volume → left and right gains → both channels of the output (DirectSound's volume and pan).
  const startSound = (buffer: AudioBuffer, isLooping: boolean): PlayingSound => {
    const source = context.createBufferSource()
    const volume = context.createGain()
    const left = context.createGain()
    const right = context.createGain()
    const merger = context.createChannelMerger(2)
    source.buffer = buffer
    source.loop = isLooping
    source.connect(volume)
    volume.connect(left).connect(merger, 0, 0)
    volume.connect(right).connect(merger, 0, 1)
    merger.connect(context.destination)
    source.start()
    return { source, volume, left, right }
  }

  const applyMix = ({ source, volume, left, right }: PlayingSound, mix: SoundMix) => {
    volume.gain.setValueAtTime(getAmplitude(mix.directSoundVolume), context.currentTime)
    // A positive pan quietens the left side, a negative one the right.
    left.gain.setValueAtTime(getAmplitude(Math.min(-mix.directSoundPan, 0)), context.currentTime)
    right.gain.setValueAtTime(getAmplitude(Math.min(mix.directSoundPan, 0)), context.currentTime)
    source.playbackRate.setValueAtTime(
      Math.max(mix.pitch, MINIMUM_PLAYBACK_RATE),
      context.currentTime
    )
  }

  const getMix = (source: SoundSource | null): SoundMix =>
    source === null || listener === null ? CENTRED_MIX : getSoundMix(listener, source)

  // The racers' loops, by racer and kind (racer +0xd9c..+0xda8), and the looped sounds of events, by their key.
  const engineLoops = new Map<string, PlayingSound>()
  const eventLoops = new Map<string, PositionedLoop>()
  const stopEngineLoop = (key: string) => {
    engineLoops.get(key)?.source.stop()
    engineLoops.delete(key)
  }
  const stopEventLoop = (key: string) => {
    eventLoops.get(key)?.sound.source.stop()
    eventLoops.delete(key)
  }

  const getLoopSource = (
    request: LoopedSoundRequest,
    racerPositions: ReadonlyMap<number, Vector3>
  ) => {
    const followed =
      request.followedRacer === null ? undefined : racerPositions.get(request.followedRacer)
    return followed === undefined || request.source === null
      ? request.source
      : { ...request.source, position: followed }
  }

  const setEngineLoops = (racers: readonly RacerEngineLoops[]) => {
    if (isDisposed) return
    const racerPositions = new Map(racers.map((racer) => [racer.racerIndex, racer.position]))
    for (const { sound, request } of eventLoops.values()) {
      if (request.followedRacer !== null)
        applyMix(sound, getMix(getLoopSource(request, racerPositions)))
    }
    for (const { racerIndex, position, loops: racerLoops } of racers) {
      for (const loop of racerLoops) {
        const key = `${String(racerIndex)}:${loop.kind}`
        if (!loop.isPlaying) {
          stopEngineLoop(key)
          continue
        }
        const buffer = getLocationBuffer(loop.location)
        if (!engineLoops.has(key) && buffer !== null) {
          engineLoops.set(key, startSound(buffer, true))
        }
        const current = engineLoops.get(key)
        if (current === undefined) continue
        applyMix(
          current,
          getMix({
            position,
            minimumDistance: ENGINE_MINIMUM_DISTANCE,
            maximumDistance: ENGINE_MAXIMUM_DISTANCE,
            volume: loop.volume,
            pitch: loop.pitch,
          })
        )
      }
    }
  }

  // The loop 0x00443bd0 hands out at the track's load (0x0043ccb0, sound 0x4f, 30 to 200 units, volume 0.8).
  let nearestRacerLoop: PlayingSound | null = null
  const setNearestRacerSound = (sound: NearestRacerSound | null) => {
    if (isDisposed) return
    if (sound === null) {
      nearestRacerLoop?.source.stop()
      nearestRacerLoop = null
      return
    }
    if (nearestRacerLoop === null) {
      const buffer = getLocationBuffer(getSoundLocation(NEAREST_RACER_SOUND_ID))
      if (buffer === null) return
      nearestRacerLoop = startSound(buffer, true)
    }
    applyMix(
      nearestRacerLoop,
      getMix({
        position: sound.position,
        minimumDistance: ENGINE_MINIMUM_DISTANCE,
        maximumDistance: NEAREST_RACER_MAXIMUM_DISTANCE,
        volume: NEAREST_RACER_VOLUME,
        pitch: sound.pitch,
      })
    )
  }

  const setLoopedSounds = (requests: readonly LoopedSoundRequest[]) => {
    if (isDisposed) return
    for (const request of requests) {
      stopEventLoop(request.key)
      if (!request.isStart) continue
      const buffer = getLocationBuffer(request.location)
      // A loop without a source has no place to be heard from; it would drone at full volume everywhere.
      if (buffer === null || request.source === null) continue
      const sound = startSound(buffer, true)
      applyMix(sound, getMix(request.source))
      eventLoops.set(request.key, { sound, request })
    }
  }

  const setListener = (next: SoundListener) => {
    listener = next
    for (const { sound, request } of eventLoops.values()) applyMix(sound, getMix(request.source))
  }

  return Object.freeze({
    resume: () => void context.resume(),
    setListener,
    playSound: (request: SoundRequest) => {
      if (isDisposed) return
      const buffer = getLocationBuffer(request.location)
      if (buffer === null) return
      const mix = getMix(request.source)
      if (mix.directSoundVolume <= SILENT_DIRECT_SOUND_VOLUME) return
      applyMix(startSound(buffer, false), mix)
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
        const playing = startSound(buffer, cue.isLooping)
        playing.volume.gain.value = Math.min(RACE_MUSIC_VOLUME, 1)
        music = playing.source
      })
    },
    setLoopedSounds,
    setEngineLoops,
    setNearestRacerSound,
    dispose: () => {
      isDisposed = true
      musicRequest += 1
      for (const key of [...engineLoops.keys()]) stopEngineLoop(key)
      for (const key of [...eventLoops.keys()]) stopEventLoop(key)
      nearestRacerLoop?.source.stop()
      music?.stop()
      void context.close()
    },
  })
}

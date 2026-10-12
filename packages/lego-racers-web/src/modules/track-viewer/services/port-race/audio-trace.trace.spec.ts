import { appendFileSync } from 'node:fs'
import {
  compareAudioCalls,
  getIsOriginalPresentationAvailable,
  getOriginalAudioCalls,
  LOOPED_SOUND_ID_OFFSET,
  readOriginalPresentation,
} from '@lego-games/lego-racers/presentation-trace'
import type { AudioCall, AudioFrameCalls } from '@lego-games/lego-racers/presentation-trace'
import { FpuPrecision } from '@lego-games/lego-racers/simulation-math'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'
import { AUDIO_SWEEP_CASES } from './audio-sweep-cases.ts'
import { runPortRace } from './port-race.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import type { AudioTraceCase } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

// The idle engine loop (0x00437540, sound 0x20).
const IDLE_ENGINE_SOUND_ID = 0x20
// The loop of the nearest racer (0x0043ccb0).
const NEAREST_RACER_SOUND_ID = 0x4f

const AUDIO_CASES: readonly AudioTraceCase[] = [
  { name: 'Royal Knights', raceFolder: 'RACEC0R0' },
  {
    name: 'Royal Knights, steering',
    raceFolder: 'RACEC0R0',
    isSteering: true,
  },
  {
    name: 'Royal Knights, mirrored',
    raceFolder: 'RACEC0R0',
    isMirrored: true,
  },
  { name: 'RACEC0R1', raceFolder: 'RACEC0R1' },
  { name: 'RACEC0R2', raceFolder: 'RACEC0R2' },
  { name: 'RACEC0R3', raceFolder: 'RACEC0R3' },
  { name: 'RACEC1R0', raceFolder: 'RACEC1R0' },
  { name: 'RACEC3R0', raceFolder: 'RACEC3R0' },
  ...AUDIO_SWEEP_CASES,
]

describe.skipIf(!isGamePresent())('audio trace', () => {
  // eslint-disable-next-line no-restricted-syntax -- the lint rule knows `it(...)` blocks, not `it.each(...)(...)`
  it.each(AUDIO_CASES)('compares $name', async (audioCase) => {
    // Arrange
    const jam = readOriginalJam()
    const scenario = createPresentationScenario(jam, audioCase)
    const original = await readOriginalPresentation(scenario)
    const assets = loadRaceAssets(
      jam,
      { executable: readOriginalExecutable(), tunes: new Map() },
      {
        raceFolder: scenario.raceFolder,
        racerCodes: scenario.racerCodes,
        racerCount: scenario.racerCount,
        localPlayerCount: scenario.localPlayerCount,
        isMirrored: scenario.isMirrored,
        fpuPrecision: FpuPrecision.SINGLE,
        isPlayerChampionCar: true,
      }
    )
    const portFrames: AudioFrameCalls[] = []
    const playingEngineLoops = new Set<string>()
    const playingEventLoops = new Set<string>()
    const soundRacerIndices = new Set<number>()
    let wasNearestRacerHeard = false

    // Act
    const introduction = runPortRace(
      assets,
      scenario.frames,
      (portFrame) => {
        const { sounds, music, loopedSounds, engineLoops } = portFrame.presentation
        if (soundRacerIndices.size === 0) {
          const { playerRacerIndices } = portFrame.raceState
          for (const racerIndex of playerRacerIndices.length === 0 ? [0] : playerRacerIndices) {
            soundRacerIndices.add(racerIndex)
            playingEngineLoops.add(`${String(racerIndex)}:idle`)
          }
        }
        const calls: AudioCall[] = sounds.map((sound) => ({
          kind: 'sound',
          soundId: sound.soundId,
          address: sound.address,
        }))
        // The turbo and warp hum follow the racer's state (0x00437be0 plays a loop only while slot +0xc says it is not
        // playing); every other loop belongs to an object that is made and started.
        for (const loop of loopedSounds) {
          const isStateDriven = loop.key.startsWith('turbo:') || loop.key.startsWith('warp:')
          if (!loop.isStart) {
            playingEventLoops.delete(loop.key)
          } else if (!isStateDriven || !playingEventLoops.has(loop.key)) {
            playingEventLoops.add(loop.key)
            calls.push({
              kind: 'sound',
              soundId: loop.soundId + LOOPED_SOUND_ID_OFFSET,
              address: loop.address,
            })
          }
        }
        // The loop of the racer nearest to the camera's racer (sound 0x4f, 0x0043c1b0) starts whenever it was silent.
        const isNearestRacerHeard = portFrame.presentation.nearestRacerSound !== null
        if (isNearestRacerHeard && !wasNearestRacerHeard) {
          calls.push({
            kind: 'sound',
            soundId: NEAREST_RACER_SOUND_ID + LOOPED_SOUND_ID_OFFSET,
            address: 'nearest',
          })
        }
        wasNearestRacerHeard = isNearestRacerHeard
        // An engine or skid loop that was not playing the frame before is a RaceSounds_Get and a play with 1.
        for (const { racerIndex, loops } of engineLoops) {
          for (const loop of loops) {
            const key = `${String(racerIndex)}:${loop.kind}`
            if (loop.isPlaying && !playingEngineLoops.has(key)) {
              calls.push({
                kind: 'sound',
                soundId: loop.soundId + LOOPED_SOUND_ID_OFFSET,
                address: 'engine',
              })
            }
            if (loop.isPlaying) playingEngineLoops.add(key)
            else playingEngineLoops.delete(key)
          }
        }
        if (music !== null) {
          calls.push({ kind: 'music', listIndex: music.listIndex, isLooping: music.isLooping })
        }
        portFrames.push({ frame: portFrame.frame, calls })
      },
      scenario.powerUpGrants ?? []
    )
    const loadCall: AudioCall = {
      kind: 'music',
      listIndex: introduction.listIndex,
      isLooping: introduction.isLooping,
    }
    // 0x00437540 starts the idle loop of every racer that has sound objects as the track loads.
    const loadLoopCalls: AudioCall[] = [...soundRacerIndices].map(() => ({
      kind: 'sound',
      soundId: IDLE_ENGINE_SOUND_ID + LOOPED_SOUND_ID_OFFSET,
      address: '0x0043765d',
    }))
    const comparison = compareAudioCalls(getOriginalAudioCalls(original.audioFrames), [
      { frame: -1, calls: [loadCall, ...loadLoopCalls] },
      ...portFrames,
    ])

    if (process.env['AUDIO_TRACE_REPORT'] !== undefined) {
      const differing = comparison.sounds.filter((sound) => sound.originalCount !== sound.portCount)
      appendFileSync(
        process.env['AUDIO_TRACE_REPORT'],
        `${audioCase.name}\n${differing.map((sound) => JSON.stringify(sound)).join('\n')}\n${original.audioFrames
          .flatMap(({ frame, events }) =>
            events
              .filter((event) => event.kind === 'racerVoiceCall')
              .map((event) => `voice ${String(frame)} ${JSON.stringify(event.values)}`)
          )
          .join('\n')}\n`
      )
    }

    // Assert
    expect(comparison.musicDifferences).toEqual([])
    expect(
      comparison.sounds
        .filter((sound) => sound.originalCount !== sound.portCount)
        .map((sound) => sound.soundId)
    ).toEqual([])
  })
})

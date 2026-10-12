import { appendFileSync } from 'node:fs'
import {
  compareAudioCalls,
  getIsOriginalPresentationAvailable,
  getOriginalAudioCalls,
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
import { runPortRace } from './port-race.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import type { AudioTraceCase } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

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

    // Act
    const introduction = runPortRace(assets, scenario.frames, (portFrame) => {
      const { sounds, music } = portFrame.presentation
      const calls: AudioCall[] = sounds.map((sound) => ({
        kind: 'sound',
        soundId: sound.soundId,
        address: sound.address,
      }))
      if (music !== null) {
        calls.push({ kind: 'music', listIndex: music.listIndex, isLooping: music.isLooping })
      }
      portFrames.push({ frame: portFrame.frame, calls })
    })
    const loadCall: AudioCall = {
      kind: 'music',
      listIndex: introduction.listIndex,
      isLooping: introduction.isLooping,
    }
    const comparison = compareAudioCalls(getOriginalAudioCalls(original.audioFrames), [
      { frame: -1, calls: [loadCall] },
      ...portFrames,
    ])

    if (process.env['AUDIO_TRACE_REPORT'] !== undefined) {
      const differing = comparison.sounds.filter((sound) => sound.originalCount !== sound.portCount)
      appendFileSync(
        process.env['AUDIO_TRACE_REPORT'],
        `${audioCase.name}\n${differing.map((sound) => JSON.stringify(sound)).join('\n')}\n`
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

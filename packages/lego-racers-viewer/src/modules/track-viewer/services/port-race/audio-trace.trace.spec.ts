import {
  compareAudioCalls,
  getIsOriginalPresentationAvailable,
  getOriginalAudioCalls,
  readOriginalPresentation,
} from '@lego-games/lego-racers/presentation-trace'
import type { AudioCall, AudioFrameCalls } from '@lego-games/lego-racers/presentation-trace'
import { FpuPrecision } from '@lego-games/lego-racers/simulation-math'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import { runPortRace } from './port-race.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

const AUDIO_SCENARIOS: readonly TraceScenarioRequest[] = [
  { name: 'Royal Knights', raceFolder: 'RACEC0R0' },
  { name: 'Royal Knights, steering', raceFolder: 'RACEC0R0', isSteering: true },
  { name: 'Royal Knights, mirrored', raceFolder: 'RACEC0R0', isMirrored: true },
  { name: 'RACEC0R1', raceFolder: 'RACEC0R1' },
  { name: 'RACEC0R2', raceFolder: 'RACEC0R2' },
  { name: 'RACEC0R3', raceFolder: 'RACEC0R3' },
  { name: 'RACEC1R0', raceFolder: 'RACEC1R0' },
  { name: 'RACEC3R0', raceFolder: 'RACEC3R0' },
]

describe.skipIf(!isGamePresent())('audio trace', () => {
  it.each(AUDIO_SCENARIOS)('compares $name', async (request) => {
    // Arrange
    const jam = readOriginalJam()
    const scenario = createPresentationScenario(jam, request)
    // Act
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
        introductionCameraLimit:
          original.introductionCameraLimit < 0 ? null : original.introductionCameraLimit,
        introductionCameraRate: original.introductionCameraRate,
      }
    )
    const portFrames: AudioFrameCalls[] = []
    const introduction = runPortRace(assets, scenario.frames, (portFrame) => {
      const { sounds, music } = portFrame.presentation
      const calls: AudioCall[] = sounds.map((sound) => ({ kind: 'sound', soundId: sound.soundId, address: sound.address }))
      if (music !== null) {
        calls.push({ kind: 'music', listIndex: music.listIndex, isLooping: music.isLooping })
      }
      portFrames.push({ frame: portFrame.frame, calls })
    })
    const portCalls: AudioFrameCalls[] = [
      {
        frame: -1,
        calls: [
          { kind: 'music', listIndex: introduction.listIndex, isLooping: introduction.isLooping },
        ],
      },
      ...portFrames,
    ]
    const comparison = compareAudioCalls(getOriginalAudioCalls(original.audioFrames), portCalls)
    // Assert
    console.log(request.name, JSON.stringify(comparison.musicDifferences), comparison.sounds.filter((sound) => sound.originalCount !== sound.portCount).map((sound) => `${String(sound.soundId)}: original ${String(sound.originalCount)} (${sound.originalAddresses.join(',')}) port ${String(sound.portCount)}`).join('; '))
  })
})

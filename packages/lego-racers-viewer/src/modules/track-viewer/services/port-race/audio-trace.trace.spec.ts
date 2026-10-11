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

// The sound ids the original asks for that the port never does (or asks for a different number of times), per
// scenario: the power-up bricks a computer collects (0x0045d200 sound 0x28 and 0x0045d2a3's ids, 0x00457820), the
// hazards of the track bank (ids 3000 and up: 0x004642c0, 0x004643e0), the engine and skid sounds of
// Racer_UpdateSounds (0x004377f0: 25 and 56), the start sounds of the computers (0x00439420: 11 and 12) and the
// cannon (5 and 6). They are all sites of simulation events the port does not raise yet; see audio-trace.md.
const AUDIO_CASES: readonly AudioTraceCase[] = [
  { name: 'Royal Knights', raceFolder: 'RACEC0R0', gapSoundIds: [11, 14, 40, 49, 72] },
  {
    name: 'Royal Knights, steering',
    raceFolder: 'RACEC0R0',
    isSteering: true,
    gapSoundIds: [11, 14, 25, 40, 49, 56, 72, 3004],
  },
  {
    name: 'Royal Knights, mirrored',
    raceFolder: 'RACEC0R0',
    isMirrored: true,
    gapSoundIds: [11, 14, 40, 49, 72],
  },
  { name: 'RACEC0R1', raceFolder: 'RACEC0R1', gapSoundIds: [40, 49, 3006] },
  { name: 'RACEC0R2', raceFolder: 'RACEC0R2', gapSoundIds: [5, 6, 14, 40, 49] },
  { name: 'RACEC0R3', raceFolder: 'RACEC0R3', gapSoundIds: [40, 49, 3003] },
  { name: 'RACEC1R0', raceFolder: 'RACEC1R0', gapSoundIds: [40, 3000] },
  { name: 'RACEC3R0', raceFolder: 'RACEC3R0', gapSoundIds: [11, 12, 14, 40, 49] },
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

    // Assert
    expect(comparison.musicDifferences).toEqual([])
    expect(
      comparison.sounds
        .filter((sound) => sound.originalCount !== sound.portCount)
        .map((sound) => sound.soundId)
    ).toEqual(audioCase.gapSoundIds)
  })
})

import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { endRaceFromMenu } from '../../../race/index.ts'
import {
  BestTimeKind,
  createDefaultProfile,
  getBestTime,
  getCircuitRank,
  getHasCircuitTrophy,
  getIsCircuitUnlocked,
  markGhostBeaten,
} from '../../../save-data/index.ts'
import type { SaveFile, SaveRacer } from '../../../save-data/index.ts'
import { loadGameResources } from '../../services/load-game-resources/load-game-resources.ts'
import type { GameSession, RaceStart } from '../../types/game-session.types.ts'
import {
  createCircuitSettings,
  createGameSession,
  createTimeTrialSettings,
} from '../create-game-session/create-game-session.ts'
import { playScriptedRace } from '../play-scripted-race/play-scripted-race.ts'
import { finishRace, startNextRace } from '../session-flow/session-flow.ts'
import { applyCircuitResultToSave, applySessionTimesToProfile } from './session-outcome.ts'

const isGamePresent = getIsOriginalJamPresent() && getIsOriginalExecutablePresent()
const FRAME_MILLISECONDS = 100
const RACE_INDEX_OF_RKR = 5
const RACER: SaveRacer = {
  name: 'ASH',
  colorBytes: [0, 0, 0, 0, 0],
  chassisName: 'dachas0',
  designBytes: [],
  circuitRanks: 0,
}

const getResources = () => loadGameResources(readOriginalJam(), readOriginalExecutable())

const getSaveFile = (): SaveFile => ({ profile: createDefaultProfile(0), racers: [RACER] })

const expectRace = (step: ReturnType<typeof startNextRace>): RaceStart => {
  if (step.kind !== 'race') throw new Error('The session ended instead of starting a race')
  return step
}

const getWonCircuit = (circuitName: string): GameSession => {
  const resources = getResources()
  const settings = createCircuitSettings(resources, {
    circuitName,
    racerCount: 5,
    localPlayerCount: 1,
  })
  let session = createGameSession(resources, settings)
  for (let race = 0; race < 4; race += 1) {
    const start = expectRace(startNextRace(session))
    const played = playScriptedRace(
      start,
      [0, 1, 2, 3, 4].map((racerIndex) => ({
        racerIndex,
        lapEndMilliseconds: [1, 2, 3].map((lap) => lap * 6000 + racerIndex * 1500),
      })),
      { frameMilliseconds: FRAME_MILLISECONDS }
    )
    session = finishRace(played.session, played.raceState)
  }
  return startNextRace(session).session
}

describe('what a circuit result writes to the save file', { timeout: 60_000 }, () => {
  it.skipIf(!isGamePresent)(
    'records first place, awards the circuit trophy and unlocks the next circuit',
    () => {
      // Arrange
      const session = getWonCircuit('c1')

      // Act
      const result = applyCircuitResultToSave(session, getSaveFile(), session.resultScreen, 0)

      // Assert
      expect(session.resultScreen).toBe(0x16)
      expect(result.isRankRecorded).toBe(true)
      expect(result.isTrophyAwarded).toBe(true)
      expect(result.unlockedCircuitName).toBe('c2')
      expect(getCircuitRank(result.saveFile.racers[0] ?? RACER, 1)).toBe(1)
      expect(getHasCircuitTrophy(result.saveFile.profile, 1)).toBe(true)
      expect(getIsCircuitUnlocked(result.saveFile.profile, 2)).toBe(true)
      expect(getIsCircuitUnlocked(result.saveFile.profile, 3)).toBe(false)
    },
    60_000
  )

  it.skipIf(!isGamePresent)('records only the place for a third place and unlocks nothing', () => {
    // Arrange
    const session = getWonCircuit('c0')

    // Act
    const result = applyCircuitResultToSave(session, getSaveFile(), 0x18, 0)

    // Assert
    expect(result.isRankRecorded).toBe(true)
    expect(getCircuitRank(result.saveFile.racers[0] ?? RACER, 0)).toBe(3)
    expect(result.isTrophyAwarded).toBe(false)
    expect(result.unlockedCircuitName).toBeNull()
    expect(result.saveFile.profile.circuitUnlockFlags).toBe(0)
  })

  it.skipIf(!isGamePresent)('keeps a better place and does not award a trophy twice', () => {
    // Arrange
    const session = getWonCircuit('c1')
    const once = applyCircuitResultToSave(session, getSaveFile(), 0x16, 0)

    // Act
    const twice = applyCircuitResultToSave(session, once.saveFile, 0x17, 0)

    // Assert
    expect(twice.isRankRecorded).toBe(false)
    expect(twice.isTrophyAwarded).toBe(false)
    expect(twice.unlockedCircuitName).toBeNull()
    expect(getCircuitRank(twice.saveFile.racers[0] ?? RACER, 1)).toBe(1)
  })

  it.skipIf(!isGamePresent)('ignores the screens that are not a circuit result', () => {
    // Arrange
    const session = getWonCircuit('c1')

    // Act
    const none = applyCircuitResultToSave(session, getSaveFile(), 0x19, 0)

    // Assert
    expect(none.isRankRecorded).toBe(false)
    expect(none.saveFile).toEqual(getSaveFile())
  })
})

describe('what a time trial writes to the profile', () => {
  const getTrial = (lapMilliseconds: number): GameSession => {
    const resources = getResources()
    const settings = createTimeTrialSettings(resources, {
      raceName: 'rkr',
      localPlayerCount: 1,
      playerNames: ['ASH'],
    })
    const start = expectRace(startNextRace(createGameSession(resources, settings)))
    const played = playScriptedRace(
      start,
      [{ racerIndex: 0, lapEndMilliseconds: [1, 2, 3].map((lap) => lap * lapMilliseconds) }],
      { frameMilliseconds: FRAME_MILLISECONDS }
    )
    return finishRace(played.session, endRaceFromMenu(played.raceState).raceState)
  }

  it.skipIf(!isGamePresent)(
    'records the best lap and race time under the race and marks the beaten champion',
    () => {
      // Arrange
      const session = getTrial(29000)

      // Act
      const result = applySessionTimesToProfile(session, createDefaultProfile(0))

      // Assert
      const lap = getBestTime(result.profile, RACE_INDEX_OF_RKR, BestTimeKind.LAP)
      const race = getBestTime(result.profile, RACE_INDEX_OF_RKR, BestTimeKind.RACE)
      expect(lap.holderName).toBe('ASH')
      expect(lap.milliseconds).toBeGreaterThan(28000)
      expect(lap.milliseconds).toBeLessThan(31000)
      expect(race.milliseconds).toBeGreaterThan(lap.milliseconds * 2)
      expect(result.isChampionBeaten).toBe(true)
      expect(result.profile.ghostBeatenFlags).toBe(1 << RACE_INDEX_OF_RKR)
      expect(result.resultScreen).toBeNull()
    },
    60_000
  )

  it.skipIf(!isGamePresent)(
    'records the times but not a win when the champion is faster',
    () => {
      // Arrange
      const session = getTrial(45000)

      // Act
      const result = applySessionTimesToProfile(session, createDefaultProfile(0))

      // Assert
      expect(
        getBestTime(result.profile, RACE_INDEX_OF_RKR, BestTimeKind.LAP).milliseconds
      ).toBeGreaterThan(40000)
      expect(result.isChampionBeaten).toBe(false)
      expect(result.profile.ghostBeatenFlags).toBe(0)
    },
    60_000
  )

  it.skipIf(!isGamePresent)(
    'opens the final screen when the twelfth ghost is the one beaten',
    () => {
      // Arrange
      const session = getTrial(29000)
      const eleven = Array.from({ length: 12 }, (_, index) => index)
        .filter((index) => index !== RACE_INDEX_OF_RKR)
        .reduce(
          (profile, index) => markGhostBeaten(profile, index).profile,
          createDefaultProfile(0)
        )

      // Act
      const result = applySessionTimesToProfile(session, eleven)

      // Assert
      expect(result.resultScreen).toBe(0x1c)
      expect(result.profile.trophyFlags & 0x80).toBe(0x80)
    },
    60_000
  )

  it.skipIf(!isGamePresent)('leaves a profile alone when no race with a ghost ran', () => {
    // Arrange
    const resources = getResources()
    const session = createGameSession(
      resources,
      createCircuitSettings(resources, { circuitName: 'c1', racerCount: 5, localPlayerCount: 1 })
    )
    const profile = createDefaultProfile(0)

    // Act
    const result = applySessionTimesToProfile(session, profile)

    // Assert
    expect(result.profile).toBe(profile)
  })
})

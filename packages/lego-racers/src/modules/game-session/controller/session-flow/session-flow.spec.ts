import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { endRaceFromMenu } from '../../../race/index.ts'
import type { GameSession, RaceStart } from '../../types/game-session.types.ts'
import {
  createCircuitSettings,
  createDemonstrationSettings,
  createGameSession,
  createSingleRaceSettings,
  createTimeTrialSettings,
} from '../create-game-session/create-game-session.ts'
import { loadGameResources } from '../../services/load-game-resources/load-game-resources.ts'
import { playScriptedRace } from '../play-scripted-race/play-scripted-race.ts'
import type { RacerLapScript } from '../play-scripted-race/play-scripted-race.types.ts'
import {
  abortSession,
  finishRace,
  getCircuitOutcome,
  getIsFirstRace,
  requestCircuitRestart,
  startNextRace,
} from './session-flow.ts'

const isGamePresent = getIsOriginalJamPresent() && getIsOriginalExecutablePresent()
const FRAME_MILLISECONDS = 100
const RACER_COUNT = 5
const PLAYER_NAMES = ['ASH', 'KK', 'IL', 'RK', 'CC', 'TC']
// A lap of the scripts takes this long for the winner; the others follow in racer order.
const LAP_MILLISECONDS = 30000

const getResources = () => loadGameResources(readOriginalJam(), readOriginalExecutable())

// Racer `place` order: the racer at index `order[0]` crosses the line first, and so on, 1.5 s apart.
const getScripts = (order: readonly number[]): readonly RacerLapScript[] =>
  order.map((racerIndex, rank) => ({
    racerIndex,
    lapEndMilliseconds: [1, 2, 3].map((lap) => lap * LAP_MILLISECONDS + rank * 1500),
  }))

const expectRace = (step: ReturnType<typeof startNextRace>): RaceStart => {
  if (step.kind !== 'race') throw new Error('The session ended instead of starting a race')
  return step
}

const playOneRace = (session: GameSession, order: readonly number[]) => {
  const start = expectRace(startNextRace(session))
  const played = playScriptedRace(start, getScripts(order), {
    frameMilliseconds: FRAME_MILLISECONDS,
  })
  return { start, played, session: finishRace(played.session, played.raceState) }
}

describe('a circuit session', () => {
  it.skipIf(!isGamePresent)(
    'runs the four races of a circuit, adds the points and ends on the first-place screen',
    () => {
      // Arrange
      const resources = getResources()
      const settings = createCircuitSettings(resources, {
        circuitName: 'c1',
        racerCount: RACER_COUNT,
        localPlayerCount: 1,
        playerNames: PLAYER_NAMES,
      })
      const first = createGameSession(resources, settings)

      // Act
      const afterFirst = playOneRace(first, [0, 1, 2, 3, 4])
      const afterSecond = playOneRace(afterFirst.session, [0, 2, 1, 3, 4])
      const afterThird = playOneRace(afterSecond.session, [1, 0, 2, 3, 4])
      const afterFourth = playOneRace(afterThird.session, [0, 1, 2, 3, 4])
      const end = startNextRace(afterFourth.session)

      // Assert
      expect(settings.raceNames).toEqual(['tit', 'rkr', 'ipp', 'ama'])
      expect(afterFirst.start.race.folder).toBe('RACEC1R1')
      expect(afterFirst.played.raceState.placements.slice(0, 5)).toEqual([1, 2, 3, 4, 5])
      expect(afterFirst.session.standings?.totals).toEqual([30, 20, 10, 3, 2, 0])
      expect(afterThird.session.standings?.totals).toEqual([
        30 + 30 + 20,
        20 + 10 + 30,
        10 + 20 + 10,
        9,
        6,
        0,
      ])
      expect(afterFourth.session.standings?.totals[0]).toBe(110)
      expect(end.kind).toBe('finished')
      expect(end.session.resultScreen).toBe(0x16)
      expect(getCircuitOutcome(end.session)).toMatchObject({ rank: 0, resultScreen: 0x16 })
    },
    120_000
  )

  it.skipIf(!isGamePresent)(
    'ends a lone player on the no-place screen with fewer than 10 points per race run',
    () => {
      // Arrange
      const resources = getResources()
      const settings = createCircuitSettings(resources, {
        circuitName: 'c0',
        racerCount: RACER_COUNT,
        localPlayerCount: 1,
        playerNames: PLAYER_NAMES,
      })
      const afterFirst = playOneRace(createGameSession(resources, settings), [1, 2, 3, 4, 0])

      // Act
      const step = startNextRace(afterFirst.session)

      // Assert
      expect(afterFirst.session.standings?.totals[0]).toBe(2)
      expect(step.kind).toBe('finished')
      expect(step.session.resultScreen).toBe(0x19)
    },
    120_000
  )

  it.skipIf(!isGamePresent)(
    'starts the circuit over when the pause menu asks, with empty standings',
    () => {
      // Arrange
      const resources = getResources()
      const settings = createCircuitSettings(resources, {
        circuitName: 'c1',
        racerCount: RACER_COUNT,
        localPlayerCount: 1,
        playerNames: PLAYER_NAMES,
      })
      const afterFirst = playOneRace(createGameSession(resources, settings), [0, 1, 2, 3, 4])

      // Act
      const restarted = startNextRace(requestCircuitRestart(afterFirst.session))

      // Assert
      expect(getIsFirstRace(afterFirst.session)).toBe(false)
      expect(restarted.kind).toBe('race')
      expect(restarted.session.raceIndex).toBe(0)
      expect(restarted.session.standings?.totals).toEqual([0, 0, 0, 0, 0, 0])
      expect(restarted.session.isRestartRequested).toBe(false)
    },
    120_000
  )

  it.skipIf(!isGamePresent)('ends without a result when the player leaves through the menu', () => {
    // Arrange
    const resources = getResources()
    const settings = createCircuitSettings(resources, {
      circuitName: 'c1',
      racerCount: RACER_COUNT,
      localPlayerCount: 1,
    })
    const session = createGameSession(resources, settings)

    // Act
    const step = startNextRace(abortSession(session))

    // Assert
    expect(step.kind).toBe('finished')
    expect(step.session.resultScreen).toBe(2)
  })

  it.skipIf(!isGamePresent)(
    'runs the mirrored second pass of a circuit on the same folders with the mirror flag',
    () => {
      // Arrange
      const resources = getResources()
      const settings = createCircuitSettings(resources, {
        circuitName: 'c3',
        racerCount: RACER_COUNT,
        localPlayerCount: 1,
      })

      // Act
      const start = expectRace(startNextRace(createGameSession(resources, settings)))

      // Assert
      expect(settings.raceNames).toEqual(['dad2', 'mmm2', 'dfd2', 'igp2'])
      expect(start.race.folder).toBe('RACEC0R2')
      expect(start.race.isMirrored).toBe(true)
      expect(start.definition.isMirrored).toBe(true)
      expect(start.definition.isPointsRecordPresent).toBe(true)
    }
  )
})

describe('a single race session', () => {
  it.skipIf(!isGamePresent)('runs one race, once, and advances the random table cursor', () => {
    // Arrange
    const resources = getResources()
    const settings = createSingleRaceSettings(resources, {
      raceName: 'rkr',
      racerCount: 6,
      localPlayerCount: 1,
      randomPosition: 7,
    })
    const session = createGameSession(resources, settings)

    // Act
    const played = playOneRace(session, [0, 1, 2, 3, 4, 5])
    const end = startNextRace(played.session)

    // Assert
    expect(played.start.definition.isPointsRecordPresent).toBe(false)
    expect(played.session.standings).toBeNull()
    expect(played.start.definition.racers).toHaveLength(6)
    expect(played.session.randomPosition).not.toBe(7)
    expect(end.kind).toBe('finished')
    expect(end.session.resultScreen).toBe(2)
  })

  it.skipIf(!isGamePresent)(
    'races with two local players on the split screen with the option laps and no points',
    () => {
      // Arrange
      const resources = getResources()
      const settings = createSingleRaceSettings(resources, {
        raceName: 'rkr',
        racerCount: 6,
        localPlayerCount: 2,
        multiplayerLapCount: 2,
      })

      // Act
      const start = expectRace(startNextRace(createGameSession(resources, settings)))

      // Assert
      expect(start.definition.localPlayerCount).toBe(2)
      expect(start.definition.multiplayerLapCount).toBe(2)
      expect(start.definition.racers.map(({ controllerKind }) => controllerKind)).toEqual([
        0, 0, 2, 2, 2, 2,
      ])
    }
  )

  it.skipIf(!isGamePresent)(
    'mirrors the final race with race mode flag 0x20 and clears the flags for a circuit',
    () => {
      // Arrange
      const resources = getResources()
      const final = createSingleRaceSettings(resources, {
        raceName: 'rr',
        racerCount: 6,
        localPlayerCount: 1,
        raceModeFlags: 0x20,
      })
      const circuit = createCircuitSettings(resources, {
        circuitName: 'c6',
        racerCount: 6,
        localPlayerCount: 1,
        raceModeFlags: 0x20,
      })

      // Act
      const start = expectRace(startNextRace(createGameSession(resources, final)))

      // Assert
      expect(start.race.entry.isFlagged).toBe(false)
      expect(start.race.isMirrored).toBe(true)
      expect(start.definition.isMirrored).toBe(true)
      expect(circuit.raceNames).toEqual(['rr', null, null, null])
      expect(circuit.raceModeFlags).toBe(0)
    }
  )

  it.skipIf(!isGamePresent)('picks the demonstration race with the random table', () => {
    // Arrange
    const resources = getResources()

    // Act
    const settings = createDemonstrationSettings(resources, { randomPosition: 0 })
    const start = expectRace(startNextRace(createGameSession(resources, settings)))

    // Assert
    expect(settings.localPlayerCount).toBe(0)
    expect(['igp', 'dfd', 'mmm', 'dad']).toContain(settings.raceNames[0])
    expect(start.definition.racers).toHaveLength(6)
    expect(start.session.randomPosition).toBeGreaterThan(0)
  })
})

describe('a time trial session', () => {
  const getPlayedTrial = (lapMilliseconds: number) => {
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
    return { resources, start, played }
  }

  it.skipIf(!isGamePresent)(
    'races alone against the champion ghost and holds at the menu after the finish',
    () => {
      // Arrange
      const { start, played } = getPlayedTrial(30000)

      // Act
      const ended = endRaceFromMenu(played.raceState).raceState
      const session = finishRace(played.session, ended)

      // Assert
      expect(start.definition.racers).toHaveLength(1)
      expect(start.definition.ghost?.championRun?.lapMilliseconds).toEqual([32266, 30015, 33066])
      expect(played.isHeldForMenu).toBe(true)
      expect(played.raceState.ghost?.bestRun?.lapMilliseconds.length).toBe(3)
      expect(played.raceState.ghost?.bestRun?.samples.length).toBeGreaterThan(300)
      expect(session.isChampionBeaten).toBe(true)
      expect(session.isTimeRecordPending).toBe(true)
      expect(session.raceTimes[0]?.bestLapMilliseconds).toBeGreaterThan(0)
    },
    120_000
  )

  it.skipIf(!isGamePresent)(
    'does not beat a champion ghost that finished sooner',
    () => {
      // Arrange
      const { played } = getPlayedTrial(40000)

      // Act
      const session = finishRace(played.session, endRaceFromMenu(played.raceState).raceState)

      // Assert
      expect(session.isChampionBeaten).toBe(false)
      expect(session.isTimeRecordPending).toBe(true)
    },
    120_000
  )
})

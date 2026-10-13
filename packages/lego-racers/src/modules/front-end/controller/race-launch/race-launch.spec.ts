import { createRandomTable } from '../../../random-table/index.ts'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { awardPlacePoints, createCircuitStandings } from '../../../circuit-standings/index.ts'
import {
  createGameSession,
  GameMode,
  loadGameResources,
  startNextRace,
} from '../../../game-session/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { loadFrontEndResources } from '../../services/load-front-end-resources/load-front-end-resources.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type { FrontEndEnvironment, FrontEndRaceRequest } from '../../types/front-end.types.ts'
import { createFrontEnd, getFrontEndFrame, stepFrontEnd } from '../front-end/front-end.ts'
import { getSessionSettings } from './get-session-settings.ts'
import { getStandingRows } from './get-standing-rows.ts'

const getRequest = (changes: Partial<FrontEndRaceRequest>): FrontEndRaceRequest => ({
  mode: 'circuit',
  raceName: '',
  raceFolder: '',
  isRaceFlagged: false,
  circuitRaces: [],
  circuitName: 'c0',
  racerCount: 5,
  localPlayerCount: 1,
  lapCount: 3,
  playerRacerNames: [],
  playerCar: null,
  randomPosition: 0,
  ...changes,
})

const isOriginalPresent = () => getIsOriginalJamPresent() && getIsOriginalExecutablePresent()

describe('the session the menus start', () => {
  it.skipIf(!isOriginalPresent())('fills the four races of a circuit and starts the first', () => {
    // Arrange
    const resources = loadGameResources(readOriginalJam(), readOriginalExecutable())
    const settings = getSessionSettings(resources, getRequest({}), 0)

    // Act
    const session = createGameSession(resources, settings)
    const first = startNextRace(session)

    // Assert
    expect(settings.mode).toBe(GameMode.CIRCUIT)
    expect(settings.raceNames.filter((name) => name !== null)).toHaveLength(4)
    expect(first.kind).toBe('race')
  })

  it.skipIf(!isOriginalPresent())('starts a single race and a time trial on their one race', () => {
    // Arrange
    const resources = loadGameResources(readOriginalJam(), readOriginalExecutable())
    const raceName = resources.catalog.entries[0]?.name ?? ''

    // Act
    const single = getSessionSettings(resources, getRequest({ mode: 'single_race', raceName }), 0)
    const trial = getSessionSettings(resources, getRequest({ mode: 'time_trial', raceName }), 0)

    // Assert
    expect(single.mode).toBe(GameMode.SINGLE_RACE)
    expect(trial.mode).toBe(GameMode.TIME_TRIAL)
    expect(trial.racerCount).toBe(1)
  })

  it.skipIf(!isOriginalPresent())(
    'lists the standings best first on the circuit result screen',
    () => {
      // Arrange
      const jam = readOriginalJam()
      const resources = loadGameResources(jam, readOriginalExecutable())
      const settings = getSessionSettings(resources, getRequest({}), 0)
      const base = createGameSession(resources, settings)
      const session = {
        ...base,
        standings: awardPlacePoints(awardPlacePoints(createCircuitStandings(), 0, 1), 1, 0),
      }
      const rows = getStandingRows(session, 3)
      const environment: FrontEndEnvironment = {
        controllerCount: 0,
        unlockedCircuitMask: 0x7f,
        randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
        isEveryPartUnlocked: true,
        playerRacerNames: [],
        standingRows: rows,
      }
      const files = loadFrontEndResources(openJamArchive(jam))
      const state = createFrontEnd(files, environment, FrontEndScreen.CIRCUIT_AWARD_ONE)

      // Act
      const frame = getFrontEndFrame(state, files, environment)
      const early = stepFrontEnd(state, files, environment, 'accept', 16).state
      // The award cinema takes a key from its thirtieth frame (0x00466ec0): a second at 30 frames per second.
      const waited = Array.from({ length: 63 }).reduce<typeof state>(
        (current) => stepFrontEnd(current, files, environment, null, 16).state,
        state
      )
      const left = stepFrontEnd(waited, files, environment, 'accept', 16).state

      // Assert
      expect(rows.map((row) => row.points)).toEqual([30, 20, 0])
      expect(rows[1]?.isPlayer).toBe(true)
      expect(
        frame.commands.filter((command) => command.kind === 'text').length
      ).toBeGreaterThanOrEqual(3)
      expect(early.screens.map((screen) => screen.screenId)).toEqual([
        FrontEndScreen.CIRCUIT_AWARD_ONE,
      ])
      expect(left.screens.map((screen) => screen.screenId)).toEqual([
        FrontEndScreen.CIRCUIT_AWARD_ONE,
        FrontEndScreen.MAIN_MENU,
      ])
    }
  )
})

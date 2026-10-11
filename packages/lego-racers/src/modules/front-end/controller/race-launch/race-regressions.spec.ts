import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { createGameSession, loadGameResources, startNextRace } from '../../../game-session/index.ts'
import {
  createRace,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  RacePhase,
  stepRace,
} from '../../../race/index.ts'
import type { RaceState } from '../../../race/index.ts'
import type { FrontEndRaceRequest } from '../../types/front-end.types.ts'
import { getSessionSettings } from './get-session-settings.ts'

const isOriginalPresent = () => getIsOriginalJamPresent() && getIsOriginalExecutablePresent()
// The viewer's frame clock hands the race about 16 ms at a time.
const FRAME_MILLISECONDS = 16
const FRAMES_PER_SECOND = 62
const FIRST_CIRCUIT = 'c0'
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

const getRequest = (raceName: string): FrontEndRaceRequest => ({
  mode: 'single_race',
  raceName,
  raceFolder: '',
  isRaceFlagged: false,
  circuitRaces: [],
  circuitName: FIRST_CIRCUIT,
  racerCount: 6,
  localPlayerCount: 1,
  lapCount: 3,
  playerRacerNames: [],
  playerCar: null,
})

// Single Race, the first race of the first circuit, started the way the viewer starts it.
const startSingleRace = () => {
  const resources = loadGameResources(readOriginalJam(), readOriginalExecutable())
  const raceName =
    resources.catalog.entries.find(
      (entry) => entry.circuitName === FIRST_CIRCUIT && entry.raceNumber === 0
    )?.name ?? ''
  const session = createGameSession(
    resources,
    getSessionSettings(resources, getRequest(raceName), 0)
  )
  const start = startNextRace(session)
  if (start.kind !== 'race') throw new Error('The session started no race')
  return start.definition
}

const stepSeconds = (state: RaceState, seconds: number, isAccelerating: boolean): RaceState =>
  Array.from({ length: Math.round(seconds * FRAMES_PER_SECOND) }).reduce<RaceState>(
    (current) =>
      stepRace(
        current,
        {
          controls: [{ ...IDLE_RACER_CONTROLS, isAcceleratePressed: isAccelerating }],
          contacts: NO_RACE_CONTACTS,
        },
        FRAME_MILLISECONDS
      ).raceState,
    state
  )

const getRacing = (state: RaceState): RaceState =>
  state.phase === RacePhase.RACING ? state : getRacing(stepSeconds(state, 0.5, false))

const getDistance = (from: RaceState, to: RaceState, racerIndex: number): number => {
  const start = from.racerSet.racers[racerIndex]?.carBody.rigidBody.frame.position
  const end = to.racerSet.racers[racerIndex]?.carBody.rigidBody.frame.position
  if (start === undefined || end === undefined) return 0
  return Math.hypot(end.x - start.x, end.y - start.y)
}

describe('the race the menus start', () => {
  it.skipIf(!isOriginalPresent())(
    'moves the computer racers along their routes',
    () => {
      // Arrange
      const racing = getRacing(createRace(startSingleRace()))

      // Act
      const later = stepSeconds(racing, 8, false)

      // Assert
      const distances = [1, 2, 3, 4, 5].map((racerIndex) => getDistance(racing, later, racerIndex))
      expect(Math.min(...distances)).toBeGreaterThan(60)
    },
    TEST_TIMEOUT_IN_MILLISECONDS
  )

  it.skipIf(!isOriginalPresent())(
    'lets the player drive straight off the grid',
    () => {
      // Arrange
      const racing = getRacing(createRace(startSingleRace()))

      // Act
      const later = stepSeconds(racing, 8, true)

      // Assert
      expect(getDistance(racing, later, 0)).toBeGreaterThan(100)
    },
    TEST_TIMEOUT_IN_MILLISECONDS
  )

  it.skipIf(!isOriginalPresent())(
    'places the power-up bricks on the track',
    () => {
      // Arrange
      const definition = startSingleRace()

      // Act
      const racing = getRacing(createRace(definition))
      const later = stepSeconds(racing, 4, false)

      // Assert
      expect(definition.powerUps.bricks.length).toBeGreaterThan(0)
      expect(later.powerUpStep.world.bricks).toHaveLength(definition.powerUps.bricks.length)
      expect(later.registryObjects.length).toBeGreaterThan(0)
    },
    TEST_TIMEOUT_IN_MILLISECONDS
  )
})

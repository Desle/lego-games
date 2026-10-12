import {
  createDemonstrationSettings,
  createGameSession,
  loadGameResources,
  startNextRace,
} from '@lego-games/lego-racers/game-session'
import {
  createRace,
  IDLE_RACER_CONTROLS,
  NO_MENU_INPUT,
  NO_RACE_CONTACTS,
  RaceExit,
  stepRace,
} from '@lego-games/lego-racers/race'
import type { RaceState } from '@lego-games/lego-racers/race'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'

const FRAME_MILLISECONDS = 33
const RUNNING_FRAMES = 600
const DEMONSTRATION_RACER_COUNT = 6

const getDemonstration = (): RaceState => {
  const jam = readOriginalJam()
  const executable = readOriginalExecutable()
  const resources = loadGameResources(jam, executable)
  const session = createGameSession(
    resources,
    createDemonstrationSettings(resources, { randomPosition: 0 })
  )
  const next = startNextRace(session)
  if (next.kind !== 'race') throw new RangeError('The demonstration has no race')
  const assets = loadRaceAssets(
    jam,
    { executable, tunes: new Map() },
    { raceFolder: next.race.folder },
    next.definition
  )
  return createRace(assets.definition)
}

const step = (state: RaceState, isAnyInputPressed: boolean): RaceState =>
  stepRace(
    state,
    {
      controls: [IDLE_RACER_CONTROLS],
      contacts: NO_RACE_CONTACTS,
      menu: { ...NO_MENU_INPUT, isAnyInputPressed },
    },
    FRAME_MILLISECONDS
  ).raceState

describe('the demonstration race', () => {
  it.skipIf(!getIsOriginalGamePresent())(
    'drives the first racer by the computer and ends at any key',
    () => {
      // Arrange
      let state = getDemonstration()
      for (let frame = 0; frame < RUNNING_FRAMES; frame += 1) state = step(state, false)
      const advanced = state.racerSet.racers.length

      // Act
      const interrupted = step(state, true)

      // Assert
      expect(advanced).toBe(DEMONSTRATION_RACER_COUNT)
      expect(state.isDemonstration).toBe(true)
      expect(state.isRunning).toBe(true)
      expect(interrupted.isRunning).toBe(false)
      expect(interrupted.exit).toBe(RaceExit.DEMONSTRATION_INTERRUPTED)
    }
  )
})

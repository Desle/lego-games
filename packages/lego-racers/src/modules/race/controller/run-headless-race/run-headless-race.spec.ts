import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { RaceExit } from '../../types/race-exit/race-exit.ts'
import { RacePhase } from '../../types/race-phase/race-phase.ts'
import { loadRaceDefinition } from '../../services/load-race/load-race.ts'
import { runHeadlessRace } from './run-headless-race.ts'

const FRAME_COUNT = 300
const FRAME_MILLISECONDS = 33
const PLAYER = 0
const COMPUTER_RACER_COUNT = 5
const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent()

describe('runHeadlessRace', () => {
  it.skipIf(!getIsGamePresent())(
    'runs Royal Knights Raceway: the computer racers advance along their routes, identically twice',
    () => {
      // Arrange
      const definition = loadRaceDefinition(readOriginalJam(), readOriginalExecutable())
      const options = { frameCount: FRAME_COUNT, frameMilliseconds: FRAME_MILLISECONDS }

      // Act
      const start = runHeadlessRace(definition, { ...options, frameCount: 0 })
      const first = runHeadlessRace(definition, options)
      const second = runHeadlessRace(definition, options)

      // Assert
      expect(second.raceState).toEqual(first.raceState)
      expect(first.phase).toBe(RacePhase.RACING)
      const computers = first.racers.filter((racer) => racer.racerIndex !== PLAYER)
      expect(computers).toHaveLength(COMPUTER_RACER_COUNT)
      for (const computer of computers) {
        const before = start.racers[computer.racerIndex]
        expect(computer.routeSampleIndex).toBeGreaterThan(0)
        expect(computer.routeTimeMilliseconds).toBeGreaterThan(0)
        expect(computer.position.y).toBeGreaterThan(before?.position.y ?? Infinity)
      }
    }
  )

  it.skipIf(!getIsGamePresent())(
    'leaves the player on the road with four wheels down when nobody touches the controls',
    () => {
      // Arrange
      const definition = loadRaceDefinition(readOriginalJam(), readOriginalExecutable())

      // Act
      const report = runHeadlessRace(definition, {
        frameCount: FRAME_COUNT,
        frameMilliseconds: FRAME_MILLISECONDS,
      })

      // Assert
      expect(report.racers[PLAYER]?.groundedWheelCount).toBe(4)
      expect(report.racers[PLAYER]?.routeSampleIndex).toBeNull()
    }
  )

  it.skipIf(!getIsGamePresent())(
    'shows checkpoint, lap and finish progress: the computer racers touch the checkpoints, cross the start line and finish three laps',
    () => {
      // Arrange
      const definition = loadRaceDefinition(readOriginalJam(), readOriginalExecutable())

      // Act
      const early = runHeadlessRace(definition, { frameCount: 300, frameMilliseconds: 33 })
      const late = runHeadlessRace(definition, { frameCount: 4800, frameMilliseconds: 33 })

      // Assert
      const earlyComputers = early.racers.filter((racer) => racer.racerIndex !== PLAYER)
      expect(earlyComputers.every((racer) => racer.checkpointIndex >= 0)).toBe(true)
      expect(earlyComputers.some((racer) => racer.checkpointIndex > 0)).toBe(true)
      const lateComputers = late.racers.filter((racer) => racer.racerIndex !== PLAYER)
      expect(lateComputers.every((racer) => racer.isPlaced && racer.currentLap === 3)).toBe(true)
      const finished = late.events.flatMap((event) =>
        event.type === 'race.racer_finished' ? [event.place] : []
      )
      expect(finished).toEqual([1, 2, 3, 4, 5])
      expect(late.racers[PLAYER]?.isPlaced).toBe(false)
      expect(late.phase).toBe(RacePhase.RACING)
    }
  )

  it.skipIf(!getIsGamePresent())(
    'runs a demonstration race from the start to its result, identically twice',
    () => {
      // Arrange
      const definition = loadRaceDefinition(readOriginalJam(), readOriginalExecutable(), {
        localPlayerCount: 0,
      })
      const options = { frameCount: 7200, frameMilliseconds: 33 }

      // Act
      const first = runHeadlessRace(definition, options)
      const second = runHeadlessRace(definition, options)

      // Assert
      expect(second.raceState).toEqual(first.raceState)
      expect(first.phase).toBe(RacePhase.RESULTS)
      expect(first.exit).toBe(RaceExit.FINISHED)
      expect(first.events.at(-1)).toEqual({ type: 'race.ended', exit: RaceExit.FINISHED })
      expect(first.finishedRacerCount).toBe(6)
      expect([...first.placements].sort()).toEqual([1, 2, 3, 4, 5, 6])
      expect(first.racers.every((racer) => racer.isPlaced)).toBe(true)
    }
  )
})

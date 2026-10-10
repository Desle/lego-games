import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
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
})

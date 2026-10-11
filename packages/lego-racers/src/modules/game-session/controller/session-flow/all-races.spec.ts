import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { createRace, loadRaceDefinition, RacePhase, runHeadlessRace } from '../../../race/index.ts'
import type { RaceDefinition } from '../../../race/index.ts'
import { loadGameResources } from '../../services/load-game-resources/load-game-resources.ts'
import {
  createGameSession,
  createSingleRaceSettings,
} from '../create-game-session/create-game-session.ts'
import { startNextRace } from './session-flow.ts'

const isGamePresent = getIsOriginalJamPresent() && getIsOriginalExecutablePresent()
const FRAME_COUNT = 160
const FRAME_MILLISECONDS = 50
const COUNTDOWN_END_MILLISECONDS = 5000
const FIRST_CIRCUIT_RACER_CODES = ['KK', 'CR', 'GB', 'RH', 'AD', 'PH']

const getRunReport = (definition: RaceDefinition) => {
  const report = runHeadlessRace(definition, {
    frameCount: FRAME_COUNT,
    frameMilliseconds: FRAME_MILLISECONDS,
  })
  const start = runHeadlessRace(definition, {
    frameCount: 0,
    frameMilliseconds: FRAME_MILLISECONDS,
  })
  return { report, start }
}

describe('every race of the catalog', () => {
  it.skipIf(!isGamePresent)(
    'loads from LEGO.JAM and runs through the countdown into the race, mirrored or not',
    () => {
      // Arrange
      const resources = loadGameResources(readOriginalJam(), readOriginalExecutable())
      const entries = resources.catalog.entries.filter((entry) => entry.circuitName !== '')

      // Act
      const runs = entries.map((entry) => {
        const settings = createSingleRaceSettings(resources, {
          raceName: entry.name,
          racerCount: 6,
          localPlayerCount: 1,
        })
        const step = startNextRace(createGameSession(resources, settings))
        if (step.kind !== 'race') throw new Error(`${entry.name} did not start`)
        return { entry, step, ...getRunReport(step.definition) }
      })

      // Assert
      expect(entries).toHaveLength(25)
      expect(new Set(entries.map(({ firstName }) => firstName)).size).toBe(13)
      for (const { entry, step, report, start } of runs) {
        const label = `${entry.name} (${entry.firstName})`
        expect(step.definition.racers.length, label).toBeGreaterThanOrEqual(2)
        expect(step.definition.isMirrored, label).toBe(entry.isFlagged)
        expect(step.definition.checkpoints.length, label).toBeGreaterThan(0)
        expect(step.definition.startPositions.length, label).toBeGreaterThan(0)
        expect(report.elapsedMilliseconds, label).toBeGreaterThan(COUNTDOWN_END_MILLISECONDS)
        expect(report.phase, label).toBe(RacePhase.RACING)
        const computers = report.racers.filter((racer) => racer.controllerKind === 2)
        expect(computers.length, label).toBeGreaterThan(0)
        for (const racer of report.racers) {
          expect(
            Number.isFinite(racer.position.x + racer.position.y + racer.position.z),
            label
          ).toBe(true)
        }
        const moved = computers.filter((racer) => {
          const before = start.racers[racer.racerIndex]?.position
          return (
            before !== undefined &&
            Math.hypot(
              racer.position.x - before.x,
              racer.position.y - before.y,
              racer.position.z - before.z
            ) > 1
          )
        })
        expect(moved.length, label).toBe(computers.length)
      }
    },
    120_000
  )

  it.skipIf(!isGamePresent)(
    'loads the two catalog entries without a circuit with the first circuit drivers',
    () => {
      // Arrange
      const resources = loadGameResources(readOriginalJam(), readOriginalExecutable())
      const orphans = resources.catalog.entries.filter((entry) => entry.circuitName === '')

      // Act
      const definitions = orphans.map((entry) =>
        loadRaceDefinition(resources.jam, resources.executable, {
          raceFolder: entry.firstName.toUpperCase(),
          racerCodes: FIRST_CIRCUIT_RACER_CODES,
          racerCount: 3,
          isMirrored: entry.isFlagged,
        })
      )
      const states = definitions.map(createRace)

      // Assert
      expect(orphans.map(({ name }) => name)).toEqual(['rr2', 'test'])
      expect(states.map(({ racerSet }) => racerSet.racers.length)).toEqual([3, 3])
      expect(definitions.map(({ isMirrored }) => isMirrored)).toEqual([true, false])
    },
    120_000
  )
})

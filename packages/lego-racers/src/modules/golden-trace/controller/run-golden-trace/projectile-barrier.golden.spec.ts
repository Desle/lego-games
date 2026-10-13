import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getCircuitRacerCodes, loadRaceDefinition } from '../../../race/index.ts'
import { RaceBinding } from '../../../race-input/index.ts'
import { FpuPrecision } from '../../../simulation-math/index.ts'
import {
  getIsOriginalTraceAvailable,
  readOriginalTrace,
} from '../../services/original-trace/original-trace.ts'
import type { GoldenTraceScenario, TraceFrameInput } from '../../types/golden-trace.types.ts'
import { getRouteDrivingFrames } from '../route-driving/route-driving.ts'
import { createTraceScenario, holdBindings } from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 1_800_000
const PIRATE_RACE_FOLDER = 'RACEC0R1'
const PIRATE_CIRCUIT_NAME = 'c0'
// The track material of the barrels the shortcut is closed with (RACEC0R1.TMB, entry 3 of 5: startfin, in, out,
// shootme, go_thru). Flags 0x10000 and 0x20000 set mean the barrier is open to cars and projectiles.
const BARRIER_MATERIAL_INDEX = 3
const BARRIER_OPEN_FLAGS = 0x30000
// The route passes bricks that would replace an earlier grant, so the brick is granted three frames before use.
const GRANT_LEAD_FRAMES = 3
// The driven player is at (-558, 536, 52) heading (0.97, -0.16, 0.15) at this frame: the barrier's 36 by 19 unit wall
// lies 160 units ahead, at (-402, 508, 100).
const FIRE_FRAME = Number(process.env['BARRIER_FIRE_FRAME'] ?? '1460')
// The wand's beam only exists after its 500 ms start and lasts while the car points at the wall.
const WAND_FIRE_FRAME = Number(process.env['BARRIER_WAND_FIRE_FRAME'] ?? '1440')
const FRAME_COUNT = Number(process.env['BARRIER_FRAMES'] ?? '1560')
const USE_FRAME_COUNT = 3
const PROJECTILE_KIND = 1
const CANNON_LEVEL = 0
const WAND_LEVEL = 2

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

const getScenario = (name: string, level: number, fireFrame: number): GoldenTraceScenario => {
  const jam = readOriginalJam()
  const racerCodes = getCircuitRacerCodes(openJamArchive(jam).readFile, PIRATE_RACE_FOLDER)
  const definition = loadRaceDefinition(jam, readOriginalExecutable(), {
    raceFolder: PIRATE_RACE_FOLDER,
    racerCodes,
    localPlayerCount: 1,
    fpuPrecision: FpuPrecision.SINGLE,
    isPlayerChampionCar: true,
    musicTuneCount: 0,
  })
  const [useFrame] = holdBindings(1, [RaceBinding.USE_POWER_UP])
  const useCodes = useFrame?.scanCodes ?? []
  const frames: readonly TraceFrameInput[] = getRouteDrivingFrames(definition, FRAME_COUNT).map(
    (frame, index) =>
      index >= fireFrame && index < fireFrame + USE_FRAME_COUNT
        ? { ...frame, scanCodes: [...frame.scanCodes, ...useCodes] }
        : frame
  )
  return createTraceScenario({
    name,
    raceFolder: PIRATE_RACE_FOLDER,
    racerCodes,
    circuitName: PIRATE_CIRCUIT_NAME,
    frames,
    powerUpGrants: [
      { frame: fireFrame - GRANT_LEAD_FRAMES, racer: 0, kind: PROJECTILE_KIND, level },
    ],
  })
}

// The frame the barrier's track material first has both pass-through flags, or null when it never does.
const getOpenedFrame = async (scenario: GoldenTraceScenario): Promise<number | null> => {
  const original = await readOriginalTrace(scenario)
  const opened = original.frames.find(
    (frame) =>
      ((frame.fields['track.surfaces']?.[BARRIER_MATERIAL_INDEX] ?? 0) & BARRIER_OPEN_FLAGS) ===
      BARRIER_OPEN_FLAGS
  )
  return opened?.frame ?? null
}

// No divergence is left: the oil slick and magnet registry ends and the barrel spin were the last ones.
const KNOWN_DIVERGENT_FIELDS: readonly string[] = []

describe('golden trace: a projectile opens the shortcut barrier', () => {
  it.skipIf(!getIsGamePresent())(
    'matches the original in the barrier, its hazard, its events and the racers, for a cannon ball and a wand',
    async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const scenarios = [
        getScenario('pirate-cannon-barrier', CANNON_LEVEL, FIRE_FRAME),
        getScenario('pirate-wand-barrier', WAND_LEVEL, WAND_FIRE_FRAME),
      ]

      // Act
      const results: { readonly openedFrame: number | null; readonly fields: readonly string[] }[] =
        []
      for (const scenario of scenarios) {
        const result = await runGoldenTrace(scenario, jam, executable)
        results.push({
          openedFrame: await getOpenedFrame(scenario),
          fields: result.comparison.divergenceByField.map((divergence) => divergence.field),
        })
        console.log(
          `${scenario.name}: opened at ${String(results.at(-1)?.openedFrame)}\n` +
            result.comparison.divergenceByField.map(formatDivergence).join('\n')
        )
      }

      // Assert
      expect(results).toEqual([
        { openedFrame: 1477, fields: KNOWN_DIVERGENT_FIELDS },
        { openedFrame: 1460, fields: KNOWN_DIVERGENT_FIELDS },
      ])
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

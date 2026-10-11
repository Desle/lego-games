import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getCircuitRacerCodes } from '../../../race/index.ts'
import { getIsOriginalTraceAvailable } from '../../services/original-trace/original-trace.ts'
import type { FieldDivergence, GoldenTraceScenario } from '../../types/golden-trace.types.ts'
import { holdBindings } from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 3_600_000
// A race of only computers (a demonstration) for this many 33 ms frames; a full race takes about 4,000 to 9,000.
const FRAME_COUNT = Number(process.env['TRACK_TRACE_FRAMES'] ?? 1500)
const MIRRORED_FRAME_COUNT = Number(process.env['TRACK_TRACE_MIRRORED_FRAMES'] ?? 600)
const SELECTED_RACES = (process.env['TRACK_TRACE_RACES'] ?? '').split(',').filter(Boolean)

const RACE_CIRCUITS: Readonly<Record<string, string>> = {
  RACEC0R0: 'c1',
  RACEC1R1: 'c1',
  RACEC1R2: 'c1',
  RACEC1R3: 'c1',
  RACEC0R1: 'c0',
  RACEC0R2: 'c0',
  RACEC0R3: 'c0',
  RACEC1R0: 'c0',
  RACEC2R0: 'c2',
  RACEC2R1: 'c2',
  RACEC2R2: 'c2',
  RACEC2R3: 'c2',
  RACEC3R0: 'c6',
}

// The 13 tracks, and the 12 of them LEGORACE.RCB lists a second time as the mirrored circuits c3 to c5 (25 races).
const TRACKS = Object.keys(RACE_CIRCUITS)
const MIRRORED_TRACKS = TRACKS.filter((track) => track !== 'RACEC3R0')

// The fields of this suite: the race flow, the track logic (events, hazards, triggers, timers, worlds, sky) and the
// racers' lap and countdown bookkeeping.
const getIsTrackField = (field: string): boolean =>
  field.startsWith('track.') || field.startsWith('race.') || field.includes('.flow.')

const getIsPhysicsField = (field: string): boolean =>
  field.includes('.body.') || field.includes('.display.') || field.includes('.volume.')

// The power-ups' emitters and projectiles (oil slicks, cannons, grapples) are not simulated yet: the first random
// draw the port misses ends the part of the race the suite can judge (golden-trace.md).
const RANDOM_POSITION_FIELD = 'race.randomPosition'

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

const getScenario = (
  raceFolder: string,
  isMirrored: boolean,
  frameCount: number
): GoldenTraceScenario => {
  const archive = openJamArchive(readOriginalJam())
  const racerCodes = getCircuitRacerCodes(archive.readFile, raceFolder)
  return {
    name: `${raceFolder.toLowerCase()}${isMirrored ? '-mirrored' : ''}`,
    raceFolder,
    racerCodes,
    racerCount: Math.min(6, racerCodes.length),
    localPlayerCount: 0,
    randomPosition: 0,
    isMirrored,
    circuit: RACE_CIRCUITS[raceFolder] ?? 'c1',
    precision: 'auto',
    frames: holdBindings(frameCount, []),
  }
}

const getFirstFrame = (divergences: readonly FieldDivergence[]): number =>
  divergences.reduce((first, divergence) => Math.min(first, divergence.frame), Infinity)

describe('track logic and race flow: the original race and the port, frame for frame', () => {
  it.skipIf(!getIsGamePresent())(
    'matches the original in every track logic and race flow field until a racer or a power-up object differs',
    async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const runs = [
        ...TRACKS.map((track) => ({ track, isMirrored: false, frameCount: FRAME_COUNT })),
        ...MIRRORED_TRACKS.map((track) => ({
          track,
          isMirrored: true,
          frameCount: MIRRORED_FRAME_COUNT,
        })),
      ].filter(({ track }) => SELECTED_RACES.length === 0 || SELECTED_RACES.includes(track))
      const early: Record<string, string> = {}
      const reports: string[] = []

      // Act
      for (const { track, isMirrored, frameCount } of runs) {
        const scenario = getScenario(track, isMirrored, frameCount)
        const result = await runGoldenTrace(scenario, jam, executable)
        const { divergenceByField } = result.comparison
        const physics = divergenceByField.filter((divergence) =>
          getIsPhysicsField(divergence.field)
        )
        const random = divergenceByField.filter(
          (divergence) => divergence.field === RANDOM_POSITION_FIELD
        )
        const cutoff = Math.min(getFirstFrame(physics), getFirstFrame(random))
        const differing = divergenceByField.filter(
          (divergence) =>
            getIsTrackField(divergence.field) && divergence.field !== RANDOM_POSITION_FIELD
        )
        early[scenario.name] = differing
          .filter((divergence) => divergence.frame < cutoff)
          .map((divergence) => formatDivergence(divergence))
          .join('\n')
        reports.push(
          `${scenario.name}: ${String(result.comparison.frameCount)} frames, judged up to frame ${String(cutoff)}`,
          ...differing.map((divergence) => `  ${formatDivergence(divergence)}`)
        )
      }

      // Assert
      const expected = Object.fromEntries(Object.keys(early).map((name) => [name, '']))
      expect(early, reports.join('\n')).toEqual(expected)
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

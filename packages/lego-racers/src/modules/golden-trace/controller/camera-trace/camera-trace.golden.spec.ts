import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
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
import { getFloatFromBits } from '../../../../shared/emulator/float-bits.ts'
import type {
  FieldDivergence,
  GoldenTraceScenario,
  TraceFrame,
  TraceFrameInput,
} from '../../types/golden-trace.types.ts'
import { compareTraces } from '../compare-traces/compare-traces.ts'
import { formatDivergence } from '../run-golden-trace/run-golden-trace.ts'
import { getIdleFrames, holdBindings } from '../trace-scenarios/trace-scenarios.ts'
import { CAMERA_TRACE_FIELDS, getPortCameraTrace } from './camera-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 3_600_000
const DEMONSTRATION_FRAME_COUNT = Number(process.env['CAMERA_TRACE_DEMONSTRATION_FRAMES'] ?? 700)
const FINISH_FRAME_COUNT = Number(process.env['CAMERA_TRACE_FINISH_FRAMES'] ?? 9000)
const SELECTED_RACES = (process.env['CAMERA_TRACE_RACES'] ?? '').split(',').filter(Boolean)
const SELECTED_MODES = (process.env['CAMERA_TRACE_MODES'] ?? '').split(',').filter(Boolean)
const MIRRORING = process.env['CAMERA_TRACE_MIRRORING'] ?? 'both'
const REPORT_PATH = process.env['CAMERA_TRACE_REPORT'] ?? ''
const DUMP_FRAMES = (process.env['CAMERA_TRACE_DUMP_FRAMES'] ?? '')
  .split(',')
  .filter(Boolean)
  .map(Number)

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
const TRACKS = Object.keys(RACE_CIRCUITS)
// LEGORACE.RCB lists no mirrored pass of the final race, but the settings flag (+0x3c) mirrors it all the same.
const MIRRORED_TRACKS = TRACKS

// The player drives past the start, cycles through the four cameras (binding 5) and looks behind (binding 8).
const getPlayerFrames = (): readonly TraceFrameInput[] => {
  const drive = [RaceBinding.ACCELERATE]
  const cycle = Array.from({ length: 4 }, () => [
    ...holdBindings(1, [...drive, RaceBinding.CHANGE_CAMERA]),
    ...holdBindings(40, [...drive, RaceBinding.STEER_POSITIVE]),
    ...holdBindings(20, drive),
  ]).flat()
  return [
    ...getIdleFrames(175),
    ...holdBindings(60, drive),
    ...cycle,
    ...holdBindings(40, [...drive, RaceBinding.LOOK_BEHIND]),
    ...holdBindings(30, drive),
  ]
}

type ModeSpecification = {
  readonly localPlayerCount: number
  readonly getFrames: () => readonly TraceFrameInput[]
}

const MODES: Readonly<Record<string, ModeSpecification>> = {
  demonstration: {
    localPlayerCount: 0,
    getFrames: () => getIdleFrames(DEMONSTRATION_FRAME_COUNT),
  },
  player: { localPlayerCount: 1, getFrames: getPlayerFrames },
  // A whole demonstration race: the player's racer finishes and the finish camera takes over.
  finish: { localPlayerCount: 0, getFrames: () => getIdleFrames(FINISH_FRAME_COUNT) },
}

const getScenario = (
  raceFolder: string,
  isMirrored: boolean,
  mode: string
): GoldenTraceScenario => {
  const archive = openJamArchive(readOriginalJam())
  const racerCodes = getCircuitRacerCodes(archive.readFile, raceFolder)
  const modeSpecification = MODES[mode]
  if (modeSpecification === undefined) throw new RangeError(`Unknown camera mode ${mode}`)
  return {
    name: `${raceFolder.toLowerCase()}${isMirrored ? '-mirrored' : ''}-${mode}`,
    raceFolder,
    racerCodes,
    racerCount: Math.min(6, racerCodes.length),
    localPlayerCount: modeSpecification.localPlayerCount,
    randomPosition: 0,
    isMirrored,
    circuitName: RACE_CIRCUITS[raceFolder] ?? 'c1',
    precision: 'auto',
    frames: modeSpecification.getFrames(),
    powerUpGrants: [],
    isCameraOnly: true,
  }
}

// The frames the original's camera changes mode in, as "mode@frame".
const getModeTimeline = (frames: readonly TraceFrame[]): string =>
  frames
    .flatMap((frame, index) => {
      const mode = frame.fields['camera0.mode']?.[0]
      const previous = frames[index - 1]?.fields['camera0.mode']?.[0]
      return mode !== previous ? [`${String(mode)}@${String(index)}`] : []
    })
    .join(' ')

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

describe('race cameras: the original and the port, frame for frame', () => {
  it.skipIf(!getIsGamePresent())(
    'reports every camera field that differs',
    async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const runs = [
        ...(MIRRORING === 'mirrored' ? [] : TRACKS.map((track) => ({ track, isMirrored: false }))),
        ...(MIRRORING === 'forward'
          ? []
          : MIRRORED_TRACKS.map((track) => ({ track, isMirrored: true }))),
      ].filter(({ track }) => SELECTED_RACES.length === 0 || SELECTED_RACES.includes(track))
      const modes = Object.keys(MODES).filter(
        (mode) => SELECTED_MODES.length === 0 || SELECTED_MODES.includes(mode)
      )
      const report: Record<string, readonly FieldDivergence[]> = {}
      const timelines: Record<string, string> = {}

      // Act
      for (const { track, isMirrored } of runs) {
        for (const mode of modes) {
          const scenario = getScenario(track, isMirrored, mode)
          const original = await readOriginalTrace(scenario)
          const definition = loadRaceDefinition(jam, executable, {
            raceFolder: scenario.raceFolder,
            racerCodes: scenario.racerCodes,
            racerCount: scenario.racerCount,
            localPlayerCount: scenario.localPlayerCount,
            randomPosition: 0,
            isMirrored,
            fpuPrecision: FpuPrecision.SINGLE,
            isPlayerChampionCar: true,
            musicTuneCount: 0,
          })
          const port = getPortCameraTrace(scenario, definition)
          if (DUMP_FRAMES.length > 0 && REPORT_PATH !== '') {
            const pick = (frames: readonly TraceFrame[]) =>
              DUMP_FRAMES.map((frame) => ({
                frame,
                fields: Object.fromEntries(
                  Object.entries(frames[frame]?.fields ?? {}).map(([name, words]) => [
                    name,
                    words.map((word) => getFloatFromBits(word)),
                  ])
                ),
              }))
            writeFileSync(
              `${REPORT_PATH}.${scenario.name}.json`,
              JSON.stringify({ original: pick(original.frames), port: pick(port) }, null, 1)
            )
          }
          timelines[scenario.name] = getModeTimeline(original.frames)
          report[scenario.name] = compareTraces(
            original.frames,
            port,
            CAMERA_TRACE_FIELDS
          ).divergenceByField
        }
      }

      // Assert
      const lines = Object.entries(report).flatMap(([name, divergences]) => [
        `${name}: ${divergences.length === 0 ? 'match' : `${String(divergences.length)} fields differ`}`,
        `  camera modes (mode@frame): ${timelines[name] ?? ''}`,
        ...divergences.map((divergence) => `  ${formatDivergence(divergence)}`),
      ])
      if (REPORT_PATH !== '') {
        mkdirSync(dirname(REPORT_PATH), { recursive: true })
        writeFileSync(REPORT_PATH, lines.join('\n'))
      }
      expect(Object.keys(report).length).toBeGreaterThan(0)
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

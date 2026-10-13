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
// The longest introduction (141 frames of 33 ms) and its 2,000 ms ease into the chase camera, then the countdown.
const DEMONSTRATION_FRAME_COUNT = 260
// A whole demonstration race: the player's racer finishes (frame 4,217 on RACEC1R0) and the finish camera takes over.
const FINISH_FRAME_COUNT = Number(process.env['CAMERA_TRACE_FINISH_FRAMES'] ?? 4500)
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

// The player drives past the start, cycles through the four cameras (binding 5: the chase rows 1 and 2, the cockpit, the
// chase row 0 again) and looks behind (binding 8).
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

// The demonstration (the attract mode: computers drive, the camera follows racer 0) covers the introduction fly-by, the
// countdown and the chase camera; the player covers every chase row, the cockpit and the look behind; the finish runs a
// whole demonstration race.
const MODES: Readonly<Record<string, ModeSpecification>> = {
  demonstration: {
    localPlayerCount: 0,
    getFrames: () => getIdleFrames(DEMONSTRATION_FRAME_COUNT),
  },
  player: { localPlayerCount: 1, getFrames: getPlayerFrames },
  finish: { localPlayerCount: 0, getFrames: () => getIdleFrames(FINISH_FRAME_COUNT) },
}
const DEFAULT_MODES = ['demonstration', 'player']

// Camera differences not traced to their cause yet, by scenario name.
const KNOWN_CAMERA_DIVERGENCES: Readonly<Record<string, string>> = Object.freeze({
  // The node orientation of the introduction clip is one unit in the last place off in places (position matches), and the
  // basis eased from it after the release: the original mirrors the animation keys (0x004015e0, 0x0040ea20), the port flips y
  // of the finished vectors.
  'racec0r0-mirrored-demonstration': 'camera0.basis,camera0.node.orientation',
  'racec0r0-mirrored-player': 'camera0.basis,camera0.node.orientation',
})

// What the camera reads from its racer: when the port's racer differs, the camera is judged only before that frame.
const RACER_FIELD = 'camera0.racer'

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

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

// The frames the original's camera changes mode in, as "mode@frame".
const getModeTimeline = (frames: readonly TraceFrame[]): string =>
  frames
    .flatMap((frame, index) => {
      const mode = frame.fields['camera0.mode']?.[0]
      const previous = frames[index - 1]?.fields['camera0.mode']?.[0]
      return mode !== previous ? [`${String(mode)}@${String(index)}`] : []
    })
    .join(' ')

const getFirstFrame = (divergences: readonly FieldDivergence[]): number =>
  divergences.reduce((first, divergence) => Math.min(first, divergence.frame), Infinity)

type CameraRun = { readonly track: string; readonly isMirrored: boolean }

// Runs the original and the port through each run in each mode and compares the cameras; the result maps each scenario to
// the camera fields that differ before the racer does (empty: a match), with a report for the failure message.
const judgeCameras = async (runs: readonly CameraRun[], modes: readonly string[]) => {
  const jam = readOriginalJam()
  const executable = readOriginalExecutable()
  const reports: string[] = []
  const early: Record<string, string> = {}
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
          DUMP_FRAMES.map((frame) => ({ frame, fields: frames[frame]?.fields ?? {} }))
        writeFileSync(
          `${REPORT_PATH}.${scenario.name}.json`,
          JSON.stringify({ original: pick(original.frames), port: pick(port) }, null, 1)
        )
      }
      const { divergenceByField } = compareTraces(original.frames, port, CAMERA_TRACE_FIELDS)
      const cutoff = getFirstFrame(
        divergenceByField.filter((divergence) => divergence.field === RACER_FIELD)
      )
      const differing = divergenceByField.filter(
        (divergence) => divergence.field !== RACER_FIELD && divergence.frame < cutoff
      )
      early[scenario.name] = [...new Set(differing.map((divergence) => divergence.field))]
        .sort()
        .join(',')
      reports.push(
        `${scenario.name}: ${differing.length === 0 ? 'match' : `${String(differing.length)} fields differ`}, judged up to frame ${String(Math.min(cutoff, original.frames.length))}`,
        `  camera modes (mode@frame): ${getModeTimeline(original.frames)}`,
        ...differing.map((divergence) => `  ${formatDivergence(divergence)}`)
      )
    }
  }
  if (REPORT_PATH !== '') {
    mkdirSync(dirname(REPORT_PATH), { recursive: true })
    writeFileSync(REPORT_PATH, reports.join('\n'))
  }
  const expected = Object.fromEntries(
    Object.keys(early).map((name) => [name, KNOWN_CAMERA_DIVERGENCES[name] ?? ''])
  )
  return { early, expected, report: reports.join('\n') }
}

describe('race cameras: the original and the port, frame for frame', () => {
  it.skipIf(!getIsGamePresent())(
    'matches the original in every camera field of every race until the racer it follows differs',
    async () => {
      // Arrange
      const runs = [
        ...(MIRRORING === 'mirrored' ? [] : TRACKS.map((track) => ({ track, isMirrored: false }))),
        ...(MIRRORING === 'forward'
          ? []
          : MIRRORED_TRACKS.map((track) => ({ track, isMirrored: true }))),
      ].filter(({ track }) => SELECTED_RACES.length === 0 || SELECTED_RACES.includes(track))
      const modes = (SELECTED_MODES.length === 0 ? DEFAULT_MODES : SELECTED_MODES).filter(
        (mode) => mode in MODES
      )

      // Act
      const { early, expected, report } = await judgeCameras(runs, modes)

      // Assert
      expect(early, report).toEqual(expected)
    },
    TRACE_TIMEOUT_MILLISECONDS
  )

  it.skipIf(!getIsGamePresent() || SELECTED_MODES.length > 0)(
    'matches the original in the finish camera of a whole demonstration race',
    async () => {
      // Arrange
      const runs = [{ track: 'RACEC1R0', isMirrored: false }]

      // Act
      const { early, expected, report } = await judgeCameras(runs, ['finish'])

      // Assert
      expect(early, report).toEqual(expected)
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

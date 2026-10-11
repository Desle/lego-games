import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import {
  EMULATOR_DIRECTORY,
  EMULATOR_PYTHON_PATH,
  GAME_FILES_DIRECTORY,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  GoldenTraceScenario,
  OriginalTrace,
  TraceFrame,
} from '../../types/golden-trace.types.ts'
import type { TraceLine } from './original-trace.types.ts'

const TRACE_SCRIPT_PATH = resolve(EMULATOR_DIRECTORY, 'golden_trace.py')

export const getIsOriginalTraceAvailable = (): boolean =>
  existsSync(EMULATOR_PYTHON_PATH) &&
  existsSync(resolve(GAME_FILES_DIRECTORY, 'LEGORacers.exe')) &&
  existsSync(resolve(GAME_FILES_DIRECTORY, 'GolDP.dll')) &&
  existsSync(resolve(GAME_FILES_DIRECTORY, 'LEGO.JAM'))

const getScenarioForEmulator = (scenario: GoldenTraceScenario) => ({
  raceFolder: scenario.raceFolder,
  racerCodes: scenario.racerCodes,
  racerCount: scenario.racerCount,
  localPlayerCount: scenario.localPlayerCount,
  randomPosition: scenario.randomPosition,
  isMirrored: scenario.isMirrored ?? false,
  circuit: scenario.circuit ?? 'c1',
  fpu: scenario.precision,
  frames: scenario.frames.map((frame) => ({ dt: frame.milliseconds, keys: frame.scanCodes })),
})

// Runs the original race in the emulator (reverse-engineering/emulator/golden_trace.py) and collects every frame.
export const readOriginalTrace = async (scenario: GoldenTraceScenario): Promise<OriginalTrace> => {
  const child = spawn(EMULATOR_PYTHON_PATH, ['-I', TRACE_SCRIPT_PATH], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  child.stdin.end(JSON.stringify(getScenarioForEmulator(scenario)))
  const frames: TraceFrame[] = []
  const progress = { isDone: false, controlWord: 0, introductionCameraLimit: -1 }
  const lines = createInterface({ input: child.stdout })
  lines.on('line', (text) => {
    const line = JSON.parse(text) as TraceLine
    if (line.isDone === true) {
      progress.isDone = true
      progress.controlWord = line.controlWord ?? 0
      progress.introductionCameraLimit = line.introductionCameraLimit ?? -1
    }
    if (line.frame !== undefined && line.dt !== undefined && line.fields !== undefined) {
      frames.push({ frame: line.frame, milliseconds: line.dt, fields: line.fields })
    }
  })
  const exitCode = await new Promise<number | null>((resolveExit) =>
    child.once('exit', (code) => resolveExit(code))
  )
  if (!progress.isDone || exitCode !== 0) {
    throw new Error(`The original trace failed (exit ${String(exitCode)}); see the emulator output`)
  }
  return {
    frames,
    controlWord: progress.controlWord,
    introductionCameraLimit: progress.introductionCameraLimit,
  }
}

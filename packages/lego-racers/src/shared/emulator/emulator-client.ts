import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import type {
  BridgeResponse,
  EmulatorCall,
  EmulatorCallResult,
  EmulatorSession,
} from './emulator-client.types.ts'

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../../../../..')
const EMULATOR_DIRECTORY = resolve(REPOSITORY_ROOT, 'reverse-engineering/emulator')
const EMULATOR_PYTHON_PATH = resolve(EMULATOR_DIRECTORY, '.venv/bin/python')
const EMULATOR_BRIDGE_PATH = resolve(EMULATOR_DIRECTORY, 'bridge.py')
const GAME_FILES_DIRECTORY = resolve(
  REPOSITORY_ROOT,
  'original-files/Lego_Racers_Win_Files_EN/Game Files'
)

// The differential suites skip unless the virtualenv and both original binaries exist.
export const getIsEmulatorAvailable = (): boolean =>
  existsSync(EMULATOR_PYTHON_PATH) &&
  existsSync(resolve(GAME_FILES_DIRECTORY, 'LEGORacers.exe')) &&
  existsSync(resolve(GAME_FILES_DIRECTORY, 'GolDP.dll'))

export const openEmulatorSession = (): EmulatorSession => {
  const bridge = spawn(EMULATOR_PYTHON_PATH, ['-I', EMULATOR_BRIDGE_PATH], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const lines = createInterface({ input: bridge.stdout })[Symbol.asyncIterator]()
  let nextRequestId = 1

  const callBatch = async (
    calls: readonly EmulatorCall[]
  ): Promise<readonly EmulatorCallResult[]> => {
    const requestId = nextRequestId
    nextRequestId += 1
    const request = { id: requestId, op: 'batch', calls }
    bridge.stdin.write(`${JSON.stringify(request)}\n`)
    const line = await lines.next()
    if (line.done === true) throw new Error('The emulator bridge exited unexpectedly')
    const response = JSON.parse(line.value) as BridgeResponse
    if (response.error !== undefined) throw new Error(`Emulator bridge: ${response.error}`)
    return response.results ?? []
  }

  const close = async (): Promise<void> => {
    const exited = new Promise<void>((resolveExit) => bridge.once('exit', () => resolveExit()))
    bridge.stdin.end()
    await exited
  }

  return { callBatch, close }
}

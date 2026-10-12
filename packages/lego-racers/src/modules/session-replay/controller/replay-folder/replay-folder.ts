import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { REPOSITORY_ROOT } from '../../../../shared/emulator/emulator-client.ts'
import type { ReplayReport } from '../run-replay/run-replay.types.ts'
import type { ReplayExpectation, StoredReplay } from './replay-folder.types.ts'

export const REPLAYS_DIRECTORY = resolve(REPOSITORY_ROOT, 'reverse-engineering/replays')
const RECORDING_SUFFIX = '.replay.jsonl'
const EXPECTATION_SUFFIX = '.expected.json'

// What a permanent test pins: how many frames the original was fed and where the first divergence is (null: none).
export const getExpectationOfReport = (report: ReplayReport): ReplayExpectation => {
  const divergence = report.original?.firstDivergence ?? null
  return {
    comparedFrameCount: report.original?.comparedFrameCount ?? 0,
    firstDivergence:
      divergence === null ? null : { frame: divergence.frame, field: divergence.field },
  }
}

// The recordings committed in reverse-engineering/replays/, each with the expectation beside it.
export const readStoredReplays = (): readonly StoredReplay[] =>
  existsSync(REPLAYS_DIRECTORY)
    ? readdirSync(REPLAYS_DIRECTORY)
        .filter((name) => name.endsWith(RECORDING_SUFFIX))
        .sort()
        .map((name) => {
          const expectationPath = resolve(
            REPLAYS_DIRECTORY,
            name.replace(RECORDING_SUFFIX, EXPECTATION_SUFFIX)
          )
          return {
            name,
            text: readFileSync(resolve(REPLAYS_DIRECTORY, name), 'utf8'),
            expectation: JSON.parse(readFileSync(expectationPath, 'utf8')) as ReplayExpectation,
          }
        })
    : []

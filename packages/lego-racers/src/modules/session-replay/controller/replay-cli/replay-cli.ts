import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { formatDivergence } from '../../../golden-trace/index.ts'
import { parseRecording } from '../replay-format/replay-format.ts'
import { getExpectationOfReport } from '../replay-folder/replay-folder.ts'
import { runReplay } from '../run-replay/run-replay.ts'

const WRITE_EXPECTATION_FLAG = '--write-expectation'

// `pnpm run replay <file> [--write-expectation]`: feeds a recorded session to the port and to the original in the
// emulator, and prints the first divergence (frame, field, both values).
const main = async (): Promise<number> => {
  const commandArguments = process.argv.slice(2)
  const file = commandArguments.find((argument) => !argument.startsWith('--'))
  if (file === undefined) {
    process.stderr.write('Usage: pnpm run replay <recording.replay.jsonl> [--write-expectation]\n')
    return 1
  }
  if (!getIsOriginalJamPresent() || !getIsOriginalExecutablePresent()) {
    process.stderr.write('LEGO.JAM and LEGORacers.exe are needed in original-files/\n')
    return 1
  }
  const path = resolve(process.cwd(), file)
  const recording = parseRecording(readFileSync(path, 'utf8'))
  const report = await runReplay(
    recording,
    readOriginalJam(),
    readOriginalExecutable(),
    basename(path)
  )
  process.stdout.write(
    `${String(report.frameCount)} frames on ${recording.header.raceFolder}; the port ends in ${report.portPhase} ` +
      `(random cursor ${String(report.portRandomPosition)})\n`
  )
  if (report.original === null) {
    process.stdout.write(`The original was not run: ${report.originalSkipReason ?? ''}\n`)
    return 0
  }
  const { original } = report
  process.stdout.write(
    `Original: ${String(original.comparedFrameCount)} frames fed` +
      (original.stopReason === null ? '' : ` (then ${original.stopReason})`) +
      '\n'
  )
  process.stdout.write(
    original.firstDivergence === null
      ? 'No divergence: the port matches the original bit for bit.\n'
      : `First divergence: ${formatDivergence(original.firstDivergence)}\n`
  )
  if (commandArguments.includes(WRITE_EXPECTATION_FLAG)) {
    const expectationPath = path.replace(/\.replay\.jsonl$/, '.expected.json')
    writeFileSync(expectationPath, `${JSON.stringify(getExpectationOfReport(report))}\n`)
    process.stdout.write(`Wrote ${expectationPath}\n`)
  }
  return 0
}

process.exitCode = await main()

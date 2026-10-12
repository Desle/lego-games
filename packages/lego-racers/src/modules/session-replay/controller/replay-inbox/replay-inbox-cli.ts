import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { parseRecording } from '../../../session-recording/index.ts'
import { formatReplayReportLine, getRemasteredNote } from '../replay-report/replay-report.ts'
import { runReplay } from '../run-replay/run-replay.ts'
import { moveToProcessed, readInboxFileNames, REPLAY_INBOX_DIRECTORY } from './replay-inbox.ts'

const KEEP_FLAG = '--keep'

// `pnpm run replay:inbox [--keep]`: replays every recording the dev viewer posted to the inbox against the original in the
// emulator and the port, prints one line per file, and moves the processed files to inbox/processed/ (unless --keep).
const main = async (): Promise<number> => {
  const isKept = process.argv.slice(2).includes(KEEP_FLAG)
  if (!getIsOriginalJamPresent() || !getIsOriginalExecutablePresent()) {
    process.stderr.write('LEGO.JAM and LEGORacers.exe are needed in original-files/\n')
    return 1
  }
  const names = readInboxFileNames()
  if (names.length === 0) {
    process.stdout.write(`The inbox is empty (${REPLAY_INBOX_DIRECTORY})\n`)
    return 0
  }
  const jam = readOriginalJam()
  const executable = readOriginalExecutable()
  for (const name of names) {
    try {
      const recording = parseRecording(readFileSync(resolve(REPLAY_INBOX_DIRECTORY, name), 'utf8'))
      const report = await runReplay(recording, jam, executable, name)
      process.stdout.write(
        `${formatReplayReportLine(name, report, getRemasteredNote(recording.header))}\n`
      )
      if (!isKept) moveToProcessed(name)
    } catch (error) {
      process.stdout.write(
        `${name}: failed, left in the inbox (${error instanceof Error ? error.message : String(error)})\n`
      )
    }
  }
  return 0
}

process.exitCode = await main()

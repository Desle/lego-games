import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { REPLAYS_DIRECTORY } from '../replay-folder/replay-folder.ts'

export const REPLAY_INBOX_DIRECTORY = resolve(REPLAYS_DIRECTORY, 'inbox')
const PROCESSED_DIRECTORY_NAME = 'processed'
const RECORDING_SUFFIX = '.replay.jsonl'

// The recordings the dev viewer posted and nobody has replayed yet, oldest name first.
export const readInboxFileNames = (
  directory: string = REPLAY_INBOX_DIRECTORY
): readonly string[] =>
  existsSync(directory)
    ? readdirSync(directory)
        .filter((name) => name.endsWith(RECORDING_SUFFIX))
        .sort()
    : []

export const moveToProcessed = (name: string, directory: string = REPLAY_INBOX_DIRECTORY): void => {
  const processedDirectory = resolve(directory, PROCESSED_DIRECTORY_NAME)
  mkdirSync(processedDirectory, { recursive: true })
  renameSync(resolve(directory, name), resolve(processedDirectory, name))
}

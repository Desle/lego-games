import { spawnSync } from 'node:child_process'

const FFMPEG_COMMAND = 'ffmpeg'
const MAXIMUM_ERROR_LENGTH = 400

export const getIsFfmpegAvailable = (): boolean =>
  spawnSync(FFMPEG_COMMAND, ['-version'], { stdio: 'ignore' }).status === 0

// Runs ffmpeg quietly; returns null on success, else the tail of its error output.
export const runFfmpeg = (commandArguments: readonly string[]): string | null => {
  const result = spawnSync(FFMPEG_COMMAND, ['-y', '-v', 'error', '-nostdin', ...commandArguments], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  })
  if (result.status === 0) return null
  return (result.stderr || String(result.error)).trim().slice(-MAXIMUM_ERROR_LENGTH)
}

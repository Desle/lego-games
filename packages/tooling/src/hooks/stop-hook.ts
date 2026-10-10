import { spawnSync } from 'node:child_process'
import { loadConfig } from '../config/load-config.ts'
import { getHasUncommittedChanges, getIsGitRepository } from '../project/git.ts'
import { readHookInput } from './read-hook-input.ts'

const MAXIMUM_REPORTED_LINES = 120

/** Claude Code Stop: refuse to finish while the fast gate is red; exit code 2 makes Claude keep working. */
export const runStopHook = async (root: string): Promise<number> => {
  const isAlreadyContinuing = readHookInput()['stop_hook_active'] === true
  if (isAlreadyContinuing) return 0
  if (getIsGitRepository(root) && !getHasUncommittedChanges(root)) return 0
  const config = await loadConfig(root)
  const check = spawnSync(config.checkCommand, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (check.status === 0) return 0
  const output = `${check.stdout}${check.stderr}`
    .trim()
    .split('\n')
    .slice(-MAXIMUM_REPORTED_LINES)
    .join('\n')
  process.stderr.write(
    `The work is not done yet.\n\n\`${config.checkCommand}\` fails:\n${output}\n`
  )
  return 2
}

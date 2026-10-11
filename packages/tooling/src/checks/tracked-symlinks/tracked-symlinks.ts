import { getIsGitRepository, runGit } from '../../project/git.ts'
import { CheckId, type Check, type CheckContext, type Violation } from '../check.types.ts'

const SYMLINK_MODE = '120000'

// `git ls-files -s` prints `<mode> <object> <stage>\t<path>` per tracked file.
export const getTrackedSymlinkPaths = (stagedFiles: string): readonly string[] =>
  stagedFiles
    .split('\n')
    .filter((line) => line.startsWith(`${SYMLINK_MODE} `))
    .map((line) => line.slice(line.indexOf('\t') + 1))

const runTrackedSymlinks = (context: CheckContext): Promise<readonly Violation[]> => {
  if (!getIsGitRepository(context.root)) return Promise.resolve([])
  const stagedFiles = runGit(context.root, ['ls-files', '-s']).stdout
  return Promise.resolve(
    getTrackedSymlinkPaths(stagedFiles).map((path) => ({
      path,
      line: null,
      message: 'a symlink is committed; checking it out replaces the local folder it shadows',
    }))
  )
}

export const trackedSymlinksCheck: Check = {
  id: CheckId.TRACKED_SYMLINKS,
  description: 'No symlink is committed (local links such as original-files must stay untracked).',
  fix: 'Run `git rm --cached <path>` and make the .gitignore entry match it without a trailing slash.',
  run: runTrackedSymlinks,
}

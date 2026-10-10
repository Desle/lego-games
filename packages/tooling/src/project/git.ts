import { spawnSync } from 'node:child_process'

export const runGit = (root: string, parameters: readonly string[]) =>
  spawnSync('git', parameters, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

export const getIsGitRepository = (root: string): boolean =>
  runGit(root, ['rev-parse', '--is-inside-work-tree']).stdout.trim() === 'true'

export const getIsShallowClone = (root: string): boolean =>
  runGit(root, ['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true'

export const getIsTracked = (root: string, path: string): boolean =>
  runGit(root, ['ls-files', '--error-unmatch', '--', path]).status === 0

export const getHasUncommittedChanges = (root: string): boolean =>
  runGit(root, ['status', '--porcelain']).stdout.trim() !== ''

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { ProjectKind, type WorkspacePackage, type WorkspacePatterns } from './workspace.types.ts'
import type { PackageManifest } from '../package-manifest.types.ts'

export const WORKSPACE_FILE = 'pnpm-workspace.yaml'
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git'])
const LIST_ITEM = /^\s+-\s+(['"]?)(.+?)\1\s*(?:#.*)?$/

/** The `packages:` list of pnpm-workspace.yaml; null when the file declares no packages. */
export const parseWorkspacePatterns = (content: string): WorkspacePatterns | null => {
  const lines = content.split(/\r?\n/)
  const start = lines.findIndex((line) => /^packages:\s*(?:#.*)?$/.test(line))
  if (start === -1) return null
  const patterns: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    const item = LIST_ITEM.exec(line)
    if (item === null) break
    patterns.push(item[2] ?? '')
  }
  if (patterns.length === 0) return null
  const toFolder = (pattern: string) => pattern.replace(/^\.\//, '').replace(/\/$/, '')
  return {
    included: patterns.filter((pattern) => !pattern.startsWith('!')).map(toFolder),
    excluded: patterns
      .filter((pattern) => pattern.startsWith('!'))
      .map((pattern) => toFolder(pattern.slice(1))),
  }
}

const toPattern = (glob: string): RegExp =>
  new RegExp(
    `^${glob
      .split('/')
      .map((segment) =>
        segment === '**'
          ? '.*'
          : segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*')
      )
      .join('/')}$`
  )

/** Whether a folder (relative to the workspace root) is one of the workspace's packages. */
export const getIsWorkspaceFolder = (patterns: WorkspacePatterns, folder: string): boolean =>
  patterns.included.some((glob) => toPattern(glob).test(folder)) &&
  !patterns.excluded.some((glob) => toPattern(glob).test(folder))

const listFolders = (root: string, directory: string): readonly string[] =>
  readdirSync(join(root, directory), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name))
    .flatMap((entry) => {
      const folder = directory === '' ? entry.name : `${directory}/${entry.name}`
      return [folder, ...listFolders(root, folder)]
    })

export const readWorkspacePatterns = (root: string): WorkspacePatterns | null => {
  const path = join(root, WORKSPACE_FILE)
  return existsSync(path) ? parseWorkspacePatterns(readFileSync(path, 'utf8')) : null
}

const readPackage = (root: string, path: string): WorkspacePackage => {
  const manifest = JSON.parse(
    readFileSync(join(root, path, 'package.json'), 'utf8')
  ) as PackageManifest
  return { path, name: manifest.name ?? path, description: manifest.description ?? '' }
}

/** The workspace's packages, or null when the root is not a workspace root. */
export const listWorkspacePackages = (root: string): readonly WorkspacePackage[] | null => {
  const patterns = readWorkspacePatterns(root)
  if (patterns === null) return null
  return listFolders(root, '')
    .filter((folder) => getIsWorkspaceFolder(patterns, folder))
    .filter((folder) => existsSync(join(root, folder, 'package.json')))
    .sort()
    .map((folder) => readPackage(root, folder))
}

/** The workspace root above a folder that is one of its packages, or null. */
export const findWorkspaceRoot = (directory: string): string | null => {
  let candidate = dirname(directory)
  while (candidate !== dirname(candidate)) {
    const patterns = readWorkspacePatterns(candidate)
    if (patterns !== null) {
      const folder = relative(candidate, directory).split(sep).join('/')
      return getIsWorkspaceFolder(patterns, folder) ? candidate : null
    }
    candidate = dirname(candidate)
  }
  return null
}

export const getProjectKind = (root: string): ProjectKind => {
  if (listWorkspacePackages(root) !== null) return ProjectKind.WORKSPACE_ROOT
  if (findWorkspaceRoot(root) !== null) return ProjectKind.WORKSPACE_PACKAGE
  return ProjectKind.SINGLE
}

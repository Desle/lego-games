import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git'])

export const toProjectPath = (root: string, absolutePath: string): string =>
  relative(root, absolutePath).split(sep).join('/')

export const listProjectFiles = (root: string, directory: string): readonly string[] => {
  const absoluteDirectory = join(root, directory)
  if (!existsSync(absoluteDirectory)) return []
  return readdirSync(absoluteDirectory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => toProjectPath(root, join(entry.parentPath, entry.name)))
    .filter((path) => !path.split('/').some((segment) => SKIPPED_DIRECTORIES.has(segment)))
    .sort()
}

export const readProjectFile = (root: string, path: string): string =>
  readFileSync(join(root, path), 'utf8')

export const readOptionalProjectFile = (root: string, path: string): string | null =>
  existsSync(join(root, path)) ? readProjectFile(root, path) : null

export const getHasExtension = (path: string, extensions: readonly string[]): boolean =>
  extensions.some((extension) => path.endsWith(extension))

export const getIsTestFile = (path: string): boolean => /\.(spec|test)\.[cm]?[jt]sx?$/.test(path)

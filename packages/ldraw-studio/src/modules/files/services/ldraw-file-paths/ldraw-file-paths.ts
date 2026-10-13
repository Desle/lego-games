import { existsSync, statSync } from 'node:fs'
import { isAbsolute, resolve, sep } from 'node:path'

const PARENT_FOLDER = '..'
const WINDOWS_ROOT = /^([A-Za-z]:|\\)/

// The path relative to a root with `/` between folders, or null when it is empty, absolute or climbs out of the root by `..`.
export const getSafeRelativePath = (requested: string): string | null => {
  if (requested.includes('\0') || isAbsolute(requested) || WINDOWS_ROOT.test(requested)) {
    return null
  }
  const segments = requested.split(/[/\\]/)
  if (segments.includes(PARENT_FOLDER)) return null
  const relative = segments.filter((segment) => segment !== '' && segment !== '.').join('/')
  return relative === '' ? null : relative
}

// The file at the relative path under the root, or null when the path is not safe or names no file.
export const getFileUnder = (root: string, requested: string): string | null => {
  const relative = getSafeRelativePath(requested)
  if (relative === null) return null
  const resolvedRoot = resolve(root)
  const path = resolve(resolvedRoot, relative)
  return path.startsWith(resolvedRoot + sep) && existsSync(path) && statSync(path).isFile()
    ? path
    : null
}

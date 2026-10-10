import { ScenePathError } from '../scene-errors/scene-errors.ts'

const PATH_SEPARATOR = '\\'
const MAXIMUM_PATH_LENGTH = 0xff

// GolDP.dll 0x10030070: a name with a '.' gets its extension replaced by the reader's default one; without, it is appended.
export const getNameWithDefaultExtension = (name: string, defaultExtension: string): string => {
  const extensionStart = name.lastIndexOf('.')
  return extensionStart < 0
    ? name + defaultExtension
    : name.slice(0, extensionStart) + defaultExtension
}

// GolDP.dll 0x10018ca0 / 0x1002a500: an image name gets ".bmp" / ".tga" appended unless it already ends with it.
export const getNameWithImageExtension = (name: string, extension: string): string =>
  name.length > extension.length && name.endsWith(extension) ? name : name + extension

const getUppercased = (path: string): string =>
  path.replace(/[a-z]/g, (letter) => letter.toUpperCase())

// GolDP.dll 0x10031c90 (LEGORacers.exe 0x0044d190), with the JAM archive registered: a relative name is
// joined to the archive's current directory and the whole path uppercased.
export const getArchivePath = (currentDirectory: string, name: string): string => {
  if (name.length > MAXIMUM_PATH_LENGTH) throw new ScenePathError(name)
  if (name.startsWith(PATH_SEPARATOR)) return getUppercased(name.slice(1))
  const separator = currentDirectory.endsWith(PATH_SEPARATOR) ? '' : PATH_SEPARATOR
  return getUppercased(currentDirectory === '' ? name : currentDirectory + separator + name)
}

export const getDirectory = (path: string): string => {
  const separatorIndex = path.lastIndexOf(PATH_SEPARATOR)
  return separatorIndex < 0 ? '' : path.slice(0, separatorIndex)
}

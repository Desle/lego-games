import {
  JamArchiveReadError,
  JamLookupError,
} from '../../types/jam-archive-errors/jam-archive-errors.ts'
import type { JamArchive, JamDirectory, JamFileLocation } from '../../types/jam-archive.types.ts'
import {
  assertJamSignature,
  JAM_NAME_LENGTH,
  JAM_ROOT_DIRECTORY_OFFSET,
  readJamDirectory,
} from '../../types/jam-directory/jam-directory.ts'
import { JamLookupFailure } from '../../types/jam-lookup-failure/jam-lookup-failure.ts'

const JAM_PATH_SEPARATOR = '\\'

export const openJamArchive = (bytes: Uint8Array): JamArchive => {
  assertJamSignature(bytes)
  // Directories are parsed on first search, as the original does.
  const loadedDirectories = new Map<number, JamDirectory>()

  const getDirectory = (offset: number): JamDirectory => {
    const loadedDirectory = loadedDirectories.get(offset)
    if (loadedDirectory !== undefined) return loadedDirectory
    const directory = readJamDirectory(bytes, offset)
    loadedDirectories.set(offset, directory)
    return directory
  }

  const findFile = (path: string): JamFileLocation => {
    const segments = path.split(JAM_PATH_SEPARATOR)
    let directoryOffset = JAM_ROOT_DIRECTORY_OFFSET
    for (const [index, segment] of segments.entries()) {
      if (segment.length > JAM_NAME_LENGTH) {
        throw new JamLookupError(JamLookupFailure.NAME_TOO_LONG, path)
      }
      const directory = getDirectory(directoryOffset)
      if (index === segments.length - 1) {
        const file = directory.files.find((entry) => entry.name === segment)
        if (file === undefined) throw new JamLookupError(JamLookupFailure.NOT_FOUND, path)
        return Object.freeze({ offset: file.offset, size: file.size })
      }
      const subdirectory = directory.directories.find((entry) => entry.name === segment)
      if (subdirectory === undefined) throw new JamLookupError(JamLookupFailure.NOT_FOUND, path)
      directoryOffset = subdirectory.offset
    }
    throw new JamLookupError(JamLookupFailure.NOT_FOUND, path)
  }

  const readFile = (path: string): Uint8Array => {
    const location = findFile(path)
    if (location.offset + location.size > bytes.byteLength) throw new JamArchiveReadError()
    return bytes.slice(location.offset, location.offset + location.size)
  }

  const getFilePathsBelow = (directoryOffset: number, prefix: string): readonly string[] => {
    const directory = getDirectory(directoryOffset)
    return [
      ...directory.files.map((file) => prefix + file.name),
      ...directory.directories.flatMap((subdirectory) =>
        getFilePathsBelow(subdirectory.offset, prefix + subdirectory.name + JAM_PATH_SEPARATOR)
      ),
    ]
  }

  const getFilePaths = () => getFilePathsBelow(JAM_ROOT_DIRECTORY_OFFSET, '')

  return Object.freeze({ findFile, readFile, getFilePaths })
}

import { JamArchiveReadError } from '../jam-archive-errors/jam-archive-errors.ts'
import type { JamDirectory, JamDirectoryEntry, JamFileEntry } from '../jam-archive.types.ts'

export const JAM_SIGNATURE = 'LJAM'
export const JAM_ROOT_DIRECTORY_OFFSET = 4
export const JAM_NAME_LENGTH = 12
export const JAM_FILE_ENTRY_LENGTH = 20
export const JAM_DIRECTORY_ENTRY_LENGTH = 16
export const MAXIMUM_JAM_ENTRY_COUNT = 100_000

const readUnsignedInteger = (bytes: Uint8Array, offset: number): number => {
  if (offset < 0 || offset + 4 > bytes.byteLength) throw new JamArchiveReadError()
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true)
}

const readName = (bytes: Uint8Array, offset: number): string => {
  if (offset + JAM_NAME_LENGTH > bytes.byteLength) throw new JamArchiveReadError()
  const characters: string[] = []
  for (let index = 0; index < JAM_NAME_LENGTH; index++) {
    const byte = bytes[offset + index] ?? 0
    if (byte === 0) break
    characters.push(String.fromCharCode(byte))
  }
  return characters.join('')
}

const readEntryCount = (bytes: Uint8Array, offset: number): number => {
  const count = readUnsignedInteger(bytes, offset)
  if (count > MAXIMUM_JAM_ENTRY_COUNT) throw new JamArchiveReadError()
  return count
}

export const assertJamSignature = (bytes: Uint8Array): void => {
  const signature = String.fromCharCode(...bytes.subarray(0, JAM_SIGNATURE.length))
  if (signature !== JAM_SIGNATURE) throw new JamArchiveReadError()
}

export const readJamDirectory = (bytes: Uint8Array, offset: number): JamDirectory => {
  const fileCount = readEntryCount(bytes, offset)
  const files: JamFileEntry[] = []
  let cursor = offset + 4
  for (let index = 0; index < fileCount; index++) {
    files.push(
      Object.freeze({
        name: readName(bytes, cursor),
        offset: readUnsignedInteger(bytes, cursor + JAM_NAME_LENGTH),
        size: readUnsignedInteger(bytes, cursor + JAM_NAME_LENGTH + 4),
      })
    )
    cursor += JAM_FILE_ENTRY_LENGTH
  }

  const directoryCount = readEntryCount(bytes, cursor)
  const directories: JamDirectoryEntry[] = []
  cursor += 4
  for (let index = 0; index < directoryCount; index++) {
    directories.push(
      Object.freeze({
        name: readName(bytes, cursor),
        offset: readUnsignedInteger(bytes, cursor + JAM_NAME_LENGTH),
      })
    )
    cursor += JAM_DIRECTORY_ENTRY_LENGTH
  }

  return Object.freeze({ files: Object.freeze(files), directories: Object.freeze(directories) })
}

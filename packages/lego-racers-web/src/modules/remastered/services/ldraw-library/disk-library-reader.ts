import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLibraryFileReader } from '@lego-games/ldraw/building'
import type { LibraryFileReader } from '@lego-games/ldraw/building'

// The library's files from a folder on disk (`LEGO_LDRAW_ROOT`), for the specs that check the player's own library.
export const createDiskLibraryReader = (libraryRoot: string): LibraryFileReader =>
  createLibraryFileReader((path) => readFile(join(libraryRoot, path), 'utf8').catch(() => null))

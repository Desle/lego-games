import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { JamLookupFailure } from './jam-lookup-failure/jam-lookup-failure.ts'

export type JamFileEntry = {
  readonly name: string
  readonly offset: number
  readonly size: number
}

export type JamDirectoryEntry = {
  readonly name: string
  readonly offset: number
}

export type JamDirectory = {
  readonly files: readonly JamFileEntry[]
  readonly directories: readonly JamDirectoryEntry[]
}

export type JamFileLocation = {
  readonly offset: number
  readonly size: number
}

export type JamLookupFailure = EnumValues<typeof JamLookupFailure>

export type JamArchive = {
  readonly findFile: (path: string) => JamFileLocation
  readonly readFile: (path: string) => Uint8Array
  readonly getFilePaths: () => readonly string[]
}

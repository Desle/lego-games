import { parseCinemaDatabase } from '@lego-games/lego-racers/cinema'
import type { CinemaSource } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'

export const getCinemaFilePath = (source: CinemaSource, extension: string): string =>
  `MENUDATA\\${source.directory}\\${source.fileName}.${extension}`

// The worlds a cinema file names (its keyword 0x28) in its folder, in the order the engine loads them (the second links to the
// first one's materials); a name with no file is left out (the credits name only the emitter world).
export const getCinemaWorldPaths = (
  archive: JamArchive,
  source: CinemaSource
): readonly string[] => {
  const known = new Set(archive.getFilePaths().map((path) => path.toUpperCase()))
  return parseCinemaDatabase(archive.readFile(getCinemaFilePath(source, 'CDB')))
    .worldNames.map((name) => `MENUDATA\\${source.directory}\\${name.toUpperCase()}.WDB`)
    .filter((path) => known.has(path))
}

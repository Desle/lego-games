import { getArchivePath, getNameWithDefaultExtension } from '../scene-path/scene-path.ts'
import type { RaceSkyNames, RaceWorldNames } from './race-world-paths.types.ts'

// LEGORacers.exe 0x0041ed10 / 0x0042c4e0 write this into game settings +0xee.
export const COMMON_DIRECTORY = 'GAMEDATA\\COMMON'
// The world loader's default extension (GolDP.dll 0x1002c240, ".wdb" at 0x1005cf18).
const WORLD_EXTENSION = '.wdb'

// LEGORacers.exe 0x00432e20 loads a race's worlds into one container in this order: the global world from
// the common directory (+0xee), then, from the race directory (+0xdc), the track, collision, blended and
// local worlds. A name the race description leaves out is skipped.
export const getRaceWorldPaths = (
  raceDirectory: string,
  names: RaceWorldNames
): readonly string[] => {
  const getPath = (directory: string, name: string | null) =>
    name === null
      ? []
      : [getArchivePath(directory, getNameWithDefaultExtension(name, WORLD_EXTENSION))]
  return Object.freeze([
    ...getPath(COMMON_DIRECTORY, names.globalWorld),
    ...getPath(raceDirectory, names.trackWorld),
    ...getPath(raceDirectory, names.collisionWorld),
    ...getPath(raceDirectory, names.blendedWorld),
    ...getPath(raceDirectory, names.localWorld),
  ])
}

// Sky_Load (LEGORacers.exe 0x0041c550) runs in the race directory after the worlds above. Its reader's default
// extension is ".skb" (0x004be808); the world it loads (the call at 0x0041cbb7, the race's background world name)
// takes the world loader's default ".wdb" and goes into the same container, so it sees the textures and
// materials of the worlds before it.
const SKY_EXTENSION = '.skb'

export const getRaceSkyPath = (raceDirectory: string, names: RaceSkyNames): string | null =>
  names.sky === null
    ? null
    : getArchivePath(raceDirectory, getNameWithDefaultExtension(names.sky, SKY_EXTENSION))

export const getRaceBackgroundWorldPath = (
  raceDirectory: string,
  names: RaceSkyNames
): string | null =>
  names.backgroundWorld === null
    ? null
    : getArchivePath(
        raceDirectory,
        getNameWithDefaultExtension(names.backgroundWorld, WORLD_EXTENSION)
      )

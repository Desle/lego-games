import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { parseRaceDescription } from '@lego-games/lego-racers/race-description'
import type { Scene } from '@lego-games/lego-racers/scene'
import {
  getRaceBackgroundWorldPath,
  getRaceSkyPath,
  getRaceWorldPaths,
  getWorldPaths,
} from '@lego-games/lego-racers/scene'
import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import type {
  RaceContent,
  SceneSummary,
  WorldEntry,
  WorldGroup,
} from '../../types/track-viewer.types.ts'

const PATH_SEPARATOR = '\\'
const RACE_DESCRIPTION_EXTENSION = '.RAB'
// Mirroring only flips the race's camera vectors, not its world names.
const isMirrored = false

const getDirectory = (path: string) => path.slice(0, path.lastIndexOf(PATH_SEPARATOR))
const getFileName = (path: string) => path.slice(path.lastIndexOf(PATH_SEPARATOR) + 1)

// The worlds of each race, in the order the game loads them, and the sky and background it draws before the
// track (one race description per race directory).
const getRaceContentByDirectory = (archive: JamArchive): ReadonlyMap<string, RaceContent> =>
  new Map(
    archive
      .getFilePaths()
      .filter((path) => path.endsWith(RACE_DESCRIPTION_EXTENSION))
      .map((path) => {
        const directory = getDirectory(path)
        const description = parseRaceDescription(archive.readFile(path), isMirrored)
        return [
          directory,
          Object.freeze({
            worldPaths: getRaceWorldPaths(directory, description),
            skyPath: getRaceSkyPath(directory, description),
            backgroundWorldPath: getRaceBackgroundWorldPath(directory, description),
          }),
        ] as const
      })
  )

// A world that belongs to a race is loaded after the worlds the race loads before it, so it finds their
// textures and materials; any other world is loaded on its own.
const getWorldEntry = (path: string, raceContent: RaceContent | undefined): WorldEntry => {
  const raceWorldPaths = raceContent?.worldPaths
  const raceIndex = raceWorldPaths?.indexOf(path) ?? -1
  const worldPaths = raceIndex < 0 ? [path] : (raceWorldPaths ?? []).slice(0, raceIndex + 1)
  const earlierCount = worldPaths.length - 1
  return Object.freeze({
    id: path,
    label:
      earlierCount === 0
        ? getFileName(path)
        : `${getFileName(path)} (after ${String(earlierCount)} race world${earlierCount === 1 ? '' : 's'})`,
    worldPaths: Object.freeze(worldPaths),
    skyPath: null,
    backgroundWorldPath: null,
  })
}

// Every non-empty world in the archive, grouped by directory; race directories start with the whole race.
export const getWorldGroups = (archive: JamArchive): readonly WorldGroup[] => {
  const raceContents = getRaceContentByDirectory(archive)
  const groups = new Map<string, WorldEntry[]>()
  for (const path of getWorldPaths(archive)) {
    if (archive.findFile(path).size === 0) continue
    const directory = getDirectory(path)
    const entries = groups.get(directory) ?? []
    const raceContent = raceContents.get(directory)
    if (entries.length === 0 && raceContent !== undefined) {
      entries.push(
        Object.freeze({
          id: `race:${directory}`,
          label: 'Whole race',
          worldPaths: raceContent.worldPaths,
          skyPath: raceContent.skyPath,
          backgroundWorldPath: raceContent.backgroundWorldPath,
        })
      )
    }
    entries.push(getWorldEntry(path, raceContent))
    groups.set(directory, entries)
  }
  return Object.freeze(
    [...groups].map(([directory, entries]) =>
      Object.freeze({ directory, entries: Object.freeze(entries) })
    )
  )
}

export const getSceneSummary = (scene: Scene): SceneSummary =>
  Object.freeze({
    worldPaths: scene.worldPaths,
    instanceCount: scene.instances.length,
    animatedInstanceCount: scene.instances.filter(
      (instance) =>
        instance.kind === SceneInstanceKind.SKELETON && (instance.levels[0]?.meshIndex ?? -1) >= 0
    ).length,
    meshCount: scene.meshes.length,
    triangleCount: scene.meshes.reduce(
      (sum, mesh) =>
        sum + mesh.drawBatches.reduce((count, batch) => count + batch.vertexIndices.length / 3, 0),
      0
    ),
    materialCount: scene.materials.length,
    textureCount: scene.textures.length,
    missingTextures: Object.freeze(
      scene.textures
        .filter((texture) => texture.bitmap === null)
        .map((texture) => `${texture.bitmapPath} (${texture.missingBitmapReason ?? ''})`)
    ),
    cameraNames: Object.freeze(scene.cameras.map((camera) => camera.name)),
    lightCount: scene.ambientLights.length + scene.directionalLights.length,
  })

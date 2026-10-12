import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getWorldPaths, loadScene } from '@lego-games/lego-racers/scene'
import { AssetType } from '../../types/asset-type/asset-type.ts'
import type { ExportReport, OutputWriter } from '../../types/export.types.ts'
import {
  getArchiveDirectory,
  getBaseName,
  getErrorMessage,
  getMirroredFile,
} from '../../services/export-paths/export-paths.ts'
import { buildWorldGltf } from '../model-gltf/build-world-gltf.ts'
import type { TextureReferences } from '../model-gltf/texture-references.types.ts'

const MODEL_DIRECTORY = 'models'
const textEncoder = new TextEncoder()
const COMMON_WORLD_PATH = 'GAMEDATA\\COMMON\\GLOBAL.WDB'

// The world alone, then on top of the common world, then on top of the worlds of its folder listed before it (a
// BLENDED or LOCAL world uses the materials and textures of the folder's main world), then of all of them.
const getLoadAttempts = (
  worldPath: string,
  worldPaths: readonly string[]
): readonly (readonly string[])[] => {
  const siblings = worldPaths.filter(
    (other) => other !== worldPath && getArchiveDirectory(other) === getArchiveDirectory(worldPath)
  )
  const earlierSiblings = siblings.filter(
    (other) => worldPaths.indexOf(other) < worldPaths.indexOf(worldPath)
  )
  return [
    [worldPath],
    [COMMON_WORLD_PATH, worldPath],
    [COMMON_WORLD_PATH, ...earlierSiblings, worldPath],
    [COMMON_WORLD_PATH, ...siblings, worldPath],
  ]
}

const loadWorldScene = (archive: JamArchive, worldPath: string, worldPaths: readonly string[]) => {
  let lastError: unknown = null
  for (const attempt of getLoadAttempts(worldPath, worldPaths)) {
    try {
      return loadScene(archive, attempt)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

// Every world (WDB) of LEGO.JAM as one glTF scene with its instances placed, at <archive path>.world.gltf under
// models/. A world that holds no meshes (a collision or emitter world) is reported, not written.
export const exportWorlds = (
  archive: JamArchive,
  writer: OutputWriter,
  references: TextureReferences
): ExportReport => {
  const failures: string[] = []
  let writtenCount = 0
  const worldPaths = getWorldPaths(archive)
  for (const worldPath of worldPaths) {
    try {
      const name = getBaseName(worldPath)
      const file = getMirroredFile(MODEL_DIRECTORY, worldPath, '.world.gltf')
      const output = buildWorldGltf({
        name,
        worldPath,
        scene: loadWorldScene(archive, worldPath, worldPaths),
        getTextureUri: (texture) => references.getTextureUri(file, texture),
        binaryUri: `${encodeURIComponent(name)}.world.bin`,
      })
      writer.writeFile(file, textEncoder.encode(output.json), AssetType.WORLD, worldPath)
      writer.writeFile(
        file.replace(/\.gltf$/, '.bin'),
        output.binary,
        AssetType.WORLD_BUFFER,
        worldPath
      )
      writtenCount++
    } catch (error) {
      failures.push(`${worldPath}: ${getErrorMessage(error)}`)
    }
  }
  return Object.freeze({ label: 'worlds', writtenCount, failures, skipMessage: null })
}

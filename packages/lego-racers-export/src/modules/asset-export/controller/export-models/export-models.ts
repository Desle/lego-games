import { parseAnimation } from '@lego-games/lego-racers/animation'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadModelScene, loadScene } from '@lego-games/lego-racers/scene'
import type { ModelScene, Scene } from '@lego-games/lego-racers/scene'
import { getSkeletalAnimation } from '@lego-games/lego-racers/skeletal-animation'
import { parseSkeleton } from '@lego-games/lego-racers/skeleton'
import { AssetType } from '../../types/asset-type/asset-type.ts'
import type { ExportReport, OutputWriter } from '../../types/export.types.ts'
import {
  getArchiveDirectory,
  getBaseName,
  getErrorMessage,
  getMirroredFile,
} from '../../services/export-paths/export-paths.ts'
import { buildModelGltf } from '../model-gltf/build-model-gltf.ts'
import type { TextureReferences } from '../model-gltf/texture-references.types.ts'
import type { LoadedModel, ModelDirectory } from './export-models.types.ts'

const MODEL_DIRECTORY = 'models'
const COMMON_WORLD_PATH = 'GAMEDATA\\COMMON\\GLOBAL.WDB'
const textEncoder = new TextEncoder()

const getModelDirectories = (archive: JamArchive): readonly ModelDirectory[] => {
  const pathsByDirectory = new Map<string, string[]>()
  for (const path of archive.getFilePaths()) {
    const directory = getArchiveDirectory(path)
    pathsByDirectory.set(directory, [...(pathsByDirectory.get(directory) ?? []), path])
  }
  return [...pathsByDirectory.entries()]
    .filter(([, paths]) => paths.some((path) => /\.gdb$/i.test(path)))
    .map(([directory, paths]) => {
      const getNames = (extension: string): readonly string[] =>
        paths.filter((path) => path.toUpperCase().endsWith(extension)).map(getBaseName)
      const getAncestorNames = (extension: string): readonly string[] =>
        [...pathsByDirectory.entries()]
          .filter(([other]) => directory.startsWith(`${other}\\`))
          .flatMap(([, otherPaths]) => otherPaths)
          .filter((path) => path.toUpperCase().endsWith(extension))
          .map((path) => `\\${path.replace(/\.[^.\\]*$/, '')}`)
      return Object.freeze({
        directory,
        modelNames: getNames('.GDB'),
        textureNames: getNames('.TDB'),
        materialNames: getNames('.MDB'),
        ancestorTextureNames: getAncestorNames('.TDB'),
        ancestorMaterialNames: getAncestorNames('.MDB'),
        getPath: (name: string, extension: string) =>
          paths.find(
            (path) => path.toUpperCase() === `${directory}\\${name}${extension}`.toUpperCase()
          ) ?? null,
      })
    })
}

const ATTEMPT_COUNT = 4

// Loose models load with the texture databases and material libraries of their folder that no model of the folder
// is named after (a track's COMBINED set), plus the ones named like the model itself (a racer part's own set). A
// library that names a texture or material from elsewhere loads again on top of the common resources, and then with
// every library of the folder. Models with a set of their own load one by one; the rest load together, or one by one
// when that fails.
const loadModels = (
  archive: JamArchive,
  folder: ModelDirectory,
  commonScene: Scene | null
): ReadonlyMap<string, LoadedModel | Error> => {
  const modelNames = new Set(folder.modelNames)
  const getNamesFor = (all: readonly string[], names: readonly string[], attempt: number) =>
    attempt >= ATTEMPT_COUNT - 2
      ? all
      : [
          ...all.filter((name) => !modelNames.has(name)),
          ...names.filter((name) => all.includes(name)),
        ]
  const load = (names: readonly string[], attempt: number): ModelScene =>
    loadModelScene(
      archive,
      {
        directory: folder.directory,
        textureNames: [
          ...getNamesFor(folder.textureNames, names, attempt),
          ...(attempt === ATTEMPT_COUNT - 1 ? folder.ancestorTextureNames : []),
        ],
        materialNames: [
          ...getNamesFor(folder.materialNames, names, attempt),
          ...(attempt === ATTEMPT_COUNT - 1 ? folder.ancestorMaterialNames : []),
        ],
        meshNames: names,
        skeletonName: null,
        animationName: null,
      },
      attempt === 0 ? null : commonScene
    )
  const loadWithFallbacks = (names: readonly string[]): ModelScene => {
    let lastError: unknown = null
    for (let attempt = 0; attempt < ATTEMPT_COUNT; attempt++) {
      try {
        return load(names, attempt)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError
  }
  const loaded = new Map<string, LoadedModel | Error>()
  const loadSeparately = (names: readonly string[]): void => {
    for (const name of names) {
      try {
        loaded.set(name, { modelScene: loadWithFallbacks([name]), meshIndex: 0 })
      } catch (error) {
        loaded.set(name, error instanceof Error ? error : new Error(String(error)))
      }
    }
  }
  const ownNames = folder.modelNames.filter(
    (name) => folder.textureNames.includes(name) || folder.materialNames.includes(name)
  )
  const sharedNames = folder.modelNames.filter((name) => !ownNames.includes(name))
  loadSeparately(ownNames)
  try {
    const modelScene = loadWithFallbacks(sharedNames)
    for (const [meshIndex, name] of sharedNames.entries())
      loaded.set(name, { modelScene, meshIndex })
  } catch {
    loadSeparately(sharedNames)
  }
  return loaded
}

const getCommonScene = (archive: JamArchive): Scene | null => {
  try {
    return loadScene(archive, [COMMON_WORLD_PATH])
  } catch {
    return null
  }
}

const writeModel = (
  archive: JamArchive,
  writer: OutputWriter,
  references: TextureReferences,
  folder: ModelDirectory,
  name: string,
  loaded: LoadedModel
): void => {
  const modelPath = folder.getPath(name, '.GDB') ?? name
  const skeletonPath = folder.getPath(name, '.SDB')
  const animationPath = folder.getPath(name, '.ADB')
  const file = getMirroredFile(MODEL_DIRECTORY, modelPath, '.gltf')
  const output = buildModelGltf({
    name,
    scene: loaded.modelScene.scene,
    meshIndex: loaded.meshIndex,
    scale: loaded.modelScene.meshScales[loaded.meshIndex] ?? 1,
    skeleton: skeletonPath === null ? null : parseSkeleton(archive.readFile(skeletonPath)),
    animation:
      animationPath === null
        ? null
        : getSkeletalAnimation(parseAnimation(archive.readFile(animationPath))),
    getTextureUri: (texture) => references.getTextureUri(file, texture),
    binaryUri: `${encodeURIComponent(name)}.bin`,
  })
  writer.writeFile(file, textEncoder.encode(output.json), AssetType.MODEL, modelPath)
  writer.writeFile(
    file.replace(/\.gltf$/, '.bin'),
    output.binary,
    AssetType.MODEL_BUFFER,
    modelPath
  )
}

// Every GDB model of LEGO.JAM as glTF 2.0 at its archive path under models/: UVs, vertex colours and normals where the
// model has them, materials referencing the exported textures; a model with a skeleton (SDB) of the same name is
// skinned to it, with the clips of its animation (ADB).
export const exportModels = (
  archive: JamArchive,
  writer: OutputWriter,
  references: TextureReferences
): ExportReport => {
  const failures: string[] = []
  let writtenCount = 0
  const commonScene = getCommonScene(archive)
  for (const folder of getModelDirectories(archive)) {
    const loadedModels = loadModels(archive, folder, commonScene)
    for (const name of folder.modelNames) {
      const loaded = loadedModels.get(name)
      try {
        if (loaded === undefined) throw new Error('The model was not loaded')
        if (loaded instanceof Error) throw loaded
        writeModel(archive, writer, references, folder, name, loaded)
        writtenCount++
      } catch (error) {
        failures.push(`${folder.getPath(name, '.GDB') ?? name}: ${getErrorMessage(error)}`)
      }
    }
  }
  return Object.freeze({ label: 'models', writtenCount, failures, skipMessage: null })
}

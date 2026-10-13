import { getModelBounds, parseModel } from '../../../model/index.ts'
import type { ModelVertexBuffer } from '../../../model/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import { getDrawBatches } from '../../types/draw-batches/draw-batches.ts'
import { getArchivePath, getNameWithDefaultExtension } from '../../types/scene-path/scene-path.ts'
import type { SceneMaterialAssignment, SceneMesh } from '../../types/scene.types.ts'
import { getMaterialIndices } from './link-materials.ts'
import type { LinkedMaterials, SceneFileSource } from './load-scene.types.ts'

// 0x10017ac0 appends ".gdf" (0x1005cbbc) to mesh and material-assignment names; ".gdb" (0x1005ce38) replaces it.
const MODEL_LIST_EXTENSION = '.gdf'
const MODEL_EXTENSION = '.gdb'

const getModelPath = (source: SceneFileSource, name: string): string =>
  getArchivePath(
    source.directory,
    getNameWithDefaultExtension(name + MODEL_LIST_EXTENSION, MODEL_EXTENSION)
  )

// 0xAARRGGBB per vertex → R, G, B, A bytes.
const getVertexColors = (buffer: ModelVertexBuffer): Uint8Array | null => {
  if (buffer.colors.length === 0) return null
  const colors = new Uint8Array(buffer.vertexCount * 4)
  for (const [index, packed] of buffer.colors.entries()) {
    colors.set(
      [(packed >>> 16) & 0xff, (packed >>> 8) & 0xff, packed & 0xff, (packed >>> 24) & 0xff],
      index * 4
    )
  }
  return colors
}

const MODEL_ARITHMETIC = createFloatArithmetic(RACE_FPU_PRECISION)

const EMPTY_BUFFER: ModelVertexBuffer = Object.freeze({
  format: 'position',
  vertexCount: 0,
  positions: [],
  textureCoordinates: [],
  normals: [],
  colors: [],
})

// GolDP.dll 0x100270e0 for each name in the world's mesh list; the model's material names are looked up
// while it loads (0x10025f90).
export const linkMeshes = (
  source: SceneFileSource,
  meshNames: readonly string[],
  linkedMaterials: LinkedMaterials
): readonly SceneMesh[] =>
  Object.freeze(
    meshNames.map((name) => {
      const path = getModelPath(source, name)
      const model = parseModel(source.archive.readFile(path))
      const buffer = model.vertexBuffer ?? model.positionVertexBuffer ?? EMPTY_BUFFER
      const textureCoordinates =
        buffer.textureCoordinates.length === 0
          ? new Float32Array(buffer.vertexCount * 2)
          : Float32Array.from(buffer.textureCoordinates)
      return Object.freeze({
        name,
        path,
        vertexCount: buffer.vertexCount,
        positions: Float32Array.from(buffer.positions),
        textureCoordinates,
        colors: getVertexColors(buffer),
        normals: buffer.normals.length === 0 ? null : Float32Array.from(buffer.normals),
        materialIndices: getMaterialIndices(linkedMaterials, model.materialNames),
        drawBatches: getDrawBatches(model.commands, model.faces),
        boundingSphere: getModelBounds(MODEL_ARITHMETIC, model),
      })
    })
  )

// GolDP.dll 0x10025e60 for each name in the world's material-assignment list: a model file read only for
// its material names, which replace a model's own list when an instance level uses it (0x10006c50).
export const linkMaterialAssignments = (
  source: SceneFileSource,
  assignmentNames: readonly string[],
  linkedMaterials: LinkedMaterials
): readonly SceneMaterialAssignment[] =>
  Object.freeze(
    assignmentNames.map((name) => {
      const path = getModelPath(source, name)
      const model = parseModel(source.archive.readFile(path))
      return Object.freeze({
        name,
        path,
        materialIndices: getMaterialIndices(linkedMaterials, model.materialNames),
      })
    })
  )

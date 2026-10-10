import type { SceneDrawBatch } from '../scene.types.ts'
import type { DrawBatchBuilder, DrawCommand, DrawFace } from './draw-batches.types.ts'

// The renderer's transformed-vertex cache (device +0x348, 0x20 bytes per slot; 0x10027430 caps slots at 0x40).
const VERTEX_CACHE_SIZE = 0x40
const NO_VERTEX = -1

const createBatchBuilder = (materialSlot: number): DrawBatchBuilder =>
  Object.freeze({ materialSlot, vertexIndices: [], transformIndices: [] })

const getFrozenBatch = (builder: DrawBatchBuilder): SceneDrawBatch =>
  Object.freeze({
    materialSlot: builder.materialSlot,
    vertexIndices: Uint32Array.from(builder.vertexIndices),
    transformIndices: Uint8Array.from(builder.transformIndices),
  })

// Walks a model's packed commands as GolDP.dll 0x10006c50 does: transform_vertices fills cache slots
// (0x1000c630), draw_faces draws faces whose corners are cache slots (0x1000ebd0), select_material
// switches the material (0x1000a2c0), select_transform picks the matrix later transforms use (0x1000acf0).
export const getDrawBatches = (
  commands: readonly DrawCommand[],
  faces: readonly DrawFace[]
): readonly SceneDrawBatch[] => {
  const cachedVertices = new Int32Array(VERTEX_CACHE_SIZE).fill(NO_VERTEX)
  const cachedTransforms = new Uint8Array(VERTEX_CACHE_SIZE)
  const batches: DrawBatchBuilder[] = []
  let currentBatch: DrawBatchBuilder | null = null
  let currentTransform = 0
  for (const command of commands) {
    switch (command.kind) {
      case 'select_material':
        currentBatch = createBatchBuilder(command.materialIndex)
        batches.push(currentBatch)
        break
      case 'select_transform':
        currentTransform = command.transformIndex
        break
      case 'transform_vertices':
        for (let offset = 0; offset < command.vertexCount; offset++) {
          const slot = command.cacheIndex + offset
          if (slot >= VERTEX_CACHE_SIZE) break
          cachedVertices[slot] = command.firstVertex + offset
          cachedTransforms[slot] = currentTransform
        }
        break
      case 'draw_faces': {
        const batch: DrawBatchBuilder = currentBatch ?? createBatchBuilder(0)
        if (currentBatch === null) {
          currentBatch = batch
          batches.push(batch)
        }
        for (const face of faces.slice(command.firstFace, command.firstFace + command.faceCount)) {
          const corners = face.map((slot) => cachedVertices[slot] ?? NO_VERTEX)
          if (corners.some((vertex) => vertex === NO_VERTEX)) continue
          batch.vertexIndices.push(...corners)
          batch.transformIndices.push(...face.map((slot) => cachedTransforms[slot] ?? 0))
        }
        break
      }
    }
  }
  return Object.freeze(
    batches.filter((batch) => batch.vertexIndices.length > 0).map(getFrozenBatch)
  )
}

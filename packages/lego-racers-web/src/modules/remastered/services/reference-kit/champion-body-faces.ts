import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getRacerModelFiles } from '@lego-games/lego-racers/racer-appearance'
import type { ModelResourceNames } from '@lego-games/lego-racers/racer-appearance'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import type { SceneBitmap, SceneMesh } from '@lego-games/lego-racers/scene'
import type { ReferenceFaces } from './reference-kit.types.ts'

const CORNERS_PER_TRIANGLE = 3
const VALUES_PER_POSITION = 3
const VALUES_PER_COLOR = 4
const VALUES_PER_TEXTURE_COORDINATE = 2
const STUD_TEXTURE_PATTERN = /nub/i
const OPAQUE_CHANNEL = 255

// The colour of a triangle as the model gives it: the colours of its corners (the model's own paint) times its material's picture at
// the middle of its texture coordinates (v counts up from the picture's bottom row) when it has one.
const getTriangleColor = (
  bitmap: SceneBitmap | null,
  corners: readonly number[],
  mesh: SceneMesh
): readonly number[] => {
  const getMean = (read: (vertex: number) => number) =>
    corners.reduce((sum, vertex) => sum + read(vertex), 0) / CORNERS_PER_TRIANGLE
  const paint = [0, 1, 2].map((channel) =>
    getMean((vertex) => mesh.colors?.[vertex * VALUES_PER_COLOR + channel] ?? OPAQUE_CHANNEL)
  )
  if (bitmap === null) return paint.map(Math.round)
  const getCoordinate = (offset: number) => {
    const mean = getMean(
      (vertex) => mesh.textureCoordinates[vertex * VALUES_PER_TEXTURE_COORDINATE + offset] ?? 0
    )
    return mean - Math.floor(mean)
  }
  const column = Math.min(bitmap.width - 1, Math.floor(getCoordinate(0) * bitmap.width))
  const row = Math.min(bitmap.height - 1, Math.floor((1 - getCoordinate(1)) * bitmap.height))
  const base = (row * bitmap.width + column) * 4
  return paint.map((value, channel) =>
    Math.round((value * (bitmap.colors[base + channel] ?? 0)) / OPAQUE_CHANNEL)
  )
}

// The surface of a champion's car body model (a plain GDB model, as `Champion_CreateInstance` 0x0041d7a0 loads it) as triangles in
// studs: the vertices times the model's scale (GDB keyword 0x33), in the model's own frame (x forward, y to the left, z up). The studs
// are left out; the colour of a triangle is the model's paint times its picture.
export const loadChampionBodyFaces = (
  archive: JamArchive,
  names: ModelResourceNames
): ReferenceFaces => {
  const { scene, meshScales } = loadModelScene(archive, getRacerModelFiles(names))
  const mesh = scene.meshes[0]
  if (mesh === undefined) throw new RangeError(`The model ${names.modelName} has no mesh`)
  const scale = meshScales[0] ?? 1
  const positions: number[] = []
  const colors: number[] = []
  for (const batch of mesh.drawBatches) {
    const material = scene.materials[mesh.materialIndices[batch.materialSlot] ?? -1]
    const bitmap = scene.textures[material?.textureIndex ?? -1]?.bitmap ?? null
    if (material !== undefined && STUD_TEXTURE_PATTERN.test(material.name)) continue
    for (let start = 0; start + CORNERS_PER_TRIANGLE <= batch.vertexIndices.length; start += 3) {
      const corners = [0, 1, 2].map((corner) => batch.vertexIndices[start + corner] ?? 0)
      for (const vertex of corners) {
        for (const axis of [0, 1, 2]) {
          positions.push((mesh.positions[vertex * VALUES_PER_POSITION + axis] ?? 0) * scale)
        }
      }
      colors.push(...getTriangleColor(bitmap, corners, mesh))
    }
  }
  return Object.freeze({ positions: Float32Array.from(positions), colors: Uint8Array.from(colors) })
}

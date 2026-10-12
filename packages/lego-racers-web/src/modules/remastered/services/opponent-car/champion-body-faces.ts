import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getRacerModelFiles } from '@lego-games/lego-racers/racer-appearance'
import type { ModelResourceNames } from '@lego-games/lego-racers/racer-appearance'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import type { SceneBitmap, SceneMaterial } from '@lego-games/lego-racers/scene'
import type {
  BodyDecal,
  ChampionBodyFaces,
  DecalAccumulator,
  MaterialRole,
} from './opponent-car.types.ts'

const CORNERS_PER_TRIANGLE = 3
const VALUES_PER_POSITION = 3
const VALUES_PER_COLOR = 4
const VALUES_PER_TEXTURE_COORDINATE = 2
const STUD_TEXTURE_PATTERN = /nub/i

const getMaterialRole = (material: SceneMaterial | undefined, bitmap: SceneBitmap | null) => {
  if (material === undefined || material.textureIndex === null || bitmap === null) return 'plastic'
  return STUD_TEXTURE_PATTERN.test(material.name) ? 'stud' : 'decal'
}

// The surface of a champion's car body model (a plain GDB model, as `Champion_CreateInstance` 0x0041d7a0 loads it) as triangles in
// studs: the vertices times the model's scale (GDB keyword 0x33). The studs are left out (the bricks bring their own), the
// printed faces (a material with a picture of the car's own) come as decals, everything else as coloured plastic.
export const loadChampionBodyFaces = (
  archive: JamArchive,
  names: ModelResourceNames
): ChampionBodyFaces => {
  const { scene, meshScales } = loadModelScene(archive, getRacerModelFiles(names))
  const mesh = scene.meshes[0]
  if (mesh === undefined) throw new RangeError(`The model ${names.modelName} has no mesh`)
  const scale = meshScales[0] ?? 1
  const plasticPositions: number[] = []
  const plasticColors: number[] = []
  const decalsByMaterial = new Map<number, DecalAccumulator>()
  for (const batch of mesh.drawBatches) {
    const materialIndex = mesh.materialIndices[batch.materialSlot] ?? -1
    const material = scene.materials[materialIndex]
    const textureIndex = material?.textureIndex ?? -1
    const bitmap = scene.textures[textureIndex]?.bitmap ?? null
    const role: MaterialRole = getMaterialRole(material, bitmap)
    if (role === 'stud') continue
    for (let start = 0; start + CORNERS_PER_TRIANGLE <= batch.vertexIndices.length; start += 3) {
      const corners = [0, 1, 2].map((corner) => batch.vertexIndices[start + corner] ?? 0)
      const positions = corners.flatMap((vertex) =>
        [0, 1, 2].map((axis) => (mesh.positions[vertex * VALUES_PER_POSITION + axis] ?? 0) * scale)
      )
      if (role === 'decal' && bitmap !== null) {
        const decal = decalsByMaterial.get(materialIndex) ?? {
          bitmap,
          positions: [],
          textureCoordinates: [],
        }
        decalsByMaterial.set(materialIndex, decal)
        decal.positions.push(...positions)
        for (const vertex of corners) {
          decal.textureCoordinates.push(
            mesh.textureCoordinates[vertex * VALUES_PER_TEXTURE_COORDINATE] ?? 0,
            mesh.textureCoordinates[vertex * VALUES_PER_TEXTURE_COORDINATE + 1] ?? 0
          )
        }
        continue
      }
      plasticPositions.push(...positions)
      for (const channel of [0, 1, 2]) {
        const total = corners.reduce(
          (sum, vertex) => sum + (mesh.colors?.[vertex * VALUES_PER_COLOR + channel] ?? 255),
          0
        )
        plasticColors.push(Math.round(total / CORNERS_PER_TRIANGLE))
      }
    }
  }
  const decals: readonly BodyDecal[] = [...decalsByMaterial.values()].map((decal) => ({
    bitmap: decal.bitmap,
    positions: Float32Array.from(decal.positions),
    textureCoordinates: Float32Array.from(decal.textureCoordinates),
  }))
  return Object.freeze({
    positions: Float32Array.from(plasticPositions),
    colors: Uint8Array.from(plasticColors),
    decals: Object.freeze(decals),
  })
}

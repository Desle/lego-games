import type { ModelScene, SceneBitmap, SceneMesh } from '@lego-games/lego-racers/scene'
import { getBatchSurfaces } from './model-surface.ts'
import type {
  MinifigPictures,
  PictureSource,
  SurfaceTriangle,
  UvRectangle,
} from './minifig-pictures.types.ts'

const FRONT_NORMAL_X = 0.5
// The torso's bone in the figure builder's driver model (`pelvis`, `torso`, `arm_l`, `arm_r`, `dummy01`, `head`).
const TORSO_BONE = 1
// The face card of `ICB_CHAR.GCB`'s `heads` (four triangles on the face bone) shows this part of the 64 x 64 face picture, and is 32 raw
// units wide and 20 high: the same on all 30 faces (read off their triangles).
const FACE_RECTANGLE: UvRectangle = Object.freeze({
  left: 0.27,
  right: 0.722,
  bottom: 0.375,
  top: 0.688,
})
const FACE_WIDTH = 32
const FACE_HEIGHT = 20

const getTriangles = (mesh: SceneMesh, batchIndex: number): readonly SurfaceTriangle[] => {
  const batch = mesh.drawBatches[batchIndex]
  if (batch === undefined) return []
  return Array.from({ length: Math.floor(batch.vertexIndices.length / 3) }, (_unused, triangle) => {
    const vertices = [0, 1, 2].map((corner) => batch.vertexIndices[triangle * 3 + corner] ?? 0)
    const normalX =
      vertices.reduce((sum, vertex) => sum + (mesh.normals?.[vertex * 3] ?? 0), 0) / vertices.length
    return { boneIndex: batch.transformIndices[triangle * 3] ?? 0, vertices, normalX }
  })
}

const getBounds = (values: readonly number[]): readonly [number, number] => [
  Math.min(...values),
  Math.max(...values),
]

const getUvRectangle = (
  mesh: SceneMesh,
  triangles: readonly SurfaceTriangle[]
): UvRectangle | null => {
  const vertices = triangles.flatMap((triangle) => triangle.vertices)
  if (vertices.length === 0) return null
  const [left, right] = getBounds(
    vertices.map((vertex) => mesh.textureCoordinates[vertex * 2] ?? 0)
  )
  const [bottom, top] = getBounds(
    vertices.map((vertex) => mesh.textureCoordinates[vertex * 2 + 1] ?? 0)
  )
  return Object.freeze({ left, right, bottom, top })
}

// The front of the torso: the part of the chest picture its forward-facing triangles show, and their size across the figure (y) and
// up it (z), raw model units.
const getTorsoPicture = (
  mesh: SceneMesh,
  chestIndex: number,
  bitmapPath: string,
  bitmap: SceneBitmap
): PictureSource | null => {
  const front = getTriangles(mesh, chestIndex).filter(
    (triangle) => triangle.boneIndex === TORSO_BONE && triangle.normalX > FRONT_NORMAL_X
  )
  const rectangle = getUvRectangle(mesh, front)
  if (rectangle === null) return null
  const vertices = front.flatMap((triangle) => triangle.vertices)
  const [low, high] = getBounds(vertices.map((vertex) => mesh.positions[vertex * 3 + 1] ?? 0))
  const [bottom, top] = getBounds(vertices.map((vertex) => mesh.positions[vertex * 3 + 2] ?? 0))
  return Object.freeze({ bitmapPath, bitmap, rectangle, width: high - low, height: top - bottom })
}

// The face and torso pictures of the figure builder's model of a driver (`loadBuiltDriverScene`): what goes on a head or a torso of
// the library that has no print of its own.
export const readMinifigPictures = (model: ModelScene): MinifigPictures => {
  const mesh = model.scene.meshes[model.scene.instances[0]?.levels[0]?.meshIndex ?? -1]
  const surfaces = getBatchSurfaces(model)
  const face = surfaces.find((surface) => /dflt$/.test(surface.materialName))
  const chestIndex = surfaces.findIndex((surface) => /chst$/.test(surface.materialName))
  const chest = surfaces[chestIndex]
  return Object.freeze({
    face:
      face?.bitmap == null
        ? null
        : Object.freeze({
            bitmapPath: face.bitmapPath,
            bitmap: face.bitmap,
            rectangle: FACE_RECTANGLE,
            width: FACE_WIDTH,
            height: FACE_HEIGHT,
          }),
    torso:
      mesh === undefined || chest?.bitmap == null
        ? null
        : getTorsoPicture(mesh, chestIndex, chest.bitmapPath, chest.bitmap),
  })
}

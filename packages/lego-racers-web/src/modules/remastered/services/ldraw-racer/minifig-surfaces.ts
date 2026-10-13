import type { ModelScene, SceneBitmap, SceneMesh } from '@lego-games/lego-racers/scene'
import { getBatchSurfaces, getColorShares, getDominantColor } from './model-surface.ts'
import { MINIFIG_SIDES } from '@lego-games/ldraw/minifig'
import type { MinifigSide } from '@lego-games/ldraw/minifig'
import type { BatchSurface, BitmapRegion } from './model-surface.types.ts'
import type {
  ArmParts,
  BoneClass,
  MinifigSurfaces,
  PictureSource,
  SurfaceSize,
  SurfaceTriangle,
  UvRectangle,
} from './minifig-surfaces.types.ts'

const FRONT_NORMAL_X = 0.5
const FALLBACK_COLOR = 0xf2cd37
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
const TWO_TONE_DOMINANT_SHARE = 0.85
const TWO_TONE_PATCH_SHARE = 0.03
// The bones of the arms (`arm_l`, `arm_r`); an arm reaches along its bone's x, and its far quarter is the hand.
const ARM_BONES: Readonly<Record<MinifigSide, number>> = Object.freeze({ left: 2, right: 3 })
const HAND_SHARE = 0.25

// The bones of the figure builder's driver model (`pelvis`, `torso`, `arm_l`, `arm_r`, `dummy01`, `head`) by what they carry.
const BONE_CLASSES: readonly BoneClass[] = Object.freeze(['legs', 'torso', 'arm', 'arm', 'head'])

const getTriangles = (mesh: SceneMesh, batchIndex: number): readonly SurfaceTriangle[] => {
  const batch = mesh.drawBatches[batchIndex]
  if (batch === undefined) return []
  return Array.from({ length: Math.floor(batch.vertexIndices.length / 3) }, (_unused, triangle) => {
    const vertices = [0, 1, 2].map((corner) => batch.vertexIndices[triangle * 3 + corner] ?? 0)
    const normalX =
      vertices.reduce((sum, vertex) => sum + (mesh.normals?.[vertex * 3] ?? 0), 0) / vertices.length
    const boneIndex = batch.transformIndices[triangle * 3] ?? 0
    return {
      boneIndex,
      boneClass: BONE_CLASSES[boneIndex] ?? 'head',
      vertices,
      normalX,
    }
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

// The size of the triangles' surface across the figure (y) and up it (z), raw model units.
const getSurfaceSize = (mesh: SceneMesh, triangles: readonly SurfaceTriangle[]): SurfaceSize => {
  const vertices = triangles.flatMap((triangle) => triangle.vertices)
  const [low, high] = getBounds(vertices.map((vertex) => mesh.positions[vertex * 3 + 1] ?? 0))
  const [bottom, top] = getBounds(vertices.map((vertex) => mesh.positions[vertex * 3 + 2] ?? 0))
  return { width: high - low, height: top - bottom }
}

// A UV rectangle as a part of its bitmap (the parts' v counts down the bitmap's rows).
const getBitmapRegion = (rectangle: UvRectangle): BitmapRegion =>
  Object.freeze({
    left: rectangle.left,
    right: rectangle.right,
    top: rectangle.bottom,
    bottom: rectangle.top,
  })

const getPicture = (
  mesh: SceneMesh,
  surface: BatchSurface,
  triangles: readonly SurfaceTriangle[]
): PictureSource | null => {
  const rectangle = getUvRectangle(mesh, triangles)
  if (surface.bitmap === null || rectangle === null) return null
  return Object.freeze({
    bitmapPath: surface.bitmapPath,
    bitmap: surface.bitmap,
    rectangle,
    ...getSurfaceSize(mesh, triangles),
  })
}

const getMeanX = (mesh: SceneMesh, triangle: SurfaceTriangle): number =>
  triangle.vertices.reduce((sum, vertex) => sum + (mesh.positions[vertex * 3] ?? 0), 0) /
  triangle.vertices.length

// One arm's triangles split into the sleeve and the hand (the far quarter of its reach).
const getArmParts = (
  mesh: SceneMesh,
  triangles: readonly SurfaceTriangle[],
  side: MinifigSide
): ArmParts => {
  const arm = triangles.filter((triangle) => triangle.boneIndex === ARM_BONES[side])
  const reaches = arm.map((triangle) => getMeanX(mesh, triangle))
  const [nearest, farthest] = reaches.length === 0 ? [0, 0] : getBounds(reaches)
  const handStart = farthest - (farthest - nearest) * HAND_SHARE
  return {
    sleeve: arm.filter((_triangle, index) => (reaches[index] ?? 0) < handStart),
    hand: arm.filter((_triangle, index) => (reaches[index] ?? 0) >= handStart),
  }
}

const RGBA_STRIDE = 4
// Where in a triangle its picture is sampled (barycentric weights): the middle and toward each corner.
const SAMPLE_WEIGHTS: readonly (readonly [number, number, number])[] = Object.freeze([
  [1 / 3, 1 / 3, 1 / 3],
  [2 / 3, 1 / 6, 1 / 6],
  [1 / 6, 2 / 3, 1 / 6],
  [1 / 6, 1 / 6, 2 / 3],
])

// The most common colour a picture shows on some triangles, sampled inside each one (v = 0 is the picture's bottom row, as the
// engine hands the picture to Direct3D) (a bounding rectangle of a sleeve's pieces of the
// chest picture takes in the other sleeve and the gloves).
const getSampledColor = (
  mesh: SceneMesh,
  bitmap: SceneBitmap,
  triangles: readonly SurfaceTriangle[]
): number | null => {
  const samples = triangles.flatMap((triangle) =>
    SAMPLE_WEIGHTS.map((weights) => {
      const [u, v] = [0, 1].map((axis) =>
        triangle.vertices.reduce(
          (sum, vertex, corner) =>
            sum + (weights[corner] ?? 0) * (mesh.textureCoordinates[vertex * 2 + axis] ?? 0),
          0
        )
      )
      const column = Math.min(bitmap.width - 1, Math.max(0, Math.floor((u ?? 0) * bitmap.width)))
      const row = Math.min(
        bitmap.height - 1,
        Math.max(0, Math.floor((1 - (v ?? 0)) * bitmap.height))
      )
      const start = (row * bitmap.width + column) * RGBA_STRIDE
      return bitmap.colors.subarray(start, start + RGBA_STRIDE)
    })
  )
  if (samples.length === 0) return null
  const colors = new Uint8Array(samples.length * RGBA_STRIDE)
  for (const [index, sample] of samples.entries()) colors.set(sample, index * RGBA_STRIDE)
  return getColorShares({ width: samples.length, height: 1, colors })[0]?.color ?? null
}

const findBatchIndex = (surfaces: readonly BatchSurface[], pattern: RegExp): number =>
  surfaces.findIndex((surface) => pattern.test(surface.materialName))

// The colours and pictures the figure builder's model of a driver (`loadBuiltDriverScene`) gives his parts: the skin is the colour the face card is mostly
// printed on, the torso, each sleeve and each hand the dominant colours of the parts of the chest picture they use (a racer's sleeves
// differ, and his gloves are not his skin), and the legs the common
// colours of their picture (a patch of another colour is the hips).
export const readMinifigSurfaces = (model: ModelScene): MinifigSurfaces => {
  const mesh = model.scene.meshes[model.scene.instances[0]?.levels[0]?.meshIndex ?? -1]
  const surfaces = getBatchSurfaces(model)
  const faceIndex = findBatchIndex(surfaces, /dflt$/)
  const chestIndex = findBatchIndex(surfaces, /chst$/)
  const legsIndex = findBatchIndex(surfaces, /leg/)
  const face = surfaces[faceIndex]
  const chest = surfaces[chestIndex]
  const legs = surfaces[legsIndex]
  const skinColor =
    (face?.bitmap == null
      ? null
      : getDominantColor(face.bitmap, getBitmapRegion(FACE_RECTANGLE))) ?? FALLBACK_COLOR
  const chestTriangles = mesh === undefined ? [] : getTriangles(mesh, chestIndex)
  const torsoTriangles = chestTriangles.filter((triangle) => triangle.boneClass === 'torso')
  const getChestColor = (triangles: readonly SurfaceTriangle[]): number | null => {
    const rectangle = mesh === undefined ? null : getUvRectangle(mesh, triangles)
    return chest?.bitmap == null || rectangle === null
      ? null
      : getDominantColor(chest.bitmap, getBitmapRegion(rectangle))
  }
  const torsoFront = torsoTriangles.filter((triangle) => triangle.normalX > FRONT_NORMAL_X)
  const torsoColor = getChestColor(torsoFront) ?? skinColor
  const armParts = MINIFIG_SIDES.map((side) =>
    mesh === undefined ? { sleeve: [], hand: [] } : getArmParts(mesh, chestTriangles, side)
  )
  const getPartColor = (triangles: readonly SurfaceTriangle[]) =>
    mesh === undefined || chest?.bitmap == null
      ? null
      : getSampledColor(mesh, chest.bitmap, triangles)
  const getSideColors = (part: 'sleeve' | 'hand', fallback: number) =>
    Object.freeze({
      left: getPartColor(armParts[0]?.[part] ?? []) ?? fallback,
      right: getPartColor(armParts[1]?.[part] ?? []) ?? fallback,
    })
  const armColors = getSideColors('sleeve', torsoColor)
  const [first, second] = legs?.bitmap == null ? [] : getColorShares(legs.bitmap)
  const legsColor = first?.color ?? FALLBACK_COLOR
  const isTwoTone =
    (first?.share ?? 0) >= TWO_TONE_DOMINANT_SHARE && (second?.share ?? 1) <= TWO_TONE_PATCH_SHARE
  return Object.freeze({
    skinColor,
    torsoColor,
    armColors,
    handColors: getSideColors('hand', skinColor),
    legsColor,
    hipsColor: isTwoTone ? (second?.color ?? legsColor) : legsColor,
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
    torso: mesh === undefined || chest === undefined ? null : getPicture(mesh, chest, torsoFront),
  })
}

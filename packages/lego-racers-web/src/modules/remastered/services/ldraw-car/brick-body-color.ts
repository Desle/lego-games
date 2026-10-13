import { getBrickFaces } from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, CarDesign, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import type { SceneBitmap } from '@lego-games/lego-racers/scene'
import { Vector3 } from 'three'
import { getFaceColorIndex, getIsDecalMaterial } from './game-brick-meshes.ts'

import { LDRAW_BRICK_COLORS } from './ldraw-brick-colors.ts'
import { LDRAW_COMPOSITE_MAPPINGS } from './ldraw-composite-mappings.ts'
import { getLDrawMapping } from './ldraw-car-document.ts'
import type { GameBrickMaterials } from './game-brick-meshes.types.ts'

const PLATE_HEIGHT = 0.4
const UNDERSIDE_FLAGS = 1
const CHANNELS = 4
const BYTE = 255
const RED_SHIFT = 16
const GREEN_SHIFT = 8

const getFaceArea = (corners: readonly Vector3[]): number => {
  const [first, second, third, fourth] = corners
  if (first === undefined || second === undefined || third === undefined) return 0
  const getTriangleArea = (a: Vector3, b: Vector3, c: Vector3) =>
    b.clone().sub(a).cross(c.clone().sub(a)).length() / 2
  return (
    getTriangleArea(first, second, third) +
    (fourth === undefined ? 0 : getTriangleArea(third, second, fourth))
  )
}

// The mean colour of a picture's opaque pixels, as 0xRRGGBB.
export const getMeanPictureColor = (bitmap: SceneBitmap): number => {
  const sums = [0, 0, 0]
  let count = 0
  for (let pixel = 0; pixel < bitmap.width * bitmap.height; pixel += 1) {
    if ((bitmap.colors[pixel * CHANNELS + 3] ?? 0) === 0) continue
    for (let channel = 0; channel < 3; channel += 1) {
      sums[channel] = (sums[channel] ?? 0) + (bitmap.colors[pixel * CHANNELS + channel] ?? 0)
    }
    count += 1
  }
  const [red = 0, green = 0, blue = 0] = sums.map((sum) =>
    Math.round(count === 0 ? BYTE : sum / count)
  )
  return (red << RED_SHIFT) | (green << GREEN_SHIFT) | blue
}

const getChannels = (color: number): readonly number[] => [
  (color >> RED_SHIFT) & BYTE,
  (color >> GREEN_SHIFT) & BYTE,
  color & BYTE,
]

// The brick colour nearest a colour (sRGB distance).
export const getNearestBrickColorIndex = (color: number): number => {
  const target = getChannels(color)
  let nearest = 0
  let nearestDistance = Infinity
  for (const [index, candidate] of LDRAW_BRICK_COLORS.entries()) {
    const channels = getChannels(candidate.hex)
    const distance = channels.reduce(
      (sum, value, channel) => sum + (value - (target[channel] ?? 0)) ** 2,
      0
    )
    if (distance < nearestDistance) {
      nearest = index
      nearestDistance = distance
    }
  }
  return nearest
}

// The colour the original shows most of a brick in: the brick colour where the original paints it, a fixed material's colour (a
// grey grille, a black tyre) where it does not, and for a brick drawn only with pictures (a printed tile) the colour nearest the
// pictures' mean. An LDraw part stands for the whole brick in one colour, so it takes this one.
export const getBrickBodyColorIndex = (
  database: BrickDatabase,
  materials: GameBrickMaterials,
  brick: PlacedBrick
): number => {
  const faces = getBrickFaces(
    database,
    brick.piece,
    { x: 0, y: 0, baseHeight: 0, orientation: 0 },
    materials.colorMaterialIndices[brick.colorIndex] ?? -1
  )
  const areas = new Map<number, number>()
  const pictureAreas = new Map<number, number>()
  for (const face of faces) {
    if (face.flags === UNDERSIDE_FLAGS) continue
    const area = getFaceArea(
      face.vertices.map((vertex) => new Vector3(vertex.x, vertex.y, vertex.z * PLATE_HEIGHT))
    )
    const isPicture = getIsDecalMaterial(materials, face.materialIndex)
    const target = isPicture ? pictureAreas : areas
    const key = isPicture
      ? face.materialIndex
      : getFaceColorIndex(materials, brick.colorIndex, face.materialIndex)
    target.set(key, (target.get(key) ?? 0) + area)
  }
  const getLargest = (entries: ReadonlyMap<number, number>) =>
    [...entries].sort((first, second) => second[1] - first[1])[0]?.[0] ?? null
  const colorIndex = getLargest(areas)
  if (colorIndex !== null) return colorIndex
  const bitmap = materials.materialBitmaps[getLargest(pictureAreas) ?? -1] ?? null
  return bitmap === null ? brick.colorIndex : getNearestBrickColorIndex(getMeanPictureColor(bitmap))
}

// Whether the LDraw drawing stands a library part (or a composite's parts) in for a brick.
export const getIsLDrawBrick = (brick: PlacedBrick): boolean =>
  getLDrawMapping(brick) !== null || LDRAW_COMPOSITE_MAPPINGS[brick.piece.name] !== undefined

// The design with every brick that has LDraw parts in its body colour (the others keep theirs: the game's own mesh colours its faces
// itself).
export const getBodyColoredDesign = (
  database: BrickDatabase,
  materials: GameBrickMaterials,
  design: CarDesign
): CarDesign =>
  Object.freeze({
    ...design,
    bricks: design.bricks.map((brick) =>
      getIsLDrawBrick(brick)
        ? Object.freeze({
            ...brick,
            colorIndex: getBrickBodyColorIndex(database, materials, brick),
          })
        : brick
    ),
  })

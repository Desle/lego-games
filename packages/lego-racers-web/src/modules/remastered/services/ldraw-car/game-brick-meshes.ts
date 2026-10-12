import {
  getBrickColorMaterialIndices,
  getBrickFaces,
  parseBrickColors,
} from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { parseMaterialLibrary } from '@lego-games/lego-racers/material'
import { loadGeometryScene } from '@lego-games/lego-racers/scene'
import type { SceneBitmap } from '@lego-games/lego-racers/scene'
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  Group,
  Mesh,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
} from 'three'
import {
  createPlasticMaterialFromColor,
  createPlasticMaterialFromTexture,
} from './ldraw-plastic.ts'
import { getLDrawBrickColor } from './ldraw-brick-colors.ts'
import type { CarOrigin } from './ldraw-car-document.types.ts'
import type { GameBrickMaterials, GameFaceBucket } from './game-brick-meshes.types.ts'

// A brick height unit of the game, in studs.
const PLATE_HEIGHT = 0.4
// A face whose flags are exactly 1 is a hidden underside (0x00497690).
const UNDERSIDE_FLAGS = 1
const BRICK_DIRECTORY = 'MENUDATA\\PIECEDB'
const BRICK_COLORS_PATH = `${BRICK_DIRECTORY}\\L_COLORS.LEB`
const BRICK_LIBRARY_NAME = 'LPIECELO'
const BRICK_MATERIAL_PATH = `${BRICK_DIRECTORY}\\${BRICK_LIBRARY_NAME}.MDB`
// 0x0049a450: the second material after a colour's is its textured (nubbed) variant, which the game names `<colour>aa`.
const TEXTURED_VARIANT_SUFFIX = 'aa'
const MATERIAL_NAME_LENGTH = 8

const createBucketGeometry = (bucket: GameFaceBucket): BufferGeometry => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(bucket.positions), 3))
  geometry.setAttribute('normal', new BufferAttribute(Float32Array.from(bucket.normals), 3))
  geometry.setAttribute('uv', new BufferAttribute(Float32Array.from(bucket.textureCoordinates), 2))
  return geometry
}

const materialsByArchive = new WeakMap<JamArchive, GameBrickMaterials>()

// The library's pictures through the engine's own loader (an empty model that only links the textures and materials).
const getMaterialBitmaps = (archive: JamArchive): readonly (SceneBitmap | null)[] => {
  const { scene } = loadGeometryScene(
    archive,
    {
      directory: BRICK_DIRECTORY,
      textureNames: [BRICK_LIBRARY_NAME],
      materialNames: [BRICK_LIBRARY_NAME],
      ambientLights: [],
      directionalLights: [],
      bones: null,
    },
    {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      textureCoordinates: new Float32Array(0),
      batches: [],
    }
  )
  return scene.materials.map((material) =>
    material.textureIndex === null ? null : (scene.textures[material.textureIndex]?.bitmap ?? null)
  )
}

// The surface the engine hands Direct3D holds the picture's last row first, so a model's v = 0 is the picture's bottom edge.
const getTextureFromBitmap = (bitmap: SceneBitmap): DataTexture => {
  const rowBytes = bitmap.width * 4
  const colors = new Uint8Array(bitmap.colors.length)
  for (let row = 0; row < bitmap.height; row += 1) {
    colors.set(
      bitmap.colors.subarray(row * rowBytes, (row + 1) * rowBytes),
      (bitmap.height - 1 - row) * rowBytes
    )
  }
  const texture = new DataTexture(colors, bitmap.width, bitmap.height, RGBAFormat)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
  return texture
}

// The faces of a brick are drawn with the colour's material or, for some faces (a chassis' underside, its wheel arches), with
// a fixed material of the library such as `black`: the library's name says which brick colour the fixed material is.
export const getGameBrickMaterials = (archive: JamArchive): GameBrickMaterials => {
  const cached = materialsByArchive.get(archive)
  if (cached !== undefined) return cached
  const colors = parseBrickColors(archive.readFile(BRICK_COLORS_PATH))
  const materialNames = parseMaterialLibrary(archive.readFile(BRICK_MATERIAL_PATH)).materials.map(
    (material) => material.name
  )
  const colorMaterialIndices = getBrickColorMaterialIndices(colors, materialNames)
  const fixedMaterialColors = materialNames.map((name) => {
    const plainName = name.endsWith(TEXTURED_VARIANT_SUFFIX) ? name.slice(0, -2) : name
    return colors.findIndex(
      (color) =>
        color.name.slice(0, MATERIAL_NAME_LENGTH) === plainName.slice(0, MATERIAL_NAME_LENGTH)
    )
  })
  const materialBitmaps = getMaterialBitmaps(archive)
  const materials: GameBrickMaterials = Object.freeze({
    colorMaterialIndices,
    fixedMaterialColors,
    materialBitmaps,
  })
  materialsByArchive.set(archive, materials)
  return materials
}

const getFaceColorIndex = (
  materials: GameBrickMaterials,
  brickColorIndex: number,
  materialIndex: number
): number => {
  const paintedMaterialIndex = materials.colorMaterialIndices[brickColorIndex] ?? -1
  if (materialIndex === paintedMaterialIndex || materialIndex === paintedMaterialIndex + 1)
    return brickColorIndex
  const fixedColorIndex = materials.fixedMaterialColors[materialIndex] ?? -1
  return fixedColorIndex < 0 ? brickColorIndex : fixedColorIndex
}

// The game's own meshes for bricks that no LDraw part stands in for, in the car's frame (studs, z up): one mesh per colour with
// the library's colour for the brick's colour, and one per decal (a material with a picture) with the picture.
export const createGameBrickMeshes = (
  archive: JamArchive,
  database: BrickDatabase,
  bricks: readonly PlacedBrick[],
  origin: CarOrigin
): Group => {
  const group = new Group()
  const materials = getGameBrickMaterials(archive)
  const bucketsByColor = new Map<number, GameFaceBucket>()
  const bucketsByDecal = new Map<number, GameFaceBucket>()
  for (const brick of bricks) {
    const faces = getBrickFaces(
      database,
      brick.piece,
      { x: brick.x, y: brick.y, baseHeight: brick.baseHeight, orientation: brick.orientation },
      materials.colorMaterialIndices[brick.colorIndex] ?? -1
    )
    for (const face of faces) {
      if (face.flags === UNDERSIDE_FLAGS) continue
      const [first, second, third, fourth] = face.vertices
      if (first === undefined || second === undefined || third === undefined) continue
      const isDecal =
        (materials.materialBitmaps[face.materialIndex] ?? null) !== null &&
        (materials.fixedMaterialColors[face.materialIndex] ?? -1) < 0
      const buckets = isDecal ? bucketsByDecal : bucketsByColor
      const key = isDecal
        ? face.materialIndex
        : getFaceColorIndex(materials, brick.colorIndex, face.materialIndex)
      const bucket = buckets.get(key) ?? { positions: [], normals: [], textureCoordinates: [] }
      buckets.set(key, bucket)
      const triangles =
        fourth === undefined
          ? [[first, second, third]]
          : [
              [first, second, third],
              [third, second, fourth],
            ]
      for (const triangle of triangles) {
        for (const vertex of triangle) {
          bucket.positions.push(
            vertex.x + origin.x,
            vertex.y + origin.y,
            vertex.z * PLATE_HEIGHT + origin.z
          )
          bucket.normals.push(vertex.normalX, vertex.normalY, vertex.normalZ)
          bucket.textureCoordinates.push(vertex.u, vertex.v)
        }
      }
    }
  }
  for (const [colorIndex, bucket] of bucketsByColor) {
    const material = createPlasticMaterialFromColor(getLDrawBrickColor(colorIndex).hex)
    group.add(new Mesh(createBucketGeometry(bucket), material))
  }
  for (const [materialIndex, bucket] of bucketsByDecal) {
    const bitmap = materials.materialBitmaps[materialIndex]
    if (bitmap === null || bitmap === undefined) continue
    const material = createPlasticMaterialFromTexture(getTextureFromBitmap(bitmap))
    group.add(new Mesh(createBucketGeometry(bucket), material))
  }
  return group
}

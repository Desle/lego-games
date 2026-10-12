import {
  getBrickColorMaterialIndices,
  getBrickFaces,
  parseBrickColors,
} from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { parseMaterialLibrary } from '@lego-games/lego-racers/material'
import { BufferAttribute, BufferGeometry, Group, Mesh } from 'three'
import { createPlasticMaterialFromColor } from './ldraw-plastic.ts'
import { getLDrawBrickColor } from './ldraw-brick-colors.ts'
import type { CarOrigin } from './ldraw-car-document.types.ts'
import type { GameBrickMaterials } from './game-brick-meshes.types.ts'

// A brick height unit of the game, in studs.
const PLATE_HEIGHT = 0.4
// A face whose flags are exactly 1 is a hidden underside (0x00497690).
const UNDERSIDE_FLAGS = 1
const BRICK_DIRECTORY = 'MENUDATA\\PIECEDB'
const BRICK_COLORS_PATH = `${BRICK_DIRECTORY}\\L_COLORS.LEB`
const BRICK_MATERIAL_PATH = `${BRICK_DIRECTORY}\\LPIECELO.MDB`
// 0x0049a450: the second material after a colour's is its textured (nubbed) variant, which the game names `<colour>aa`.
const TEXTURED_VARIANT_SUFFIX = 'aa'
const MATERIAL_NAME_LENGTH = 8

const materialsByArchive = new WeakMap<JamArchive, GameBrickMaterials>()

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
  const materials: GameBrickMaterials = Object.freeze({ colorMaterialIndices, fixedMaterialColors })
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

// The game's own meshes for bricks that no LDraw part stands in for, in the car's frame (studs, z up), one mesh per colour,
// with the library's colour for the brick's colour.
export const createGameBrickMeshes = (
  archive: JamArchive,
  database: BrickDatabase,
  bricks: readonly PlacedBrick[],
  origin: CarOrigin
): Group => {
  const group = new Group()
  const materials = getGameBrickMaterials(archive)
  const positionsByColor = new Map<number, number[]>()
  const normalsByColor = new Map<number, number[]>()
  for (const brick of bricks) {
    const faces = getBrickFaces(
      database,
      brick.piece,
      { x: brick.x, y: brick.y, baseHeight: brick.baseHeight, orientation: brick.orientation },
      materials.colorMaterialIndices[brick.colorIndex] ?? -1
    )
    for (const face of faces) {
      if (face.flags === UNDERSIDE_FLAGS) continue
      const colorIndex = getFaceColorIndex(materials, brick.colorIndex, face.materialIndex)
      const positions = positionsByColor.get(colorIndex) ?? []
      const normals = normalsByColor.get(colorIndex) ?? []
      positionsByColor.set(colorIndex, positions)
      normalsByColor.set(colorIndex, normals)
      const [first, second, third, fourth] = face.vertices
      if (first === undefined || second === undefined || third === undefined) continue
      const triangles =
        fourth === undefined
          ? [[first, second, third]]
          : [
              [first, second, third],
              [third, second, fourth],
            ]
      for (const triangle of triangles) {
        for (const vertex of triangle) {
          positions.push(
            vertex.x + origin.x,
            vertex.y + origin.y,
            vertex.z * PLATE_HEIGHT + origin.z
          )
          normals.push(vertex.normalX, vertex.normalY, vertex.normalZ)
        }
      }
    }
  }
  for (const [colorIndex, positions] of positionsByColor) {
    const normals = normalsByColor.get(colorIndex) ?? []
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3))
    geometry.setAttribute('normal', new BufferAttribute(Float32Array.from(normals), 3))
    const material = createPlasticMaterialFromColor(getLDrawBrickColor(colorIndex).hex)
    group.add(new Mesh(geometry, material))
  }
  return group
}

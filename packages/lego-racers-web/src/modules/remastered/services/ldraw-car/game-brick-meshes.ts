import { getBrickFaces } from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { getLDrawBrickColor } from './ldraw-brick-colors.ts'
import type { CarOrigin } from './ldraw-car-document.types.ts'

// A brick height unit of the game, in studs.
const PLATE_HEIGHT = 0.4
// A face whose flags are exactly 1 is a hidden underside (0x00497690).
const UNDERSIDE_FLAGS = 1
const MATERIAL_ROUGHNESS = 0.35

// The game's own meshes for bricks that no LDraw part stands in for, in the car's frame (studs, z up), one mesh per colour,
// with the library's colour for the brick's colour.
export const createGameBrickMeshes = (
  database: BrickDatabase,
  bricks: readonly PlacedBrick[],
  origin: CarOrigin
): Group => {
  const group = new Group()
  const colorIndices = [...new Set(bricks.map((brick) => brick.colorIndex))]
  for (const colorIndex of colorIndices) {
    const positions: number[] = []
    const normals: number[] = []
    for (const brick of bricks.filter((candidate) => candidate.colorIndex === colorIndex)) {
      const faces = getBrickFaces(
        database,
        brick.piece,
        { x: brick.x, y: brick.y, baseHeight: brick.baseHeight, orientation: brick.orientation },
        colorIndex
      )
      for (const face of faces) {
        if (face.flags === UNDERSIDE_FLAGS) continue
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
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3))
    geometry.setAttribute('normal', new BufferAttribute(Float32Array.from(normals), 3))
    const material = new MeshStandardMaterial({
      color: getLDrawBrickColor(colorIndex).hex,
      roughness: MATERIAL_ROUGHNESS,
      side: DoubleSide,
    })
    group.add(new Mesh(geometry, material))
  }
  return group
}

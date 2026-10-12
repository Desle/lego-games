import { BufferAttribute, BufferGeometry, Group, Mesh } from 'three'
import { getLDrawBrickColor } from '../ldraw-car/ldraw-brick-colors.ts'
import { createPlasticMaterialFromColor } from '../ldraw-car/ldraw-plastic.ts'
import { getBrickColorIndex } from './body-colors.ts'
import type { ChampionBodyFaces } from './opponent-car.types.ts'

const COORDINATES_PER_TRIANGLE = 9

// The triangles of the body that no brick stands in for (the chassis frame and the thin fittings), in the plastic of the library:
// one mesh per brick colour, each triangle in the colour its corners' colours stand for.
export const createBodyResidualMeshes = (
  faces: ChampionBodyFaces,
  coveredTriangles: readonly number[]
): Group => {
  const covered = new Set(coveredTriangles)
  const positionsByColor = new Map<number, number[]>()
  const triangleCount = Math.floor(faces.positions.length / COORDINATES_PER_TRIANGLE)
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    if (covered.has(triangle)) continue
    const colorIndex = getBrickColorIndex(
      faces.colors[triangle * 3] ?? 0,
      faces.colors[triangle * 3 + 1] ?? 0,
      faces.colors[triangle * 3 + 2] ?? 0
    )
    const positions = positionsByColor.get(colorIndex) ?? []
    positionsByColor.set(colorIndex, positions)
    positions.push(
      ...faces.positions.subarray(
        triangle * COORDINATES_PER_TRIANGLE,
        (triangle + 1) * COORDINATES_PER_TRIANGLE
      )
    )
  }
  const group = new Group()
  for (const [colorIndex, positions] of positionsByColor) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3))
    geometry.computeVertexNormals()
    group.add(
      new Mesh(geometry, createPlasticMaterialFromColor(getLDrawBrickColor(colorIndex).hex))
    )
  }
  return group
}

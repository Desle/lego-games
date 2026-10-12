import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'
import { createBodyDecalMeshes } from './body-decals.ts'
import type { ChampionBodyFaces } from './opponent-car.types.ts'

const CORNERS_PER_TRIANGLE = 3
const COLOR_RANGE = 255

// The champion's body model as the game shows it: the triangles with the colours the model gives them, and the printed faces. For
// the developer's gallery (the original's own drawing is the track viewer's).
export const createChampionBodyGameMesh = (faces: ChampionBodyFaces): Group => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(faces.positions, 3))
  const colors = new Float32Array(faces.positions.length)
  for (let index = 0; index < colors.length; index += 1) {
    const triangle = Math.floor(index / (CORNERS_PER_TRIANGLE * 3))
    const channel = index % 3
    colors[index] = (faces.colors[triangle * 3 + channel] ?? 0) / COLOR_RANGE
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  const group = new Group()
  group.add(new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })))
  group.add(createBodyDecalMeshes(faces.decals))
  return group
}

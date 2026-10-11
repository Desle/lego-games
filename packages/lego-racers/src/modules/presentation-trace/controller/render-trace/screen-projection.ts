import type { OriginalRenderFrame } from '../../types/presentation-trace.types.ts'
import type {
  DrawnTriangle,
  MatrixCount,
  ProjectedVertex,
  ScreenMatrix,
  ScreenTriangle,
  WorldTriangle,
  WorldVertex,
} from './render-trace.types.ts'

const MATRIX_KEY_DIGITS = 3
const MATRIX_SIZE = 16

// GolDP.dll 0x1000ebd0 keeps a triangle when this is negative (pixels, y down): its corners turn counter-clockwise
// on screen, which is the front face of the viewer's three.js materials.
export const getTurn = (triangle: ScreenTriangle): number => {
  const [first, second, third] = triangle
  return (third.x - second.x) * (first.y - second.y) - (first.x - second.x) * (third.y - second.y)
}

export const getIsFrontFacing = (triangle: ScreenTriangle): boolean => getTurn(triangle) < 0

// The matrices the original drew with, the ones with most triangles first. The track and the objects that stand in the
// world have the identity as model matrix, so theirs is the world to screen matrix of the camera (device +0xc8518); the
// caller picks the candidate under which the port's world lands on the original's triangles.
export const getCandidateMatrices = (
  frame: OriginalRenderFrame,
  limit: number
): readonly ScreenMatrix[] => {
  const counts = new Map<string, MatrixCount>()
  for (const draw of frame.draws) {
    if (draw.modelMatrix.length !== MATRIX_SIZE) continue
    const key = draw.modelMatrix.map((value) => value.toFixed(MATRIX_KEY_DIGITS)).join(' ')
    const triangleCount = (draw.indices?.length ?? draw.vertices.length) / 3
    const entry = counts.get(key) ?? { matrix: draw.modelMatrix, triangleCount: 0 }
    counts.set(key, { matrix: entry.matrix, triangleCount: entry.triangleCount + triangleCount })
  }
  return [...counts.values()]
    .sort((left, right) => right.triangleCount - left.triangleCount)
    .slice(0, limit)
    .map((entry) => entry.matrix)
}

const projectVertex = (vertex: WorldVertex, matrix: ScreenMatrix): ProjectedVertex => {
  const at = (index: number): number => matrix[index] ?? 0
  const clipX = vertex.x * at(0) + vertex.y * at(4) + vertex.z * at(8) + at(12)
  const clipY = vertex.x * at(1) + vertex.y * at(5) + vertex.z * at(9) + at(13)
  const clipW = vertex.x * at(3) + vertex.y * at(7) + vertex.z * at(11) + at(15)
  return Object.freeze({
    x: clipX / clipW,
    y: clipY / clipW,
    reciprocalW: 1 / clipW,
    u: vertex.u,
    v: vertex.v,
    diffuse: vertex.diffuse,
    clipW,
  })
}

// A world triangle as the original's transform and cull would hand it to Direct3D: projected with the world to screen
// matrix, dropped when a corner is behind the camera or the triangle faces away, and in the order 0x1000ebd0 emits it.
export const projectWorldTriangle = (
  triangle: WorldTriangle,
  matrix: ScreenMatrix
): DrawnTriangle | null => {
  const [first, second, third] = triangle.vertices.map((vertex) => projectVertex(vertex, matrix))
  if (first === undefined || second === undefined || third === undefined) return null
  if (first.clipW <= 0 || second.clipW <= 0 || third.clipW <= 0) return null
  if (!getIsFrontFacing([first, second, third])) return null
  return Object.freeze({
    vertices: [third, second, first] as const,
    textureKey: triangle.textureKey,
    state: triangle.state,
    source: triangle.source,
  })
}

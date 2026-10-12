import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type {
  DecalFrame,
  DecalLimits,
  DecalPolygonVertex,
  DecalTriangle,
  DecalVertex,
  DecalWorld,
} from '../../types/decal.types.ts'
import { getDecalLeaves, getDecalQueryPoints } from '../get-decal-leaves/get-decal-leaves.ts'
import { getDecalMapping, getDecalVertex } from './decal-mapping.ts'
import { clipDecalPolygon } from './clip-decal-polygon.ts'

const { subtract, multiply, add } = createFloatArithmetic(RACE_FPU_PRECISION)

// 0x0043d9cc asks 0x00414950 for 16 triangles.
export const SHADOW_DECAL_LIMITS: DecalLimits = Object.freeze({ maximumTriangles: 16 })

// 0x00414fd1: a face whose corners run clockwise in the picture is on the far side of the decal and is dropped:
// (u1 - u2)(v0 - v2) - (v1 - v2)(u0 - u2) must be positive.
const getIsFacingDecal = (first: DecalVertex, second: DecalVertex, third: DecalVertex): boolean =>
  subtract(
    multiply(subtract(second.u, third.u), subtract(first.v, third.v)),
    multiply(subtract(second.v, third.v), subtract(first.u, third.u))
  ) > 0

// 0x00414f40 for one face: out-codes decide at once what is wholly outside (a common bit) or wholly inside (none), the
// rest is clipped against the picture's edges and fanned into triangles.
const getFaceTriangles = (
  corners: readonly [DecalPolygonVertex, DecalPolygonVertex, DecalPolygonVertex]
): readonly DecalTriangle[] => {
  const [first, second, third] = corners
  if ((first.code & second.code & third.code) !== 0) return []
  if (!getIsFacingDecal(first, second, third)) return []
  const polygon =
    (first.code | second.code | third.code) === 0 ? corners : clipDecalPolygon(corners)
  const [origin, ...rest] = polygon
  if (origin === undefined) return []
  return rest.slice(0, -1).map((vertex, index): DecalTriangle => {
    const next = rest[index + 1]
    return Object.freeze([origin, vertex, next ?? vertex] as const)
  })
}

// 0x00414a30 (decal, world): the triangles of the world's faces that the decal's box reaches, mapped onto the picture.
// The world's BSP tree names the leaves (0x00403cc0); every batch whose run of commands lies in a leaf and whose
// material takes decals (flag 0x20000) is tested face by face; at most `maximumTriangles` come out.
export const projectDecal = (
  world: DecalWorld,
  frame: DecalFrame,
  limits: DecalLimits = SHADOW_DECAL_LIMITS
): readonly DecalTriangle[] => {
  const mapping = getDecalMapping(frame)
  const leaves = getDecalLeaves(world.tree, getDecalQueryPoints(frame))
  const triangles: DecalTriangle[] = []
  for (const leafIndex of leaves) {
    const leaf = world.tree.nodes[leafIndex]
    if (leaf === undefined) continue
    const [firstCommand, commandCount] = leaf.keyword29Values
    // A leaf with no count covers all of the model's commands.
    const commandEnd =
      commandCount === 0 ? Number.POSITIVE_INFINITY : add(firstCommand, commandCount)
    for (const batch of world.batches) {
      if (
        !batch.isReceiver ||
        batch.firstCommand < firstCommand ||
        batch.firstCommand >= commandEnd
      ) {
        continue
      }
      for (const face of batch.faces) {
        const corners = face.map((vertexIndex) =>
          getDecalVertex(mapping, world.positions, vertexIndex)
        )
        const [first, second, third] = corners
        if (first === undefined || second === undefined || third === undefined) continue
        for (const triangle of getFaceTriangles([first, second, third])) {
          if (triangles.length >= limits.maximumTriangles) return triangles
          triangles.push(triangle)
        }
      }
    }
  }
  return triangles
}

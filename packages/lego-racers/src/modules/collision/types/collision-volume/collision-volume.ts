import { getUnsignedShort } from '../../../../shared/binary-values/binary-values.ts'
import type { BspVolume, BspVolumeVector } from '../../../bsp-volume/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type {
  CollisionObject,
  CollisionVolume,
  CollisionVolumeNode,
  CollisionVolumeTriangle,
} from '../collision.types.ts'

const getVector = (vector: BspVolumeVector): Vector3 =>
  Object.freeze({ x: vector[0], y: vector[1], z: vector[2] })

// The parsed BVB as the race code reads it (0x00403fa0): unsigned 16-bit indices and counts.
export const createCollisionVolume = (volume: BspVolume): CollisionVolume => {
  const nodes = volume.nodes.map((node): CollisionVolumeNode =>
    Object.freeze({
      normal: getVector(node.vector),
      firstTriangleIndex: getUnsignedShort(node.shortValues[0]),
      triangleCount: getUnsignedShort(node.shortValues[1]),
      positiveChildIndex: getUnsignedShort(node.childIndices[0]),
      negativeChildIndex: getUnsignedShort(node.childIndices[1]),
    })
  )
  const triangles = volume.keyword2dEntries.map(
    ([first, second, third, material]): CollisionVolumeTriangle =>
      Object.freeze({
        vertexIndices: Object.freeze([
          getUnsignedShort(first),
          getUnsignedShort(second),
          getUnsignedShort(third),
        ] as const),
        materialIndex: getUnsignedShort(material),
      })
  )
  return Object.freeze({
    nodes: Object.freeze(nodes),
    vertices: Object.freeze(volume.keyword34Vectors.map(getVector)),
    triangles: Object.freeze(triangles),
    materialNames: volume.materialNames,
  })
}

// FLD, FCHS, FSTP: negating a float32 is exact.
const getMirroredVector = (vector: Vector3): Vector3 => Object.freeze({ ...vector, y: -vector.y })

// 0x004045e0, run on every world BVB instance's volume (0x00403f80 from 0x00416140) when the race
// is mirrored (Race_LoadRaceDescription 0x00431e00 passes its mirror argument to 0x00432e20):
// negates y of every node normal and vertex, and swaps each triangle's second and third vertex.
export const getMirroredCollisionVolume = (volume: CollisionVolume): CollisionVolume =>
  Object.freeze({
    ...volume,
    nodes: Object.freeze(
      volume.nodes.map((node) => Object.freeze({ ...node, normal: getMirroredVector(node.normal) }))
    ),
    vertices: Object.freeze(volume.vertices.map(getMirroredVector)),
    triangles: Object.freeze(
      volume.triangles.map(({ vertexIndices: [first, second, third], materialIndex }) =>
        Object.freeze({
          vertexIndices: Object.freeze([first, third, second] as const),
          materialIndex,
        })
      )
    ),
  })

// The query reads the material from the list at BVB object +0x24, which the caller points at the
// instance's own list (+0x5c) when it has one and at the volume's (+0x18) otherwise.
export const getCollisionMaterialName = (
  object: CollisionObject,
  materialIndex: number
): string | undefined => (object.materialNames ?? object.volume.materialNames)[materialIndex]

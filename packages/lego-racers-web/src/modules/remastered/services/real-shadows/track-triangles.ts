import type { SceneRenderState } from '@lego-games/lego-racers/scene'
import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import { Matrix3, Mesh, Vector3 } from 'three'
import type { BufferAttribute, BufferGeometry, Group, Material, Object3D } from 'three'
import type { Accumulator, TriangleSamples } from './real-shadows.types.ts'

const BYTE_MAXIMUM = 255
const RED_WEIGHT = 0.299
const GREEN_WEIGHT = 0.587
const BLUE_WEIGHT = 0.114
const MINIMUM_AREA = 1e-6
const CORNERS_PER_TRIANGLE = 3

export const getInstanceKind = (object: Object3D): string | null => {
  const kind: unknown = object.userData['instanceKind']
  return typeof kind === 'string' ? kind : null
}

// Only a prelit, opaque, vertex-coloured material carries the baked light in its vertices.
const getIsBakedMaterial = (material: Material): boolean => {
  const renderState = material.userData['renderState'] as SceneRenderState | undefined
  return renderState !== undefined && !renderState.isBlendEnabled && !renderState.isDiffuseWhite
}

const addGeometryTriangles = (
  geometry: BufferGeometry,
  instanceMatrix: Matrix3,
  positionTransform: Object3D,
  accumulator: Accumulator,
  group: number
) => {
  const positions = geometry.getAttribute('position') as BufferAttribute
  const colors = geometry.getAttribute('color') as BufferAttribute
  const first = new Vector3()
  const second = new Vector3()
  const third = new Vector3()
  const edge = new Vector3()
  const otherEdge = new Vector3()
  for (let corner = 0; corner + 2 < positions.count; corner += CORNERS_PER_TRIANGLE) {
    first.fromBufferAttribute(positions, corner).applyMatrix4(positionTransform.matrix)
    second.fromBufferAttribute(positions, corner + 1).applyMatrix4(positionTransform.matrix)
    third.fromBufferAttribute(positions, corner + 2).applyMatrix4(positionTransform.matrix)
    const normal = edge.subVectors(second, first).cross(otherEdge.subVectors(third, first))
    const area = normal.length() / 2
    if (area < MINIMUM_AREA) continue
    normal.normalize().applyMatrix3(instanceMatrix)
    let brightness = 0
    for (let offset = 0; offset < CORNERS_PER_TRIANGLE; offset += 1) {
      brightness +=
        RED_WEIGHT * colors.getX(corner + offset) +
        GREEN_WEIGHT * colors.getY(corner + offset) +
        BLUE_WEIGHT * colors.getZ(corner + offset)
    }
    accumulator.normals.push(normal.x, normal.y, normal.z)
    accumulator.brightness.push(
      brightness / CORNERS_PER_TRIANGLE / (colors.normalized ? 1 : BYTE_MAXIMUM)
    )
    accumulator.weights.push(area)
    accumulator.groups.push(group)
  }
}

// The baked triangles of the track's static instances, with their outward normals in the track's own frame. The face winding
// is counter-clockwise for the viewer, so the right-hand normal points out of the surface.
export const getTrackTriangles = (trackGroup: Group): TriangleSamples => {
  const accumulator: Accumulator = { normals: [], brightness: [], weights: [], groups: [] }
  const groupIndices = new Map<Material, number>()
  for (const instance of trackGroup.children) {
    if (getInstanceKind(instance) === SceneInstanceKind.SKELETON) continue
    const rotation = new Matrix3().setFromMatrix4(instance.matrix)
    for (const child of instance.children) {
      if (!(child instanceof Mesh)) continue
      const geometry = child.geometry as BufferGeometry
      if (geometry.userData['isPrelit'] !== true) continue
      const material = child.material as Material
      if (!getIsBakedMaterial(material)) continue
      const group = groupIndices.get(material) ?? groupIndices.size
      groupIndices.set(material, group)
      addGeometryTriangles(geometry, rotation, instance, accumulator, group)
    }
  }
  return {
    normals: Float32Array.from(accumulator.normals),
    brightness: Float32Array.from(accumulator.brightness),
    weights: Float32Array.from(accumulator.weights),
    groups: Uint16Array.from(accumulator.groups),
    groupCount: groupIndices.size,
  }
}

import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import type { BspPlane } from '@lego-games/lego-racers/bsp-tree'
import type { FrustumView } from './race-viewport.types.ts'

// The race camera as the engine builds its frustum (traced from the object at device +0x4c): a 65 degree vertical
// field of view, the window's aspect, the near plane at 5 and the far plane at 800 units.
export const ORIGINAL_FIELD_OF_VIEW_DEGREES = 65
export const ORIGINAL_NEAR_PLANE = 5
export const ORIGINAL_FAR_PLANE = 800

const getPlane = (normal: Vector3, eye: Vector3, distanceAlongNormal: number): BspPlane => {
  const unit = normal.clone().normalize()
  return [unit.x, unit.y, unit.z, distanceAlongNormal - unit.dot(eye)]
}

// The six planes, normals pointing inside: left, right, bottom, top, near, far (a point is inside when
// normal . point + offset is not negative).
export const getCameraFrustum = (camera: PerspectiveCamera): FrustumView => {
  camera.updateMatrixWorld()
  const eye = new Vector3().setFromMatrixPosition(camera.matrixWorld)
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  const forward = new Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate()
  const tangentVertical = Math.tan((ORIGINAL_FIELD_OF_VIEW_DEGREES * Math.PI) / 360)
  const tangentHorizontal = tangentVertical * camera.aspect
  const planes: readonly BspPlane[] = [
    getPlane(right.clone().add(forward.clone().multiplyScalar(tangentHorizontal)), eye, 0),
    getPlane(right.clone().negate().add(forward.clone().multiplyScalar(tangentHorizontal)), eye, 0),
    getPlane(up.clone().add(forward.clone().multiplyScalar(tangentVertical)), eye, 0),
    getPlane(up.clone().negate().add(forward.clone().multiplyScalar(tangentVertical)), eye, 0),
    getPlane(forward, eye, -ORIGINAL_NEAR_PLANE),
    getPlane(forward.clone().negate(), eye, ORIGINAL_FAR_PLANE),
  ]
  return Object.freeze({ eye: Object.freeze({ x: eye.x, y: eye.y, z: eye.z }), planes })
}

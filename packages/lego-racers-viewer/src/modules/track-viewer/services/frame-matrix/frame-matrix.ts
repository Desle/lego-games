import type { Matrix3 } from '@lego-games/lego-racers/simulation-math'
import { Matrix4 } from 'three'
import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'

// Rows of a frame's rotation are the images of the model's axes; three.js takes them as columns.
export const getFrameMatrix = (rotation: Matrix3, position: Vector3Like): Matrix4 => {
  const [forwardX, forwardY, forwardZ, sideX, sideY, sideZ, upX, upY, upZ] = rotation
  const { x, y, z } = position
  return new Matrix4().set(
    forwardX,
    sideX,
    upX,
    x,
    forwardY,
    sideY,
    upY,
    y,
    forwardZ,
    sideZ,
    upZ,
    z,
    0,
    0,
    0,
    1
  )
}

// 0x00410900 (figure slot 0x40): the frame with `forward` as its first row and the world up axis made perpendicular to it
// as the third; the second row is their cross product.
export const getUprightRotation = (forward: Vector3Like): Matrix3 => {
  const length = Math.hypot(forward.x, forward.y, forward.z)
  const [forwardX, forwardY, forwardZ] = [forward.x / length, forward.y / length, forward.z / length]
  const upProjection = forwardZ
  const rawUp = [-forwardX * upProjection, -forwardY * upProjection, 1 - forwardZ * upProjection] as const
  const upLength = Math.hypot(...rawUp)
  const [upX, upY, upZ] = [rawUp[0] / upLength, rawUp[1] / upLength, rawUp[2] / upLength]
  return Object.freeze([
    forwardX,
    forwardY,
    forwardZ,
    upY * forwardZ - upZ * forwardY,
    upZ * forwardX - forwardZ * upX,
    forwardY * upX - upY * forwardX,
    upX,
    upY,
    upZ,
  ]) as Matrix3
}

import { parseBspVolume } from '../../../bsp-volume/index.ts'
import { IDENTITY_MATRIX3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import {
  createCollisionVolume,
  getMirroredCollisionVolume,
} from '../../types/collision-volume/collision-volume.ts'
import type { CollisionObject, CollisionObjectSource } from '../../types/collision.types.ts'

const ORIGIN_FRAME = Object.freeze({ rotation: IDENTITY_MATRIX3, position: ZERO_VECTOR3 })

// A world BVB instance as a car rigid body's collision list holds it: the .BVB parsed by
// GolDP.dll 0x1001b800, mirrored by 0x004045e0 when the race is mirrored. The instance frame's own
// mirror (0x00411040) is not ported, so a mirrored race needs a frame without rotation.
export const loadCollisionObject = (source: CollisionObjectSource): CollisionObject => {
  const volume = createCollisionVolume(parseBspVolume(source.bytes))
  return Object.freeze({
    frame: source.frame ?? ORIGIN_FRAME,
    volume: source.isMirrored ? getMirroredCollisionVolume(volume) : volume,
    materialNames: undefined,
  })
}

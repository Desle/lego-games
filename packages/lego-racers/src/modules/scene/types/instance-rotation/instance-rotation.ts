import type { SceneRotation, SceneVector } from '../scene.types.ts'

const { fround } = Math

// GolDP.dll 0x1002f530: scales to unit length; a zero vector stays zero.
const getNormalized = (vector: SceneVector): SceneVector => {
  const length = Math.sqrt(vector.z * vector.z + vector.y * vector.y + vector.x * vector.x)
  if (length === 0) return Object.freeze({ x: 0, y: 0, z: 0 })
  const inverseLength = 1 / length
  return Object.freeze({
    x: fround(inverseLength * vector.x),
    y: fround(inverseLength * vector.y),
    z: fround(inverseLength * vector.z),
  })
}

// GolDP.dll 0x10026b50 (instance vtable +0x40): forward is normalised, up made orthogonal to it and
// normalised; the rows are forward, up × forward, up.
export const getInstanceRotation = (forward: SceneVector, up: SceneVector): SceneRotation => {
  const first = getNormalized(forward)
  const dot = first.x * up.x + first.z * up.z + up.y * first.y
  const third = getNormalized({
    x: fround(up.x - fround(first.x * dot)),
    y: fround(up.y - fround(first.y * dot)),
    z: fround(up.z - dot * first.z),
  })
  return Object.freeze([
    first.x,
    first.y,
    first.z,
    fround(third.y * first.z - third.z * first.y),
    fround(third.z * first.x - first.z * third.x),
    fround(first.y * third.x - third.y * first.x),
    third.x,
    third.y,
    third.z,
  ])
}

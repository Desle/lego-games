import type { GltfQuaternion } from '../../services/gltf-builder/gltf-builder.types.ts'

// A quarter turn about X taking the engine's up axis (+Z) to glTF's (+Y).
export const Z_UP_TO_Y_UP: GltfQuaternion = Object.freeze([
  -Math.SQRT1_2,
  0,
  0,
  Math.SQRT1_2,
] as const)

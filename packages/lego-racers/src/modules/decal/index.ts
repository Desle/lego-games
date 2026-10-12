export { createDecalFrame } from './controller/create-decal-frame/create-decal-frame.ts'
export {
  getDecalLeaves,
  getDecalQueryPoints,
} from './controller/get-decal-leaves/get-decal-leaves.ts'
export { projectDecal, SHADOW_DECAL_LIMITS } from './controller/project-decal/project-decal.ts'
export type {
  DecalFaceBatch,
  DecalFrame,
  DecalLimits,
  DecalPlacement,
  DecalTriangle,
  DecalVertex,
  DecalWorld,
} from './types/decal.types.ts'

export {
  addSkidTrailPoint,
  allocateSkidTrail,
  createSkidTrailPool,
  getSkidTrailKind,
  getSkidTrailMeshes,
  releaseSkidTrail,
  SKID_TRAIL_COUNT,
  stepSkidTrailPool,
} from './controller/skid-trails/skid-trails.ts'
export type {
  SkidTrail,
  SkidTrailAllocation,
  SkidTrailMesh,
  SkidTrailPool,
  SkidTrailRequest,
} from './types/skid-trail.types.ts'

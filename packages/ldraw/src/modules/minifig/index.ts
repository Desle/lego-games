export { MINIFIG_GEOMETRY, MINIFIG_SIDES } from './services/minifig-geometry/minifig-geometry.ts'
export type {
  MinifigHinge,
  MinifigSide,
} from './services/minifig-geometry/minifig-geometry.types.ts'
export {
  MINIFIG_JOINT_LIMITS,
  createMinifigPose,
  getHingeAngle,
  getTwistAngle,
  poseMinifig,
} from './services/minifig-pose/minifig-pose.ts'
export { MinifigJoint } from './services/minifig-pose/minifig-pose.types.ts'
export type {
  MinifigJointAngles,
  MinifigPose,
  MinifigPoseMatrices,
  MinifigSwingJoint,
} from './services/minifig-pose/minifig-pose.types.ts'
export { findMinifigRole, getMinifigRoles } from './services/minifig-roles/minifig-roles.ts'
export { MinifigRole } from './services/minifig-roles/minifig-roles.types.ts'
export type {
  MinifigPartPlacement,
  MinifigPartWithRole,
} from './services/minifig-roles/minifig-roles.types.ts'

import type { Matrix4 } from 'three'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { MinifigRole } from '../minifig-roles/minifig-roles.types.ts'

// The hinges a LEGO minifigure turns on: the neck, each leg on the hip axle, each arm on its shoulder pin, each hand on its wrist pin.
export const MinifigJoint = createEnum({
  NECK: 'neck',
  LEFT_HIP: 'left_hip',
  RIGHT_HIP: 'right_hip',
  LEFT_SHOULDER: 'left_shoulder',
  RIGHT_SHOULDER: 'right_shoulder',
  LEFT_WRIST: 'left_wrist',
  RIGHT_WRIST: 'right_wrist',
})
export type MinifigJoint = EnumValues<typeof MinifigJoint>

// The joints a part swings on toward a direction; a hand only twists on its pin.
export type MinifigSwingJoint = Exclude<
  MinifigJoint,
  typeof MinifigJoint.LEFT_WRIST | typeof MinifigJoint.RIGHT_WRIST
>

// The turns a hinge allows, radians from the assembled standing figure.
export type MinifigJointLimit = {
  readonly minimum: number
  readonly maximum: number
}

export type MinifigJointLimits = {
  readonly leg: MinifigJointLimit
  readonly arm: MinifigJointLimit
  readonly neck: MinifigJointLimit
  readonly wrist: MinifigJointLimit
}

export type MinifigJointAngles = Readonly<Record<MinifigJoint, number>>

// A pose of the figure: the turn of each hinge from the assembled figure, and where the hips and torso (one rigid piece) are.
export type MinifigPose = {
  readonly root: Matrix4
  readonly angles: MinifigJointAngles
}

// Each role's matrix, which takes a part placed in the assembled figure to where the pose puts it.
export type MinifigPoseMatrices = Readonly<Record<MinifigRole, Matrix4>>

import type { MinifigPartKey } from './minifig-assembly.types.ts'

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

// The parts of one side of the figure.
export type MinifigSideParts = {
  readonly leg: MinifigPartKey
  readonly arm: MinifigPartKey
  readonly hand: MinifigPartKey
}

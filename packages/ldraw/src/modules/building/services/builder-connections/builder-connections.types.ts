import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { BuilderPartLine, Vector } from '../../types/building.types.ts'

// What joins two parts: a stud in a part's bottom (or a hat's socket), and the minifigure's joints: the head on the neck, the torso on
// the hips, the legs on the hip axle, each arm on its shoulder, a hand on a wrist, headgear on the head's stud, a tool in a hand.
export const ConnectionKind = createEnum({
  STUD: 'stud',
  NECK: 'neck',
  HIP: 'hip',
  LEG: 'leg',
  LEFT_ARM: 'left_arm',
  RIGHT_ARM: 'right_arm',
  WRIST: 'wrist',
  HAT: 'hat',
  GRIP: 'grip',
})
export type ConnectionKind = EnumValues<typeof ConnectionKind>

// One side of a joint in a part's frame: the stud (male) or what takes it (female). A stud turns freely about the way it points
// (`direction`, the stud's up); every other joint has one frame (`rotation`, row-major 3 x 3) both sides share when joined.
export type PartConnection = {
  readonly kind: ConnectionKind
  readonly isMale: boolean
  readonly position: Vector
  readonly direction: Vector
  readonly rotation: readonly number[]
}

// A placed part with its connections (in its own frame).
export type ConnectedPart = {
  readonly part: BuilderPartLine
  readonly connections: readonly PartConnection[]
}

// What a minifigure part offers, by its number: a pattern on the part number and its joints.
export type MinifigConnectionEntry = {
  readonly pattern: RegExp
  readonly connections: readonly PartConnection[]
}

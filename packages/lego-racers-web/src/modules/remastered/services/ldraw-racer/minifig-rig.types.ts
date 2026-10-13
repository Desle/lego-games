import type { MinifigSide } from '@lego-games/ldraw/minifig'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

export const MinifigPosture = createEnum({
  // Arms out sideways and legs straight down: the bind pose of the menu figure's skeleton.
  STANDING: 'standing',
  // Legs forward and arms reaching forward: the bind pose of the race driver's skeleton.
  SEATED: 'seated',
})
export type MinifigPosture = EnumValues<typeof MinifigPosture>

// Which way a leg or an arm points: the turn of one bone applied to the way the limb points in the bind pose (a direction of the
// figure's frame, LDraw axes), or the straight line between two bones (an arm or a leg that is one rigid piece points from the bone
// that starts it to the one where it ends, so bending the elbow or the knee moves it to the hand or the ankle).
export type MinifigLimbAttachment =
  | {
      readonly kind: 'bone'
      readonly boneIndex: number
      readonly bindDirection: readonly [number, number, number]
    }
  | { readonly kind: 'chord'; readonly startIndex: number; readonly endIndex: number }

// The twist of a hand: its bone's turn about the forearm, relative to the forearm's bone.
export type MinifigWristAttachment = {
  readonly forearmIndex: number
  readonly wristIndex: number
  readonly handIndex: number
}

export type MinifigLimbs = {
  readonly legs: Readonly<Record<MinifigSide, MinifigLimbAttachment>>
  readonly arms: Readonly<Record<MinifigSide, MinifigLimbAttachment>>
}

export type MinifigRig = {
  readonly posture: MinifigPosture
  // The z of the figure's frame that the skeleton's bind pose gives the hips' origin (the top of the hips), raw model units.
  readonly hipsHeight: number
  // The bone that carries the figure: the hip axle follows it.
  readonly pelvisIndex: number
  // The bone the torso (and the hips, one rigid piece with it) turns with.
  readonly torsoIndex: number
  readonly headIndex: number
  readonly limbs: MinifigLimbs
  // Null for a skeleton without hand bones: the hands keep their place on the arms.
  readonly wrists: Readonly<Record<MinifigSide, MinifigWristAttachment>> | null
}

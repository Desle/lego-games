import type { MinifigPartKey, MinifigPosture } from './minifig-assembly.types.ts'

// A part follows one bone, or the straight line between two (an arm or a leg that is one rigid piece follows the bone that starts it
// and ends where the next one starts, so bending the elbow or the knee moves it to the hand or the ankle).
export type MinifigAttachment =
  | { readonly kind: 'bone'; readonly boneIndex: number }
  | { readonly kind: 'chord'; readonly startIndex: number; readonly endIndex: number }

export type MinifigRig = {
  readonly posture: MinifigPosture
  // The z of the figure's frame that the skeleton's bind pose gives the hips' origin, raw model units.
  readonly hipsHeight: number
  readonly attachments: Readonly<Record<MinifigPartKey, MinifigAttachment>>
}

import type { MinifigSide } from '@lego-games/ldraw/minifig'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// How sure the mapping of a catalogue piece to a library part is.
export const MinifigPartConfidence = createEnum({
  // The official figure of that character carries this very part (Rebrickable's inventory of the figure).
  EXACT: 'exact',
  // The same theme and era, a print that reads the same as the game's picture.
  CLOSE: 'close',
  // The nearest print of the era; the user is asked to correct it.
  GUESS: 'guess',
})
export type MinifigPartConfidence = EnumValues<typeof MinifigPartConfidence>

// One library part and its colour (an LDraw colour code).
export type LDrawHat = {
  readonly part: string
  readonly colorCode: number
}

// What a catalogue piece (a hat, a face, a torso, a pair of legs) is made of in the library, and why.
export type MinifigPartMatch = {
  readonly catalogName: string
  readonly confidence: MinifigPartConfidence
  readonly source: string
}

// A hat is one or more library parts (the mask of King Kahuka and its plume).
export type LDrawHatMatch = MinifigPartMatch & {
  readonly hats: readonly LDrawHat[]
}

export type LDrawFaceMatch = MinifigPartMatch & LDrawHat

// A torso: the library part (a print, or the plain `973` that shows the game's picture), the colours of the body, each arm and the hands,
// and whether the left hand is a hook.
export type LDrawTorsoMatch = MinifigPartMatch & {
  readonly part: string
  readonly torsoColorCode: number
  readonly armColorCodes: Readonly<Record<MinifigSide, number>>
  readonly handColorCode: number
  readonly isHookHand: boolean
}

// The hips and the two legs (the right one may be a peg), each a part and a colour.
export type LDrawLegsMatch = MinifigPartMatch & {
  readonly hipsColorCode: number
  readonly leftLeg: LDrawHat
  readonly rightLeg: LDrawHat
}

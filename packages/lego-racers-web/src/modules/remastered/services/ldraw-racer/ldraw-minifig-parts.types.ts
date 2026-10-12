import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// How sure the match of a catalogue part to a library part is, for the review table (`.docs/remastered-minifig-parts.md`).
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

// What a catalogue entry (a hat, a face, a torso, a pair of legs) is made of in the library, and why.
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

// A printed torso: the part has no arms (they are drawn apart), the colours are the body's, the arms' and the hands'.
export type LDrawTorsoPrint = {
  readonly part: string
  readonly torsoColorCode: number
  readonly armColorCode: number
  readonly handColorCode: number
}

// A torso with no print of the library that reads like the game's keeps the game's picture (clipped to the front of the torso).
export type LDrawTorsoMatch = MinifigPartMatch & {
  readonly print: LDrawTorsoPrint | null
}

// The hips and the two legs (the right one may be a peg), each a part and a colour.
export type LDrawLegsMatch = MinifigPartMatch & {
  readonly hipsColorCode: number
  readonly leftLeg: LDrawHat
  readonly rightLeg: LDrawHat
}

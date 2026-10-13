import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// What kind of replacement the remastered layer makes.
export const FidelityItemKind = createEnum({
  BRICK: 'brick',
  COMPOSITE: 'composite',
  CHASSIS: 'chassis',
  PICKUP: 'pickup',
  CAR: 'car',
  WHEELS: 'wheels',
  DRIVER: 'driver',
  HAT: 'hat',
  FACE: 'face',
  TORSO: 'torso',
  LEGS: 'legs',
})
export type FidelityItemKind = EnumValues<typeof FidelityItemKind>

// The poses the game shows a driver in: seated in the race (resting, and in a steering clip), standing in the main menu and idling on
// the Racer Select showcase.
export const FidelityPose = createEnum({
  SEATED: 'seated',
  STEERING: 'steering',
  STANDING: 'standing',
  MENU_IDLE: 'menu_idle',
})
export type FidelityPose = EnumValues<typeof FidelityPose>

// The orthographic views every item is compared in.
export const FidelityView = createEnum({
  FRONT: 'front',
  SIDE: 'side',
  TOP: 'top',
  THREE_QUARTER: 'three_quarter',
})
export type FidelityView = EnumValues<typeof FidelityView>

// One replacement to measure. `subject` names what is replaced: a brick or chassis part, an effect model, a car code (with the models
// folder's file of it), a chassis index of the chassis database, or a driver's five part bytes.
export type FidelityItem = {
  readonly id: string
  readonly kind: FidelityItemKind
  readonly name: string
  readonly subject: string
  readonly file: string | null
  readonly chassisIndex: number
  readonly partBytes: readonly number[]
  // The driver of the driver database whose fixed race model is the original (a champion seated in the race), else null.
  readonly driverName: string | null
  readonly pose: FidelityPose | null
}

export type FidelityViewResult = {
  readonly view: FidelityView
  readonly intersectionOverUnion: number
  readonly colorDifference: number | null
}

export type FidelityAnchorResult = {
  readonly name: string
  // LDraw units between the original's point and the replacement's.
  readonly distance: number
}

// What the harness measured for one item: distances in LDraw units (20 to a stud), x forward, y to the left, z up.
export type FidelityResult = {
  readonly id: string
  readonly kind: FidelityItemKind
  readonly name: string
  readonly score: number
  readonly isPassed: boolean
  readonly views: readonly FidelityViewResult[]
  readonly meanIntersectionOverUnion: number
  readonly minimumIntersectionOverUnion: number
  readonly centroidOffset: readonly number[]
  readonly boundsCentreOffset: readonly number[]
  readonly sizeRatio: readonly number[]
  readonly scaleRatio: number
  readonly meanColorDifference: number | null
  readonly anchors: readonly FidelityAnchorResult[]
  readonly meanAnchorDistance: number | null
  // A chassis recipe's share of the building cells over a stud of its base, null for other items.
  readonly footprintCoverage: number | null
  // Why an item could not be measured, or what its numbers leave out.
  readonly note: string
}

// The functions the fidelity page puts on `window` for the command to call.
export type FidelityWindow = {
  readonly listFidelityItems: (draftFiles: readonly string[]) => Promise<readonly FidelityItem[]>
  readonly measureFidelityItem: (
    item: FidelityItem,
    isPictureKept: boolean
  ) => Promise<FidelityResult>
  // A PNG data URL of the difference sheet of items measured with their pictures kept, or '' when there is none.
  readonly renderFidelitySheet: (rows: readonly FidelitySheetRequest[]) => string
}

// A row the sheet is asked for: the item and the label to print over it.
export type FidelitySheetRequest = {
  readonly id: string
  readonly label: string
}

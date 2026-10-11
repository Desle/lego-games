import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { DriverPart as DriverPartValues } from './driver-session.ts'

export type DriverPart = EnumValues<typeof DriverPartValues>

// What a chooser offers: the catalogue indices of the parts the player may use, in catalogue order (0x00483c60 and its
// three twins fill `+0x4f0`, `+0x660`, `+0x7d0` and `+0x940` of the screen), and the position of the current one.
export type DriverChooser = {
  readonly indices: readonly number[]
  readonly position: number
}

// The driver editor's state: one chooser per part and the expression byte the editor never changes.
export type DriverSession = {
  readonly hat: DriverChooser
  readonly face: DriverChooser
  readonly torso: DriverChooser
  readonly legs: DriverChooser
  readonly expression: number
}

// Whether a part with this requirement byte is open: free below 3, the trophy of circuit `requirement - 3`, or every ghost
// beaten at 0x80 (`getIsPartUnlocked` of the save data).
export type DriverPartAvailability = (requirement: number) => boolean

export type DriverMixResult = {
  readonly session: DriverSession
  readonly randomPosition: number
}

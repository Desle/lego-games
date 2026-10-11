import type { CarDesign } from './car-builder.types.ts'

// One racer of a save (a 0x22d-byte record).
export type SaveRacerRecord = {
  // Record +0x00: 13 UTF-16 characters.
  readonly name: string
  // Record +0x1c..+0x20: the five bytes 0x0042b330 hands the figure builder (0x0042dfa0, 0x0049db90): which parts of
  // the minifigure the driver is made of. The order of the five in the call is bytes 1, 0, 3, 2 and 4 & 0x7f.
  readonly partBytes: readonly number[]
  // Record +0x21: the chassis the car is built on (eight characters), copied to the racer slot's +0x08.
  readonly chassisName: string
  // Record +0x29 to the end: a design (loadCarDesign).
  readonly designBytes: Uint8Array
}

export type SaveFile = {
  readonly racers: readonly SaveRacerRecord[]
}

// A racer of a save with its design loaded.
export type SavedCar = {
  readonly record: SaveRacerRecord
  readonly design: CarDesign | null
}

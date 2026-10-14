import type { DriverFilePart } from './driver-file.types.ts'

// Where a driver's parts come from: his file in the models folder (relative to it), or, with no file, the figure builder's catalogue
// pieces his part bytes choose. The part bytes also give the pictures of his face and torso (the figure builder's model of them).
export type DriverSource =
  | { readonly kind: 'file'; readonly file: string; readonly partBytes: readonly number[] }
  | {
      readonly kind: 'catalogue'
      readonly parts: readonly DriverFilePart[]
      readonly partBytes: readonly number[]
    }

// A figure known by its pictures: the driver database's record of the champion whose face it wears (null: a stand-in of the
// player's), and the part bytes it is drawn with.
export type ModelFigure = {
  readonly name: string | null
  readonly partBytes: readonly number[]
}

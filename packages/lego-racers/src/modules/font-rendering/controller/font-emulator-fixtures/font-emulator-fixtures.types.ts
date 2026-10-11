import type { BitmapFont } from '../../types/font-rendering.types.ts'

// A random font and string for the differential specs, with the arguments the text routines take.
export type FontCase = {
  readonly font: BitmapFont
  readonly text: readonly number[]
  readonly maximumWidth: number
  readonly firstLineOffset: number
  readonly scaleX: number
  readonly scaleY: number
  readonly probeCode: number
}

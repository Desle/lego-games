import type { RacerPartDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'

export type LDrawRacerPartDrawing = RacerPartDrawing & {
  // Resolves when the library has delivered the parts the drawing is made of.
  readonly settled: Promise<void>
}

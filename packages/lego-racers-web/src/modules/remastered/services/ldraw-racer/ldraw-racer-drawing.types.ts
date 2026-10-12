import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { Object3D } from 'three'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

export const RacerPartKind = createEnum({
  WHEELS: 'wheels',
  DRIVER: 'driver',
})
export type RacerPartKind = EnumValues<typeof RacerPartKind>

// A part of a racer to draw from the original's skeleton model: the wheels of the car or its driver.
export type RacerPartDrawingRequest = {
  readonly kind: RacerPartKind
  readonly archive: JamArchive
  // The original's model of the part: the skeleton and the animation set that the poses are given for.
  readonly model: ModelScene
  // The name of the original's model (the chassis's wheel model, the driver's model), null for a driver built from part bytes.
  readonly modelName: string | null
  // The five part bytes (hat, face, torso, legs, expression) a driver is built from, null for a fixed driver model.
  readonly partBytes: readonly number[] | null
}

// What is drawn in place of a racer's part. Its object is in the original model's frame before the model's scale.
export type RacerPartDrawing = {
  readonly object: Object3D
  readonly setAnimationState: (state: SkeletonAnimationState) => void
  readonly animate: (deltaMilliseconds: number) => void
  readonly dispose: () => void
}

export type LDrawRacerPartDrawing = RacerPartDrawing & {
  // Resolves when the library has delivered the parts the drawing is made of.
  readonly settled: Promise<void>
}

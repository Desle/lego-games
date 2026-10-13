import type { BrickPiece } from '@lego-games/lego-racers/car-builder'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { RacerPartDrawing } from '../ldraw-racer/ldraw-racer-drawing.types.ts'

// What the page asks of the racer drawings: whether a chassis without a recipe is drawn from the game's own geometry.
export type LDrawRacerSettings = {
  readonly search: string
  readonly isChassisFallbackUsed: boolean
}

// Where a car's LDraw model comes from: a hand-built file of the models folder, or a design from the garage whose chassis has a
// recipe (or the fallback).
export type LDrawCarSource =
  | { readonly kind: 'file'; readonly file: string }
  | { readonly kind: 'design'; readonly chassis: BrickPiece }

// What a car drawing keeps while it is shown: the wheels (the model's own or the library's) with the pose they were last given, the
// opacity, and whether the drawing is gone, so that a late answer from the library is dropped.
export type LDrawCarLiveState = {
  wheels: Pick<RacerPartDrawing, 'object' | 'setAnimationState' | 'dispose'> | null
  state: SkeletonAnimationState | null
  opacity: number
  isDisposed: boolean
}

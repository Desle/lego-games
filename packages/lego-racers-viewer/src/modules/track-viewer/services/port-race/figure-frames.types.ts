import type { Cinema, CinemaAction } from '@lego-games/lego-racers/cinema'
import type { Scene } from '@lego-games/lego-racers/scene'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'

// A menu figure as the trace specs place it: its part bytes, where it stands, which way it faces and its pose.
export type FigurePlace = {
  readonly partBytes: readonly number[]
  readonly position: readonly number[]
  readonly forward: readonly number[]
  readonly animationName: string
  readonly animation: SkeletonAnimationState
}

// The champion's figure of a race preview at a time: the cinema and its guy1 action, the figure's scene and bone matrices, and
// the side axis of the action's frame (up x forward).
export type CinemaFigurePose = {
  readonly cinema: Cinema
  readonly action: CinemaAction
  readonly scene: Scene
  readonly matrices: Float32Array
  readonly side: readonly [number, number, number]
}

import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'

// A menu figure as the trace specs place it: its part bytes, where it stands, which way it faces and its pose.
export type FigurePlace = {
  readonly partBytes: readonly number[]
  readonly position: readonly number[]
  readonly forward: readonly number[]
  readonly animationName: string
  readonly animation: SkeletonAnimationState
}

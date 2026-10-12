import type { ModelScene } from '@lego-games/lego-racers/scene'

// Where a pose comes from: the menus' animation set of the figure (null: the race's seated driver) and the clip and time in it.
export type DriverPoseSource = {
  readonly animationName: string | null
  readonly clipIndex: number
  readonly milliseconds: number
}

// The original's figure and the name of its fixed model (null: built from part bytes).
export type DriverModel = {
  readonly model: ModelScene
  readonly modelName: string | null
}

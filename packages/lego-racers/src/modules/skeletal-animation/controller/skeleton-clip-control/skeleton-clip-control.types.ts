// The arguments of the exe's figure blend (0x0040db80) that decide how the blend runs.
export type SkeletonClipBlend = {
  readonly clipIndex: number
  // Argument 2: the blend's duration in milliseconds (the blend factor grows by 1 / duration per millisecond).
  readonly durationMilliseconds: number
  // Argument 4 and 5: whether the shown clip and the new clip keep advancing while the blend runs.
  readonly isFirstAdvancing: boolean
  readonly isSecondAdvancing: boolean
  // Argument 6: whether the new clip loops once the blend ends.
  readonly isTargetLooping: boolean
}

// A wheel found in the original's model of wheels: where it is in its bone's frame and how big it is (raw model units).
export type WheelShape = {
  readonly boneIndex: number
  readonly centre: readonly number[]
  // 0, 1 or 2: the bone-frame axis the wheel turns about.
  readonly axisIndex: number
  readonly radius: number
  readonly width: number
  readonly pointCount: number
}

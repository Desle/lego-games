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

// A connected piece of a model's triangles: the bone that moves it, its bounds in that bone's frame and how many points it has.
export type Piece = {
  readonly boneIndex: number
  readonly minimum: number[]
  readonly maximum: number[]
  pointCount: number
}

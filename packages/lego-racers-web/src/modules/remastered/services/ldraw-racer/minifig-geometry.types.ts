import type { Matrix4, Vector3 } from 'three'

export type MinifigSide = 'left' | 'right'

// A hinge of the figure: the point it turns about and its axis, in the hips' frame of the assembled figure (LDraw axes and units).
export type MinifigHinge = {
  readonly pivot: Vector3
  readonly axis: Vector3
}

// Where the library's parts of a complete minifigure sit, in the frame of the hips (LDraw axes, y down, the origin at the top of the
// hips), and the hinges they turn on.
export type MinifigGeometry = {
  readonly torso: Matrix4
  // The head and every hat on it.
  readonly head: Matrix4
  readonly legs: Matrix4
  readonly arms: Readonly<Record<MinifigSide, Matrix4>>
  readonly hands: Readonly<Record<MinifigSide, Matrix4>>
  // The axle of the hips, across the figure; a leg hangs straight down (+y) when it has not turned.
  readonly hip: MinifigHinge
  // The neck, upright: the head turns about it and nothing else.
  readonly neck: MinifigHinge
  // The pin of each shoulder, square to the torso's slanted side; an arm hangs down that side when it has not turned.
  readonly shoulders: Readonly<Record<MinifigSide, MinifigHinge>>
  // The pin of each hand, along the end of its arm.
  readonly wrists: Readonly<Record<MinifigSide, MinifigHinge>>
}

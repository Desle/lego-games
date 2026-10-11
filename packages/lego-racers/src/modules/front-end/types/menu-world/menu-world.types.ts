// The nine floats of a 3D item (MIB 0x2e, read by 0x00469d20 into item `+0x38`). **Hypothesis** for the roles: the
// camera position, the point it looks at, the vertical field of view in degrees and the near and far planes; the
// race-free menus show the worlds correctly with them.
export type MenuCamera = {
  readonly position: readonly [number, number, number]
  readonly target: readonly [number, number, number]
  readonly fieldOfViewDegrees: number
  readonly nearPlane: number
  readonly farPlane: number
  // The width over the height the projection is built with; null takes the viewport's own (an optional tenth value).
  readonly aspectRatio: number | null
}

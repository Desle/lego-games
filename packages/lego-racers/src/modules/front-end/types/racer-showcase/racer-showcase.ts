// The racer showcase of the race select (FUN_00485f70 builds the slot's viewport, FUN_00488ed0 the pick screen's racer
// widgets, the update is 0x00486a00): measured from the original's draws (`model matrix x inverse(camera matrix)` of
// every drawn part, see menu-backdrops.md) unless a comment names an address.

// The driver's root frame in `RS_SET`: where the figure builder's model stands (mean of 18 part frames, spread 2 mm) and
// the forward vector 0x00486540 gives every slot's figure (0x3f76b085, 0xbe88d36b, 0).
export const RACER_SHOWCASE_DRIVER_POSITION: readonly [number, number, number] = Object.freeze([
  -0.9375, -0.8981, 1.4867,
])
export const RACER_SHOWCASE_DRIVER_FORWARD: readonly [number, number, number] = Object.freeze([
  0.96363097, -0.267238, 0,
])

// The car's root: constant while the turntable turns it (the car follows the bone of the shadow `crsdow`, 0x004865c0).
export const RACER_SHOWCASE_CAR_POSITION: readonly [number, number, number] = Object.freeze([
  -11.52, -6.767, 0,
])

// The string ids (MENUNAME.SRF) of the idle clips 0x00486730 draws from (`0x004c21bc`) and of the clips a pressed button
// starts (`0x004c21cc`: `jump`, `yes!`, `spin`; not ported: the screen leaves at once).
export const RACER_SHOWCASE_IDLE_STRING_IDS: readonly number[] = Object.freeze([
  0x74, 0x75, 0x77, 0x78, 0x79, 0x7a, 0x7b,
])

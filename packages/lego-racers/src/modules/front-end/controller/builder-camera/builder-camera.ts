import { getFootprintHeight } from '../../../car-builder/index.ts'
import type { BuilderPreview } from '../../types/front-end.types.ts'
import type { MenuCamera } from '../../types/menu-world/menu-world.types.ts'

// 0x004b2e80 and 0x004b2ea8: the camera's offset from the car at each of the three heights, for a low car and for a tall
// one; 0x00479330 blends them by how tall the design is (between 0x004b2ecc = 5.9 and 0x004b2ed0 = 8.5).
const LOW_CAR_OFFSETS: readonly (readonly [number, number, number])[] = Object.freeze([
  [0, -14, 9],
  [0, -10, 14],
  [0, -0.3, 17],
])
const TALL_CAR_OFFSETS: readonly (readonly [number, number, number])[] = Object.freeze([
  [0, -18, 10],
  [0, -12, 17],
  [0, -0.3, 20],
])
const LOW_CAR_HEIGHT = 5.9
const TALL_CAR_HEIGHT = 8.5
// A brick unit is 0.4 of a stud (the mesh builder multiplies z by 0.4, 0x0049b920).
const BRICK_UNIT_HEIGHT = 0.4
const VIEW_ANGLE_RADIANS = Math.PI / 4
// The keypad tables (0x004c1d78, 0x004c1e78) make "up" a step of -x and "left" a step of -y in the first view: that is the car
// seen from behind (its nose is at -x), so the offsets, which name -y as "behind", are turned a quarter before the view's own
// angle. **Hypothesis**, checked in the viewer: with it the arrow keys move the brick the way they point on screen.
const FIRST_VIEW_ANGLE_RADIANS = Math.PI / 2
const FIELD_OF_VIEW_DEGREES = 45
const NEAR_PLANE = 1
const FAR_PLANE = 1023

const getDesignHeight = (preview: BuilderPreview): number =>
  Math.max(
    0,
    ...preview.design.bricks.map(
      (brick) => (brick.baseHeight + getFootprintHeight(brick.piece.footprint)) * BRICK_UNIT_HEIGHT
    )
  )

// The builder's camera: the offset of the chosen height (blended by the car's height as 0x00479330 does), turned about the
// car by the view. **Hypotheses**: the offsets are relative to the car's origin and look at it, the eight views are
// turns of 45 degrees about the vertical axis, and a view turns the camera clockwise seen from above.
export const getBuilderCamera = (preview: BuilderPreview): MenuCamera => {
  const blend = Math.min(
    1,
    Math.max(0, (getDesignHeight(preview) - LOW_CAR_HEIGHT) / (TALL_CAR_HEIGHT - LOW_CAR_HEIGHT))
  )
  const low = LOW_CAR_OFFSETS[preview.cameraPitch] ?? LOW_CAR_OFFSETS[0] ?? [0, 0, 0]
  const tall = TALL_CAR_OFFSETS[preview.cameraPitch] ?? TALL_CAR_OFFSETS[0] ?? [0, 0, 0]
  const [offsetX, offsetY, offsetZ] = [0, 1, 2].map(
    (axis) => (tall[axis] ?? 0) * blend + (low[axis] ?? 0) * (1 - blend)
  )
  const angle = FIRST_VIEW_ANGLE_RADIANS + preview.cameraYaw * VIEW_ANGLE_RADIANS
  const x = (offsetX ?? 0) * Math.cos(angle) - (offsetY ?? 0) * Math.sin(angle)
  const y = (offsetX ?? 0) * Math.sin(angle) + (offsetY ?? 0) * Math.cos(angle)
  const camera: MenuCamera = {
    position: [x, y, offsetZ ?? 0],
    target: [0, 0, 0],
    fieldOfViewDegrees: FIELD_OF_VIEW_DEGREES,
    nearPlane: NEAR_PLANE,
    farPlane: FAR_PLANE,
    aspectRatio: null,
    up: [0, 0, 1],
  }
  return Object.freeze(camera)
}

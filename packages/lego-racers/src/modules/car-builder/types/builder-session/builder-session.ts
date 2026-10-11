import { createEnum } from '../../../../shared/types/enum.types.ts'

// Why 0x0049a1e0 refuses a brick (its negative answers).
export const BuilderRefusal = createEnum({
  // -1: the brick rests on nothing it could attach to.
  NOTHING_TO_ATTACH_TO: 'nothing_to_attach_to',
  // -2, -3, -4: outside the grid (the cursor never leaves it).
  OUTSIDE_GRID: 'outside_grid',
  // -5: it would collide with bricks already there.
  OVERLAPPING: 'overlapping',
  // -6: the car would be taller than 15 brick units.
  TOO_TALL: 'too_tall',
  // -7: the design already holds 64 bricks.
  TOO_MANY_BRICKS: 'too_many_bricks',
  // Undo with only the chassis left (0x004787e0, sound 0x12).
  ONLY_CHASSIS: 'only_chassis',
})

// The camera of the builder: eight views around the car (`+0x298`, 0x00478080) and three heights (`+0x290`, 0x004782f0).
export const CAMERA_YAW_COUNT = 8
export const CAMERA_PITCH_COUNT = 3

// 0x004c1d78 and 0x004c1e78: for each of the eight views, the (x, y) step of each of the eight directions the numeric
// keypad names (8 up, 9, 6, 3, 2, 1, 4, 7 starting with index 0 = key 8 clockwise).
export const DIRECTION_X_STEPS: readonly (readonly number[])[] = Object.freeze([
  [-1, -1, 0, 1, 1, 1, 0, -1],
  [-1, -1, -1, 0, 1, 1, 1, 0],
  [0, -1, -1, -1, 0, 1, 1, 1],
  [1, 0, -1, -1, -1, 0, 1, 1],
  [1, 1, 0, -1, -1, -1, 0, 1],
  [1, 1, 1, 0, -1, -1, -1, 0],
  [0, 1, 1, 1, 0, -1, -1, -1],
  [-1, 0, 1, 1, 1, 0, -1, -1],
])
export const DIRECTION_Y_STEPS: readonly (readonly number[])[] = Object.freeze([
  [0, 1, 1, 1, 0, -1, -1, -1],
  [-1, 0, 1, 1, 1, 0, -1, -1],
  [-1, -1, 0, 1, 1, 1, 0, -1],
  [-1, -1, -1, 0, 1, 1, 1, 0],
  [0, -1, -1, -1, 0, 1, 1, 1],
  [1, 0, -1, -1, -1, 0, 1, 1],
  [1, 1, 0, -1, -1, -1, 0, 1],
  [1, 1, 1, 0, -1, -1, -1, 0],
])

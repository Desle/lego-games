// Keywords of Chassis_Load (LEGORacers.exe 0x0041db10); the record offset of each value is in the comment.
export const ChassisKeyword = Object.freeze({
  CHASSIS: 0x27,
  FIRST_VARIANT: 0x28, // `{ variant keywords }`, FUN_0041e210 with variant 0
  SECOND_VARIANT: 0x29, // variant 1
  BUILT_CENTRE_OF_MASS_BASE: 0x2a, // +0xb8, +0xbc, +0xc0
  VEHICLE_POINT: 0x2b, // +0xc4, +0xc8, +0xcc
  BASE_MASS: 0x2c, // +0xd0
  UNREAD_PAIR: 0x2d, // +0xd4, +0xd8
  HULL_EXTENTS: 0x2e, // +0xdc, +0xe0
  RACER_VALUE: 0x2f, // +0xec
  VEHICLE_BLOCK: 0x30, // `{ +0xe4, +0xe8, four points at +0x58 }`
  WHEEL_BLOCK: 0x31, // `{ four points at +0x88 }`
  FIRST_UNREAD_INTEGER: 0x32, // +0xf0
  SECOND_UNREAD_INTEGER: 0x33, // +0xf4
  SHARED_RESOURCE_NAME: 0x39, // +0x50
  STEERING_RATING: 0x3a, // +0x100
  TOP_SPEED_RATING: 0x3b, // +0x102
  THROTTLE_RATING: 0x3c, // +0x101
})

// Keywords inside a variant block (FUN_0041e210 0x0041e210); the offsets are for variant 0, variant 1 adds 8.
export const ChassisVariantKeyword = Object.freeze({
  MATERIAL_LIBRARY: 0x34, // +0x00
  TEXTURE_DATABASE: 0x35, // +0x10
  MODEL: 0x36, // +0x20
  SKELETON: 0x37, // +0x40
  ANIMATION: 0x38, // +0x30
})

export const DEFAULT_STEERING_RATING = 0x32
export const DEFAULT_THROTTLE_RATING = 0x50
export const DEFAULT_TOP_SPEED_RATING = 0x32
export const CHASSIS_VARIANT_COUNT = 2
export const CHASSIS_POINT_COUNT = 4

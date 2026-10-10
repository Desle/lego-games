import type { FloatTriple } from '../../token-reader/index.ts'

// The five resource names of one model variant (FUN_0041e210 reads them inside keyword 0x28 or 0x29); 0x0041e360
// loads each with the Gol root's slot named in the comment.
export type ChassisVariant = {
  // 0x34, record +0x00 / +0x08: material library (slot 0x10).
  readonly materialLibraryName: string
  // 0x35, +0x10 / +0x18: texture database (slot 0x0c).
  readonly textureDatabaseName: string
  // 0x36, +0x20 / +0x28: model (slot 0x14). The second variant exists when this name is set.
  readonly modelName: string
  // 0x37, +0x40 / +0x48: skeleton (slot 0x18).
  readonly skeletonName: string
  // 0x38, +0x30 / +0x38: an object of 0x34 bytes built by 0x004011a0 and loaded with a name and the JAM flag.
  readonly animationName: string
}

// One `0x27 name { keywords }` block of a CMB (Chassis_Load 0x0041db10); the 0x104-byte record starts zeroed except
// the three rating bytes, which default to 0x32, 0x50 and 0x32.
export type Chassis = {
  readonly name: string
  // Keywords 0x28 and 0x29.
  readonly variants: readonly ChassisVariant[]
  // 0x39, +0x50: stored into the car's texture database entry (+0x38, +0x3c) and material entry (+0x18, +0x1c).
  readonly sharedResourceName: string
  // 0x2a, +0xb8..+0xc0: the local centre of mass of a car built from bricks starts here (0x0043b480).
  readonly builtCentreOfMassBase: FloatTriple
  // 0x2b, +0xc4..+0xcc: the vehicle's +0x4c..+0x54 (0x0043d7a0).
  readonly vehiclePoint: FloatTriple
  // 0x2c, +0xd0: added to a built car's weight to give its mass.
  readonly baseMass: number
  // 0x2d, +0xd4 and +0xd8: not read by the race.
  readonly unreadPair: readonly [number, number]
  // 0x2e, +0xdc and +0xe0: the hull's half extents before 0x004af58c scales them (0x004371c0).
  readonly hullExtents: readonly [number, number]
  // 0x2f, +0xec: racer +0xd54.
  readonly racerValue: number
  // 0x30, +0xe4 and +0xe8: the vehicle's +0x1a0 and +0x1a4.
  readonly vehicleValues: readonly [number, number]
  // 0x30, +0x58..+0x87: four points copied to the vehicle's +0x1a8..+0x1d7.
  readonly vehiclePoints: readonly FloatTriple[]
  // 0x31, +0x88..+0xb7: four points; the second is the wheel anchor, the others give the track width and wheelbase
  // (0x004371c0).
  readonly wheelPoints: readonly FloatTriple[]
  // 0x32, +0xf0 and 0x33, +0xf4: integers the race does not read.
  readonly unreadIntegers: readonly [number, number]
  // 0x3a, +0x100: added to a built car's weight bonus for 0x0042ad70, the steering scale.
  readonly steeringRating: number
  // 0x3c, +0x101: 0x0042ada0, the throttle scale (the weight bonus is subtracted).
  readonly throttleRating: number
  // 0x3b, +0x102: 0x0042add0, the top speed scale.
  readonly topSpeedRating: number
}

export type ChassisDatabase = {
  readonly chassis: readonly Chassis[]
  readonly readByteCount: number
}

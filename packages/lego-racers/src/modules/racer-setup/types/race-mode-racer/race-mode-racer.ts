import type { RacerPowerUpAbilities } from '../../../power-ups/index.ts'

// Game settings +0x20 bits that 0x00436df0 turns into racer +0xd04 flags (the game-settings word, not a driver's).
export const RaceModeRacerBit = Object.freeze({
  // → racer flag 0x4000000, and car rigid body flag 0x100000 (0x004371c0).
  CAR_BODY: 0x1,
  // → racer flag 0x8000000: a level-2 turbo is kept running.
  PERMANENT_TURBO: 0x2,
  // → racer flag 0x1000000: every brick is used as a level-1 projectile.
  ALWAYS_GRAPPLE: 0x40,
  // → racer flag 0x2000000: every brick is used at level 3.
  ALWAYS_LEVEL_THREE: 0x80,
})

export const RACER_CAR_BODY_FLAG = 0x4000000
export const RACER_ALWAYS_GRAPPLE_FLAG = 0x1000000
export const RACER_ALWAYS_LEVEL_THREE_FLAG = 0x2000000
export const RACER_PERMANENT_TURBO_FLAG = 0x8000000

const getIsBitSet = (raceModeFlags: number, bit: number): boolean => (raceModeFlags & bit) !== 0

// 0x00436df0 reads byte +0x3c of the settings block RacerSet_Setup receives, which holds game settings +0x20.
export const getRacerPowerUpAbilities = (raceModeFlags: number): RacerPowerUpAbilities =>
  Object.freeze({
    isAlwaysGrapple: getIsBitSet(raceModeFlags, RaceModeRacerBit.ALWAYS_GRAPPLE),
    isAlwaysLevelThree: getIsBitSet(raceModeFlags, RaceModeRacerBit.ALWAYS_LEVEL_THREE),
    isPermanentTurbo: getIsBitSet(raceModeFlags, RaceModeRacerBit.PERMANENT_TURBO),
  })

export const getIsCarBodyFlagged = (raceModeFlags: number): boolean =>
  getIsBitSet(raceModeFlags, RaceModeRacerBit.CAR_BODY)

// The racer's +0xd04 bits from the game settings (OR-ed into whatever the racer had; a fresh racer has none).
export const getRaceModeRacerFlags = (raceModeFlags: number): number =>
  (getIsCarBodyFlagged(raceModeFlags) ? RACER_CAR_BODY_FLAG : 0) |
  (getIsBitSet(raceModeFlags, RaceModeRacerBit.ALWAYS_GRAPPLE) ? RACER_ALWAYS_GRAPPLE_FLAG : 0) |
  (getIsBitSet(raceModeFlags, RaceModeRacerBit.ALWAYS_LEVEL_THREE)
    ? RACER_ALWAYS_LEVEL_THREE_FLAG
    : 0) |
  (getIsBitSet(raceModeFlags, RaceModeRacerBit.PERMANENT_TURBO) ? RACER_PERMANENT_TURBO_FLAG : 0)

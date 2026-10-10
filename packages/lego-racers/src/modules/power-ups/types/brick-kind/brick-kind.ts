import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { BrickKind as BrickKindValue } from '../power-ups.types.ts'

// The four brick colours; the original stores them as 1..4 (racer +0xccc, brick +0x60, effect category).
export const BrickKind = createEnum({
  // 1, models "pbrickP"/"ptrailP" (0x00458a80, picked by 0x0045ba90).
  PROJECTILE: 'projectile',
  // 2, "pbrickS".
  SHIELD: 'shield',
  // 3, "pbrickT".
  TURBO: 'turbo',
  // 4, "pbrickM".
  HAZARD: 'hazard',
})

const BRICK_KINDS_BY_CODE: readonly BrickKindValue[] = Object.freeze([
  BrickKind.PROJECTILE,
  BrickKind.SHIELD,
  BrickKind.TURBO,
  BrickKind.HAZARD,
])

export class UnknownBrickKindError extends Error {
  constructor(code: number) {
    super(`Power-up brick kind ${String(code)} is not 1..4`)
    this.name = 'UnknownBrickKindError'
  }
}

export const getBrickKindFromCode = (code: number): BrickKindValue => {
  const kind = BRICK_KINDS_BY_CODE[code - 1]
  if (kind === undefined) throw new UnknownBrickKindError(code)
  return kind
}

export const getBrickKindCode = (kind: BrickKindValue): number =>
  BRICK_KINDS_BY_CODE.indexOf(kind) + 1

// Game settings +0x20, copied to power-up system +0x58 by PowerUps_Initialize 0x00457c20.
export const RaceModeFlag = Object.freeze({
  ONLY_PROJECTILES: 0x44,
  ONLY_HAZARDS: 0x08,
  ONLY_TURBOS: 0x10,
  // Read by the turbo (0x0045d200): a level-2 turbo never ends.
  ENDLESS_TURBO: 0x02,
})

// 0x00458a80, after each brick block: the race mode overrides the kind read from the file.
export const getRaceModeBrickKind = (
  kind: BrickKindValue,
  raceModeFlags: number
): BrickKindValue => {
  if ((raceModeFlags & RaceModeFlag.ONLY_PROJECTILES) !== 0) return BrickKind.PROJECTILE
  if ((raceModeFlags & RaceModeFlag.ONLY_HAZARDS) !== 0) return BrickKind.HAZARD
  if ((raceModeFlags & RaceModeFlag.ONLY_TURBOS) !== 0) return BrickKind.TURBO
  return kind
}

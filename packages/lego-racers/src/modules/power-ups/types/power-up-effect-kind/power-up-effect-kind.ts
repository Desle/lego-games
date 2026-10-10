import { createEnum } from '../../../../shared/types/enum.types.ts'
import type {
  BrickKind as BrickKindValue,
  PowerUpEffectKind as PowerUpEffectKindValue,
} from '../power-ups.types.ts'
import { BrickKind } from '../brick-kind/brick-kind.ts'

// One pooled effect class per brick colour and enhancement level (pools built by 0x00457d30).
export const PowerUpEffectKind = createEnum({
  // Projectile level 0: 0xe8 bytes, vtable 0x004b13b8, model "cannon".
  CANNON: 'cannon',
  // Projectile level 1: 0x290 bytes, vtable 0x004b1518, "tether".
  GRAPPLE: 'grapple',
  // Projectile level 2: 0x24c bytes, vtable 0x004b15a8, "lightng".
  WAND: 'wand',
  // Projectile level 3, three at once: 0x224 bytes, vtable 0x004b1690, "dmissil".
  ROCKET: 'rocket',
  // Hazard level 0: 400 bytes, vtable 0x004b16e0, "oilslck".
  OIL_SLICK: 'oil_slick',
  // Hazard level 1: 0x17c bytes, vtable 0x004b1448, "barrel".
  BARREL: 'barrel',
  // Hazard level 2: 0x84 bytes, vtable 0x004b15fc, "magnet".
  MAGNET: 'magnet',
  // Hazard level 3: 0x68 bytes, vtable 0x004b13fc, "curse".
  CURSE: 'curse',
  // Shield, every level: 0x2c bytes, vtable 0x004b1938, "shield0".."shield3".
  SHIELD: 'shield',
  // Turbo levels 0..2: 0x34 bytes, vtable 0x004b1a30, "TurboL0".."TurboL2".
  TURBO: 'turbo',
  // Turbo level 3: 0xe4 bytes, vtable 0x004b1a88, "warpprt".
  WARP: 'warp',
})

// Effect +0x04. The original's numbers are kept in the comments.
export const EffectState = createEnum({
  // 1: in its pool.
  IDLE: 'idle',
  // 2.
  STARTING: 'starting',
  // 3.
  ACTIVE: 'active',
  // 4.
  ENDING: 'ending',
  // 5: a second ending stage (grapple retracting, barrel's last explosion).
  FINAL_STAGE: 'final_stage',
  // 6: removed from the active list and returned to its pool by PowerUps_Update 0x0045a490.
  FINISHED: 'finished',
})

// Brick +0x3c.
export const BrickState = createEnum({
  // 0: can be collected.
  AVAILABLE: 'available',
  // 1: collected and waiting.
  HIDDEN: 'hidden',
  // 2: growing back in.
  APPEARING: 'appearing',
  // 3: shrinking after a collect.
  COLLECTED: 'collected',
  // 4: unused (0x00453a10).
  UNUSED: 'unused',
})

const EFFECT_KINDS_BY_CATEGORY: Readonly<
  Record<BrickKindValue, readonly PowerUpEffectKindValue[]>
> = Object.freeze({
  [BrickKind.PROJECTILE]: Object.freeze([
    PowerUpEffectKind.CANNON,
    PowerUpEffectKind.GRAPPLE,
    PowerUpEffectKind.WAND,
    PowerUpEffectKind.ROCKET,
  ]),
  [BrickKind.SHIELD]: Object.freeze([
    PowerUpEffectKind.SHIELD,
    PowerUpEffectKind.SHIELD,
    PowerUpEffectKind.SHIELD,
    PowerUpEffectKind.SHIELD,
  ]),
  [BrickKind.TURBO]: Object.freeze([
    PowerUpEffectKind.TURBO,
    PowerUpEffectKind.TURBO,
    PowerUpEffectKind.TURBO,
    PowerUpEffectKind.WARP,
  ]),
  [BrickKind.HAZARD]: Object.freeze([
    PowerUpEffectKind.OIL_SLICK,
    PowerUpEffectKind.BARREL,
    PowerUpEffectKind.MAGNET,
    PowerUpEffectKind.CURSE,
  ]),
})

export class InvalidEnhancementLevelError extends Error {
  constructor(level: number) {
    super(`Enhancement level ${String(level)} is not 0..3`)
    this.name = 'InvalidEnhancementLevelError'
  }
}

// 0x0045a950 (projectile), 0x0045a9b0 (hazard), 0x0045b030 (shield), 0x0045b1e0 (turbo; level 3 is the warp).
export const getPowerUpEffectKind = (
  category: BrickKindValue,
  level: number
): PowerUpEffectKindValue => {
  const kind = EFFECT_KINDS_BY_CATEGORY[category][level]
  if (kind === undefined) throw new InvalidEnhancementLevelError(level)
  return kind
}

// The value each class's vtable slot 6 returns (0x00452430 → 1, 0x0045c330 → 2, 0x0044f580 → 3, 0x0044f570 → 4).
export const getPowerUpEffectCategory = (kind: PowerUpEffectKindValue): BrickKindValue => {
  const categories = Object.values(BrickKind)
  const category = categories.find((candidate) =>
    EFFECT_KINDS_BY_CATEGORY[candidate].includes(kind)
  )
  return category ?? BrickKind.PROJECTILE
}

// Pool sizes from 0x00457d30: [split screen, one screen] (race +0x3354 is set when two players share the screen).
export const POWER_UP_EFFECT_POOL_SIZES: Readonly<
  Record<PowerUpEffectKindValue, readonly [number, number]>
> = Object.freeze({
  // +0x1888.
  [PowerUpEffectKind.CANNON]: Object.freeze([2, 4] as const),
  // +0x1889.
  [PowerUpEffectKind.GRAPPLE]: Object.freeze([2, 3] as const),
  // +0x188a.
  [PowerUpEffectKind.WAND]: Object.freeze([2, 3] as const),
  // +0x188b.
  [PowerUpEffectKind.ROCKET]: Object.freeze([6, 9] as const),
  // +0x1885.
  [PowerUpEffectKind.OIL_SLICK]: Object.freeze([3, 4] as const),
  // +0x1886.
  [PowerUpEffectKind.BARREL]: Object.freeze([2, 3] as const),
  // +0x1884.
  [PowerUpEffectKind.MAGNET]: Object.freeze([2, 3] as const),
  // +0x1887.
  [PowerUpEffectKind.CURSE]: Object.freeze([2, 2] as const),
  // +0x188c.
  [PowerUpEffectKind.SHIELD]: Object.freeze([2, 5] as const),
  // +0x188d.
  [PowerUpEffectKind.TURBO]: Object.freeze([2, 6] as const),
  // +0x188e.
  [PowerUpEffectKind.WARP]: Object.freeze([2, 3] as const),
})

// Attachment slots each class takes when it starts (calls to 0x0045b9e0); a failed allocation ends it at once.
export const POWER_UP_EFFECT_ATTACHMENT_COUNTS: Readonly<Record<PowerUpEffectKindValue, number>> =
  Object.freeze({
    [PowerUpEffectKind.CANNON]: 0,
    [PowerUpEffectKind.GRAPPLE]: 0,
    [PowerUpEffectKind.WAND]: 0,
    [PowerUpEffectKind.ROCKET]: 0,
    [PowerUpEffectKind.OIL_SLICK]: 0,
    [PowerUpEffectKind.BARREL]: 0,
    // 0x00455830.
    [PowerUpEffectKind.MAGNET]: 3,
    // 0x00452550.
    [PowerUpEffectKind.CURSE]: 3,
    // 0x0045bd30.
    [PowerUpEffectKind.SHIELD]: 2,
    // 0x0045c8f0.
    [PowerUpEffectKind.TURBO]: 3,
    [PowerUpEffectKind.WARP]: 0,
  })

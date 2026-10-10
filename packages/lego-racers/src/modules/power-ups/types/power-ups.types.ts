import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { RandomTable, RandomTablePosition } from '../../random-table/index.ts'
import type { ComputerPersonality } from '../../racer-ai/index.ts'
import type {
  EnhancementBrick as ParsedEnhancementBrick,
  PowerUpBrick as ParsedPowerUpBrick,
} from '../../power-up/index.ts'
import type { Vector3 } from '../../simulation-math/index.ts'
import type { BrickKind as BrickKindValues } from './brick-kind/brick-kind.ts'
import type {
  BrickState as BrickStateValues,
  EffectState as EffectStateValues,
  PowerUpEffectKind as PowerUpEffectKindValues,
} from './power-up-effect-kind/power-up-effect-kind.ts'

export type BrickKind = EnumValues<typeof BrickKindValues>
export type BrickState = EnumValues<typeof BrickStateValues>
export type EffectState = EnumValues<typeof EffectStateValues>
export type PowerUpEffectKind = EnumValues<typeof PowerUpEffectKindValues>

// The random table at 0x004befec and its position at 0x004c6ee4 (the random-table module).
export type RandomState = {
  readonly table: RandomTable
  readonly position: RandomTablePosition
}

// One PWB brick block (0x00458a80) and enhancement-brick block (0x00458e80), parsed by the power-up module.
export type PowerUpBrickPlacement = ParsedPowerUpBrick
export type EnhancementBrickPlacement = ParsedEnhancementBrick

// Brick base fields shared by both brick classes (constructor 0x00453910, vtable 0x004b14b0).
export type BrickBase = {
  readonly position: Vector3
  // +0x3c.
  readonly state: BrickState
  // +0x4c, unsigned milliseconds.
  readonly timerMilliseconds: number
  // +0x30, the drawn scale.
  readonly scale: number
  // +0x50 bit 0: sounds are played (set in race state 2 by 0x0045b900, cleared at load by 0x0045b950).
  readonly isSoundEnabled: boolean
  // +0x50 bit 1: a racer touched the brick this frame (0x00453af0).
  readonly isTouchedThisFrame: boolean
  // +0x50 bit 2: a racer touched the brick last frame.
  readonly isTouchedLastFrame: boolean
}

// A coloured power-up brick (0x68 bytes, constructor 0x00457640, vtable 0x004b1710).
export type PowerUpBrick = BrickBase & {
  readonly identifier: number
  // +0x5c: the kind after the race-mode override.
  readonly placedKind: BrickKind
  // +0x60: the kind a racer collects now.
  readonly kind: BrickKind
  // +0x64: the kind shown once the collect animation ends.
  readonly nextKind: BrickKind
  // +0x40: the state entered once the collect animation ends (hidden, or appearing after a swap).
  readonly stateAfterCollect: BrickState
  // +0x48, 3,000 ms.
  readonly respawnDelayMilliseconds: number
}

// A white enhancement ("plus") brick (0x68 bytes, constructor 0x004535a0, vtable 0x004b148c).
export type EnhancementBrick = BrickBase & {
  // +0x54: where it returns to.
  readonly homePosition: Vector3
  // +0x60: milliseconds since it was dropped by a hit racer.
  readonly droppedMilliseconds: number
  // +0x64 bit 0.
  readonly isDropped: boolean
  // +0x64 bit 1: it was released while still on the track, so it goes home after the collect animation.
  readonly isReturningHome: boolean
}

// The power-up fields of one racer (racer +0xccc..+0xd68, constructor 0x00436990).
export type RacerPowerUps = {
  // +0xccc: 0 is none.
  readonly heldBrickKind: BrickKind | null
  // +0xd58, 0..3.
  readonly enhancementLevel: number
  // +0xd5c..+0xd64: the collected enhancement bricks (indices), 0 when empty.
  readonly enhancementBrickIndices: readonly [number | null, number | null, number | null]
  // +0xcd8 and +0xcdc: the computer racer's use check (0x004377f0).
  readonly useCheckElapsedMilliseconds: number
  readonly useCheckIntervalMilliseconds: number
  // +0xd44: no voice is played while non-zero.
  readonly voiceCooldownMilliseconds: number
  // +0xd40: the driver's first voice sound.
  readonly voiceSoundBase: number
}

// What a racer reports about itself to the power-ups (flags at racer +0xd04 and others).
export type RacerPowerUpStatus = {
  readonly position: Vector3
  // Frame rotation row 0 (frame +0x28), the direction targets are searched in.
  readonly forward: Vector3
  // +0xd08 == 2.
  readonly isComputer: boolean
  // +0xd04 & 0x1, with the level at +0xd6c.
  readonly isShielded: boolean
  readonly shieldLevel: number
  // +0xd04 & 0x8 (set by 0x00439570).
  readonly isTumbling: boolean
  // +0xd04 & 0x10 (0x004395d0).
  readonly isWarping: boolean
  // +0xd04 & 0x800 (0x00439900).
  readonly isCursed: boolean
  // +0xd04 & 0x1000: a computer racer does not use a turbo brick at level 3 (0x00438f20; meaning unknown).
  readonly isWarpWithheld: boolean
  // +0xd04 & 0x200000 (0x0045d560).
  readonly isWarpPending: boolean
  // +0xaa8 & 0x2. Hypothesis: off the ground.
  readonly isAirborne: boolean
  // +0xaa8 & 0x80: already thrown by a lightning wand.
  readonly isStruckByLightning: boolean
  // +0xc84 & 0x1 (0x004396c0).
  readonly isInTurbo: boolean
}

// Racer description byte +0xf, copied to racer +0xd04 by 0x00436df0 for computer racers.
export type RacerPowerUpAbilities = {
  // 0x40 → +0xd04 0x1000000: every brick is used as a level-1 projectile.
  readonly isAlwaysGrapple: boolean
  // 0x80 → 0x2000000: every brick is used at level 3.
  readonly isAlwaysLevelThree: boolean
  // 0x02 → 0x8000000: a level-2 turbo is kept running and turbo bricks are only used at level 3.
  readonly isPermanentTurbo: boolean
}

// A computer racer's power-up personality: racer-ai's chances (racer +0xd1c..+0xd1f) and racer +0xcd0, +0xcd4.
export type ComputerPowerUpPersonality = {
  readonly chances: ComputerPersonality
  // +0xcd0 and +0xcd4: hold this kind until this level.
  readonly preferredKind: BrickKind | null
  readonly preferredLevel: number
}

export type ConeQueryTarget = {
  readonly position: Vector3
}

export type ConeQuery = {
  readonly origin: Vector3
  readonly direction: Vector3
  readonly window: ConeQueryWindow
  readonly targets: readonly ConeQueryTarget[]
}

// 0x0043ca60 and siblings: a squared-distance window and a minimum cosine.
export type ConeQueryWindow = {
  readonly minimumDistanceSquared: number
  readonly maximumDistanceSquared: number
  readonly minimumCosine: number
}

export type AttachmentSlots = {
  // Power-up system +0x1878, one bit per slot.
  readonly usedMask: number
  // +0x187c.
  readonly usedCount: number
}

// One pooled power-up effect object; the original's classes are listed in power-ups.md.
export type PowerUpEffect = {
  readonly id: number
  readonly kind: PowerUpEffectKind
  // +0x04.
  readonly state: EffectState
  // +0x08, unsigned milliseconds counting down.
  readonly timerMilliseconds: number
  // +0x14.
  readonly level: number
  // The racer who used it (racer index), or null.
  readonly ownerRacer: number | null
  // The racer it latched on to, homes in on or captured, or null.
  readonly targetRacer: number | null
  // Cannon +0x2c, grapple +0x28: the TGB point aimed at instead of a racer, or null.
  readonly targetTrackPoint: number | null
  readonly attachmentSlotIndices: readonly number[]
  // Rocket +0x220: which of the three rockets.
  readonly rocketIndex: number
  // Wand +0x224: milliseconds towards the next 50 ms jitter draw.
  readonly jitterMilliseconds: number
  // Wand +0x22c: milliseconds to the next spark.
  readonly sparkMilliseconds: number
  // Wand +0x240: milliseconds the struck racer has been held.
  readonly heldMilliseconds: number
  // Oil slick +0x60: the bubble emitter exists (created when the slick lands).
  readonly isBubbleEmitterActive: boolean
}

export type PowerUpEffects = {
  readonly effects: readonly PowerUpEffect[]
  // Power-up system +0x1880, head first.
  readonly activeEffectIds: readonly number[]
  // +0x78..+0xa0, one free list per kind, head first.
  readonly freeEffectIds: Readonly<Record<PowerUpEffectKind, readonly number[]>>
  readonly attachmentSlots: AttachmentSlots
}

export type PowerUpWorld = {
  readonly bricks: readonly PowerUpBrick[]
  readonly enhancementBricks: readonly EnhancementBrick[]
  readonly racers: readonly RacerPowerUps[]
  readonly effects: PowerUpEffects
  // +0x199c, radians.
  readonly brickSpinAngle: number
  readonly random: RandomState
}

// Which brick a racer touched this frame, reported by the collision registry (0x0043d270).
export type BrickContact = {
  readonly racer: number
  readonly brick: number
}

export type ActivationRequest = {
  readonly category: BrickKind
  readonly level: number
}

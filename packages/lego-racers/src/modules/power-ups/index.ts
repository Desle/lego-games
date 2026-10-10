export { activatePowerUp } from './controller/activate-power-up/activate-power-up.ts'
export {
  advanceComputerPowerUpUse,
  keepPermanentTurbo,
  rollComputerStartTurbo,
} from './controller/computer-power-up-use/computer-power-up-use.ts'
export {
  endProjectileFlight,
  hitRacerWithProjectile,
  touchHazardEffect,
} from './controller/power-up-effect-hits/power-up-effect-hits.ts'
export {
  advancePowerUpEffect,
  updatePowerUpEffects,
} from './controller/power-up-effect-timeline/power-up-effect-timeline.ts'
export {
  createPowerUpEffects,
  NoPowerUpEffectToTakeError,
} from './controller/power-up-effects/power-up-effects.ts'
export { UnknownIndexError } from './controller/power-up-step/power-up-step.ts'
export type { PowerUpContext, PowerUpStep } from './controller/power-up-step/power-up-step.types.ts'
export {
  createPowerUpWorld,
  setBrickSoundsEnabled,
  touchEnhancementBricks,
  touchPowerUpBricks,
  updatePowerUps,
} from './controller/power-up-world/power-up-world.ts'
export type { PowerUpWorldDefinition } from './controller/power-up-world/power-up-world.types.ts'
export { usePowerUp } from './controller/use-power-up/use-power-up.ts'
export type { PowerUpEvent } from './events/power-up.events.types.ts'
export { ATTACHMENT_SLOT_COUNT } from './types/attachment-slots/attachment-slots.ts'
export {
  BrickKind,
  getBrickKindCode,
  getBrickKindFromCode,
  getRaceModeBrickKind,
  RaceModeFlag,
  UnknownBrickKindError,
} from './types/brick-kind/brick-kind.ts'
export type { GroundQuery } from './types/enhancement-brick/enhancement-brick.types.ts'
export {
  BrickState,
  EffectState,
  getPowerUpEffectKind,
  InvalidEnhancementLevelError,
  POWER_UP_EFFECT_POOL_SIZES,
  PowerUpEffectKind,
} from './types/power-up-effect-kind/power-up-effect-kind.ts'
export { getRacerWithVoiceCooldownAdvanced } from './types/racer-power-ups/racer-power-ups.ts'
export type {
  ActivationRequest,
  BrickContact,
  ComputerPowerUpPersonality,
  ConeQueryTarget,
  EnhancementBrick,
  EnhancementBrickPlacement,
  PowerUpBrick,
  PowerUpBrickPlacement,
  PowerUpEffect,
  PowerUpEffects,
  PowerUpWorld,
  RacerPowerUpAbilities,
  RacerPowerUps,
  RacerPowerUpStatus,
  RandomState,
} from './types/power-ups.types.ts'

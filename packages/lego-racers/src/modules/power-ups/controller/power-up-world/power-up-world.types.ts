import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import type {
  EnhancementBrickPlacement,
  PowerUpBrickPlacement,
  RandomState,
} from '../../types/power-ups.types.ts'

// What the race passes when it loads the power-ups (Race_LoadTrackContent 0x00433480).
export type PowerUpWorldDefinition = {
  readonly bricks: readonly PowerUpBrickPlacement[]
  readonly enhancementBricks: readonly EnhancementBrickPlacement[]
  // Game settings +0x20.
  readonly raceModeFlags: number
  // Race +0x3354: two local players share the screen; the effect pools are smaller (0x00457d30).
  readonly isSplitScreen: boolean
  // Racer +0xd40 and the starting +0xd44 of each racer, set up by the racer module.
  readonly racers: readonly {
    readonly voiceSoundBase: number
    readonly voiceCooldownMilliseconds: number
  }[]
  readonly random: RandomState
}

// Runs every active effect for one frame; the default is updatePowerUpEffects. The projectiles module passes its own,
// which runs a moving effect's movement right after that effect's countdown, as the original's slot 2 does.
export type EffectsUpdater = (
  step: PowerUpStep,
  context: PowerUpContext,
  stepMilliseconds: number
) => PowerUpStep

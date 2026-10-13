import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { PowerUpEvent } from '../../events/power-up.events.types.ts'
import type { GroundQuery } from '../../types/enhancement-brick/enhancement-brick.types.ts'
import type {
  ConeQueryTarget,
  PowerUpWorld,
  RacerPowerUpStatus,
} from '../../types/power-ups.types.ts'

// What the rest of the race tells the power-ups each frame.
export type PowerUpContext = {
  readonly arithmetic: FloatArithmetic
  // Indexed like PowerUpWorld.racers (the racer set's array at +0x140).
  readonly racers: readonly RacerPowerUpStatus[]
  // Game settings +0x20 (power-up system +0x58).
  readonly raceModeFlags: number
  readonly getGroundPoint: GroundQuery
  // The race's TGB points whose flag bit 1 is still set (0x0045c660 clears it).
  readonly trackTargets: readonly ConeQueryTarget[]
  // How many events the step held when the statuses were read: the later ones change the racers as the original's
  // calls do, at once (getRacerStatusNow).
  readonly eventStart: number
}

export type PowerUpStep = {
  readonly world: PowerUpWorld
  readonly events: readonly PowerUpEvent[]
}

export type StepDraws = {
  readonly step: PowerUpStep
  readonly values: readonly number[]
}

import type { PowerUpBrick, RacerPowerUps } from '../power-ups.types.ts'

export type PowerUpBrickTouchResult = {
  readonly brick: PowerUpBrick
  readonly racer: RacerPowerUps
  readonly isCollected: boolean
}

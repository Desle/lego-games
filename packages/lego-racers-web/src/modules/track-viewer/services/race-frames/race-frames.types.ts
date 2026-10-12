import type { RacerControls } from '@lego-games/lego-racers/racer'

// A frame of a scripted race: its time and what the player holds.
export type ControlledFrame = {
  readonly milliseconds: number
  readonly controls: RacerControls
}

// A brick handed to a racer just before a frame runs.
export type ScriptedPowerUpGrant = {
  readonly frame: number
  readonly racer: number
  readonly kind: number
  readonly level: number
}

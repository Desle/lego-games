import type { ControlledFrame, ScriptedPowerUpGrant } from '../race-frames/race-frames.types.ts'
import type { RacerFinish } from '@lego-games/lego-racers/race'
import type { ScenarioRace } from '../scenario-race-options/scenario-race-options.types.ts'

// A scripted race for the browser to run and photograph: what the pixel trace's test hands the page.
export type PixelTraceRequest = {
  readonly race: ScenarioRace
  readonly frames: readonly ControlledFrame[]
  readonly powerUpGrants: readonly ScriptedPowerUpGrant[]
  readonly racerFinishes: readonly RacerFinish[]
  // The frames whose pixels are read back.
  readonly recordFrames: readonly number[]
  // The HUD overlay is painted over the viewport's pixels.
  readonly isHudIncluded: boolean
  readonly width: number
  readonly height: number
}

// The pixels of a recorded frame: RGBA bytes, top row first, as base64.
export type PixelTraceFrame = {
  readonly frame: number
  readonly colorsBase64: string
}

export type PixelTraceResult = {
  readonly frames: readonly PixelTraceFrame[]
}

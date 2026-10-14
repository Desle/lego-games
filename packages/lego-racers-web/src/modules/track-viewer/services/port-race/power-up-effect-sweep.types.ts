import type {
  EffectSweepFrame,
  EffectSweepResult,
} from '../../../../shared/effect-sweep/effect-sweep.types.ts'
import type { PixelTraceRequest } from '../pixel-trace-harness/pixel-trace-harness.types.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

// A power-up of the sweep: its brick colour (kind 1 red projectile, 2 blue shield, 3 green turbo, 4 yellow hazard) and level (the
// white enhancement bricks, 0 to 3), fired by the player in a fixed race.
export type PowerUpEffectCase = {
  readonly name: string
  readonly kind: number
  readonly level: number
  readonly request: TraceScenarioRequest
}

// The three ways the sweep draws a case: the port as is, the remastered layer with no file for any effect, and the layer with the
// player's own files.
export type EffectSweepMode = 'classic' | 'hd_empty' | 'hd_files'

// What a sweep check found wrong: `texture` (Classic: the pixels of an effect picture of the original differ in the port),
// `count` (an effect element is drawn a different number of times than in Classic), `doubled` (the layer's drawing and the
// original's are both drawn), `file` (the folder has a file but the original still draws), `parts` (a layer drawing has fewer
// posed parts than the original's mesh has bone groups), `hidden` (an effect element is in the scene but not on the screen),
// `webgl` (a draw raised a WebGL error).
export type EffectSweepCheck =
  'texture' | 'count' | 'doubled' | 'file' | 'parts' | 'hidden' | 'webgl'

export type EffectSweepFailure = {
  readonly caseName: string
  readonly mode: EffectSweepMode
  readonly check: EffectSweepCheck
  readonly key: string
  readonly detail: string
}

// A failure the sweep is known to find until a branch fixes it: listed so the sweep is green now, and it fails as soon as the
// failure is gone (the entry must then be removed), so the list only shrinks.
export type KnownEffectSweepGap = {
  readonly caseName: string
  readonly mode: EffectSweepMode
  readonly check: EffectSweepCheck
  readonly key: string
  // What is wrong and the branch that fixes it.
  readonly reason: string
}

// The pixels the original paints with one texture over a case's recorded frames, and how many of them the port gets wrong.
export type EffectTextureCoverage = {
  readonly hash: string
  readonly label: string
  readonly pixelCount: number
  readonly differingCount: number
}

// A piece of the effect on a frame of the original: an 8-connected region of the pixels the effect's pictures paint, named by the
// picture that paints most of it, with its bounds and how many of its pixels the port gets wrong.
export type EffectRegion = {
  readonly frame: number
  readonly hash: string
  readonly label: string
  readonly pixelCount: number
  readonly differingCount: number
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

// The page of the effect sweep: the runner `installEffectSweepHarness` hangs on the window.
export type EffectSweepWindow = {
  readonly runEffectSweep: (request: PixelTraceRequest) => Promise<EffectSweepResult>
}

// A case's frames as each mode drew them.
export type EffectSweepRun = {
  readonly mode: EffectSweepMode
  readonly frames: readonly EffectSweepFrame[]
  readonly calls: EffectSweepResult['calls']
  readonly webglErrors: readonly number[]
}

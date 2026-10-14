// What drew an effect element of a frame: the original's model, particle quads or world, or a drawing the remastered layer
// returned in place of one.
export type EffectOrigin = 'original' | 'layer'

// An effect model of POWERUP.WDB (by its mesh file's stem), the original's quads of a particle material (by the material), or an
// instance of the warp's world (by its name).
export type EffectElementKind = 'model' | 'particle' | 'world'

// The effect elements of one key a recorded frame draws: how many objects, how many separately posed parts the layer's drawings
// have (a drawing of a mesh on several bone groups draws a part for each; an original object counts one), how many of the layer's
// drawings are empty by design (in place of a shield's inside), and how many pixels change when all of them are hidden.
export type EffectSighting = {
  readonly origin: EffectOrigin
  readonly kind: EffectElementKind
  readonly key: string
  readonly count: number
  readonly emptyCount: number
  readonly partCounts: readonly number[]
  readonly changedPixels: number
}

// A recorded frame of the sweep: the pixels (RGBA, top row first, base64), what the frame's noise is (two unchanged draws), and
// the effect elements it draws.
export type EffectSweepFrame = {
  readonly frame: number
  readonly colorsBase64: string
  readonly unchangedDifference: number
  readonly sightings: readonly EffectSighting[]
}

// A call of the layer's effect hooks in the run: the model or material it asked for and whether the folder had a file for it.
export type EffectSweepCall = {
  readonly key: string
  readonly isModelPresent: boolean
  readonly isDrawingReturned: boolean
}

export type EffectSweepResult = {
  readonly frames: readonly EffectSweepFrame[]
  readonly calls: readonly EffectSweepCall[]
  // The WebGL errors the run's renderers raised.
  readonly webglErrors: readonly number[]
}

import type { Object3D, Scene, WebGLRenderer } from 'three'
import type { HookCall, HookKind } from './hd-coverage.types.ts'

// The meshes of a drawing that share a material kind (`MeshPhysicalMaterial`, ... and whether it shows a picture), and how many
// pixels of the frame change when only they are hidden.
export type OnScreenMaterialGroup = {
  readonly material: string
  readonly isPictured: boolean
  readonly meshCount: number
  readonly changedPixels: number
}

// A drawing the layer returned that a measured frame draws, and how many pixels change when it is hidden.
export type OnScreenDrawing = {
  readonly callId: number
  readonly hook: HookKind
  readonly key: string
  readonly changedPixels: number
  readonly groups: readonly OnScreenMaterialGroup[]
  // Of a drawing drawn as several posed parts (POSED_BONE_KEY: the twin turbo's two burners), how many pixels change when each
  // part alone is hidden; empty for a drawing of one part.
  readonly posedPartPixels: readonly number[]
}

// A frame drawn again with each drawing and each of its material groups hidden in turn: the WebGL errors its draws raised, how many
// pixels differ between two unchanged draws (the noise), and every drawing's change.
export type OnScreenFrame = {
  readonly label: string
  readonly webglErrors: readonly number[]
  readonly unchangedDifference: number
  readonly drawings: readonly OnScreenDrawing[]
}

// Draws the place's frame again and returns the canvas the player sees, read in the same task (a WebGL canvas keeps its pixels
// only until the page composites it).
export type FrameDrawer = () => HTMLCanvasElement

// A drawing a call returned, found visible in a scene the measured frame drew.
export type VisibleLayerDrawing = {
  readonly call: HookCall
  readonly object: Object3D
}

// The scenes and renderers drawn with between `start` and `stop`.
export type RenderWatch = {
  readonly start: () => void
  readonly stop: () => void
  readonly getScenes: () => ReadonlySet<Scene>
  readonly getRenderers: () => ReadonlySet<WebGLRenderer>
}

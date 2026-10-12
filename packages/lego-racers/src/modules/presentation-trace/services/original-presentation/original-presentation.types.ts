import type { OriginalRenderState } from '../../types/presentation-trace.types.ts'

// The emulator's JSON lines (presentation_trace.py, render_trace.py), named as they are written.
export type TextureLine = {
  readonly hash: string
  readonly width: number
  readonly height: number
  readonly pitch: number
  readonly bitsPerPixel: number
  readonly masks: readonly number[]
  readonly pixels: string
  readonly colorKey?: readonly [number, number] | null
}

export type ViewportLine = {
  readonly kind: 'viewport'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type DrawLine = {
  readonly kind: 'draw'
  readonly primitive: number
  readonly fvf: number
  readonly state: number
  readonly texture: string | null
  readonly vertices: string
  readonly vertexCount: number
  readonly indices?: string
  readonly clip?: readonly number[]
  readonly model?: readonly number[]
}

export type OtherRenderEventLine = { readonly kind: 'clear' }

export type RenderFrameLine = {
  readonly frame: number
  readonly states: readonly OriginalRenderState[]
  readonly events: readonly (ViewportLine | DrawLine | OtherRenderEventLine)[]
}

export type AudioFrameLine = {
  readonly frame: number
  readonly events: readonly { readonly kind: string; readonly [name: string]: unknown }[]
}

export type DecalFrameLine = {
  readonly frame: number
  readonly decals: readonly {
    readonly source: number
    readonly triangles: readonly (readonly (readonly number[])[])[]
    readonly ownerState: number
    readonly ownerAlpha: number
    readonly position: readonly number[]
  }[]
}

export type DoneLine = {
  readonly frames: number
}

// A line of the emulator's output.
export type PresentationTraceLine =
  | ({ readonly type: 'texture' } & TextureLine)
  | ({ readonly type: 'render_frame' } & RenderFrameLine)
  | ({ readonly type: 'audio_frame' } & AudioFrameLine)
  | ({ readonly type: 'decal_frame' } & DecalFrameLine)
  | ({ readonly type: 'done' } & DoneLine)

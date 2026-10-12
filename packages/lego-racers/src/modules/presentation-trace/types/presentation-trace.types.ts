// What the player sees and hears, as the original produces it in the emulator (reverse-engineering/emulator/presentation_trace.py).

export type PresentationFrameInput = {
  readonly milliseconds: number
  readonly scanCodes: readonly number[]
}

export type PresentationScenario = {
  readonly name: string
  readonly raceFolder: string
  readonly racerCodes: readonly string[]
  readonly racerCount: number
  readonly localPlayerCount: number
  readonly circuitName: string
  readonly isMirrored: boolean
  // Game mode 2 (settings +0x24): the race has the champion's ghost.
  readonly isTimeTrial?: boolean
  readonly frames: readonly PresentationFrameInput[]
  // The frames whose draws are recorded (draws are large); null records every frame.
  readonly recordFrames: readonly number[] | null
  readonly isRenderRecorded: boolean
  // Whether the triangles the decals hold are recorded too (reverse-engineering/emulator/decal_trace.py).
  readonly isDecalRecorded?: boolean
  // Bricks handed to racers at a frame (the golden trace's grants).
  readonly powerUpGrants?: readonly {
    readonly frame: number
    readonly racer: number
    readonly kind: number
    readonly level: number
  }[]
}

// A scripted visit to the front end: the keys of each frame are tapped (pressed and released within it).
export type FrontEndScenario = {
  readonly name: string
  readonly frames: readonly PresentationFrameInput[]
  readonly recordFrames: readonly number[] | null
  readonly isRenderRecorded: boolean
  // Screens put on the screen stack in a frame (a screen the keys cannot reach: the awards, the introductions).
  readonly pushScreens?: readonly { readonly frame: number; readonly screenId: number }[]
}

// DDPIXELFORMAT masks of a texture surface (red, green, blue, alpha) and its raw rows.
export type OriginalTexture = {
  readonly hash: string
  readonly width: number
  readonly height: number
  readonly pitch: number
  readonly bitsPerPixel: number
  readonly masks: readonly number[]
  readonly pixels: Uint8Array
}

// One vertex as Direct3D received it (FVF 0x1c4): the screen position, 1/w, the colours and the texture coordinates.
export type OriginalVertex = {
  readonly x: number
  readonly y: number
  readonly depth: number
  readonly reciprocalW: number
  readonly diffuse: number
  readonly specular: number
  readonly u: number
  readonly v: number
}

export type OriginalRenderState = {
  // D3DRENDERSTATETYPE number -> value
  readonly render: Readonly<Record<string, number>>
  // "stage.D3DTEXTURESTAGESTATETYPE" -> value
  readonly stage: Readonly<Record<string, number>>
}

export type OriginalDraw = {
  readonly primitive: number
  readonly fvf: number
  readonly stateIndex: number
  readonly textureHash: string | null
  readonly vertices: readonly OriginalVertex[]
  // Triangle list indices into `vertices`; null for a non-indexed draw.
  readonly indices: readonly number[] | null
  // GolDP's model-to-clip matrix of the draw (device +0xc8490, row vectors) and its viewport scale; empty when unknown.
  readonly clipMatrix: readonly number[]
  readonly modelMatrix: readonly number[]
}

export type OriginalViewport = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type OriginalRenderFrame = {
  readonly frame: number
  readonly viewport: OriginalViewport | null
  readonly states: readonly OriginalRenderState[]
  readonly draws: readonly OriginalDraw[]
}

// One triangle a decal holds: three corners of world x, y, z and picture u, v.
export type OriginalDecalTriangle = readonly (readonly number[])[]

// A decal object that held triangles at the end of a frame, and the address of the call that projected it last.
export type OriginalDecal = {
  readonly source: number
  readonly triangles: readonly OriginalDecalTriangle[]
  // For an explosion's scar: the explosion's state (2 growing, 3 fading) and its alpha, +0x04 and +0x23c of the owner.
  readonly ownerState: number
  readonly ownerAlpha: number
  // The point the last projection was placed at (decal +0xe8).
  readonly position: readonly number[]
}

export type OriginalDecalFrame = {
  readonly frame: number
  readonly decals: readonly OriginalDecal[]
}

export type OriginalAudioEvent = {
  readonly kind: string
  readonly values: Readonly<Record<string, unknown>>
}

export type OriginalAudioFrame = {
  // -1 is the race's loading, before the first frame.
  readonly frame: number
  readonly events: readonly OriginalAudioEvent[]
}

export type OriginalPresentation = {
  readonly textures: ReadonlyMap<string, OriginalTexture>
  readonly renderFrames: readonly OriginalRenderFrame[]
  readonly audioFrames: readonly OriginalAudioFrame[]
  readonly decalFrames: readonly OriginalDecalFrame[]
}

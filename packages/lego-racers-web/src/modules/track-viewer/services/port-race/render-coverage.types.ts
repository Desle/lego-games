// One race of the catalog the sweep visits.
export type CoverageRace = {
  readonly catalogName: string
  readonly raceFolder: string
  readonly circuitName: string
  readonly isMirrored: boolean
  readonly racerCodes: readonly string[]
}

// Where the port's demonstration race (the computer drives racer 0) is at: the frames the sweep records.
export type CoverageLapProbe = {
  readonly lapEndFrame: number | null
  readonly finishFrame: number | null
  readonly probedFrameCount: number
}

export type CoverageOptions = {
  readonly intervalFrames: number
  readonly maximumFrames: number
}

export type CoverageBounds = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

// What the original drew with one texture, and how much of it the port has a partner for.
export type CoverageTextureRow = {
  // The port texture that looks like the original's surface, or `unknown <hash> <width>x<height>` when none does.
  readonly textureName: string
  readonly isTextureInPort: boolean
  // The render state in words: `opaque`, `alpha_test`, `blend`, `additive`, with the colour operation.
  readonly stateLabel: string
  readonly originalTriangles: number
  readonly missingTriangles: number
  // Screen pixels the unmatched triangles cover, summed over the recorded frames.
  readonly missingPixels: number
  readonly missingFrames: readonly number[]
  // The screen rectangle around the unmatched triangles' corners, and the nearest and farthest depth (1/w) among them.
  readonly missingBounds: CoverageBounds | null
  readonly missingDepthRange: readonly [number, number] | null
  // Port objects that use the texture (none: the port never draws it on screen).
  readonly portSources: readonly string[]
}

// What the port drew that the original did not.
export type CoverageExtraRow = {
  readonly source: string
  readonly textureName: string
  readonly triangles: number
  readonly frames: readonly number[]
}

// Triangles both drew whose texture, picture coordinates, colour or state differ: how an animation the port leaves static shows.
export type CoverageMismatchRow = {
  readonly kind: string
  readonly source: string
  readonly triangles: number
  readonly frames: readonly number[]
  readonly firstDetail: string
  readonly lastDetail: string
}

export type CoverageFrameRow = {
  readonly frame: number
  readonly originalCount: number
  readonly portCount: number
  readonly matchedCount: number
  // False when too little matched for the frame to say anything (the port's race left the original's): it is not tallied.
  readonly isTrusted: boolean
}

export type RaceCoverage = {
  readonly race: CoverageRace
  readonly probe: CoverageLapProbe
  readonly recordedFrames: readonly number[]
  readonly frames: readonly CoverageFrameRow[]
  readonly textures: readonly CoverageTextureRow[]
  readonly extras: readonly CoverageExtraRow[]
  readonly mismatches: readonly CoverageMismatchRow[]
}

// Running totals while the frames are tallied.
export type TextureAccumulator = {
  readonly textureName: string
  readonly isTextureInPort: boolean
  readonly stateLabel: string
  originalTriangles: number
  missingTriangles: number
  missingPixels: number
  readonly missingFrames: number[]
  missingBounds: CoverageBounds | null
  missingDepthRange: [number, number] | null
}

export type GroupAccumulator = {
  readonly kind: string
  readonly source: string
  readonly textureName: string
  triangles: number
  readonly frames: number[]
  readonly firstDetail: string
  lastDetail: string
}

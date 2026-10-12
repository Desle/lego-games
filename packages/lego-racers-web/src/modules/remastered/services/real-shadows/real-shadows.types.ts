export type SunDirection = readonly [number, number, number]

// The light the track was baked with, in the track's own frame: the unit vector towards the sun, and the brightness of a
// surface turned away from the sun relative to one facing it (the ambient share, 0 to 1).
export type SunLight = {
  readonly direction: SunDirection
  readonly ambientShare: number
}

export type SunEstimate = SunLight & {
  // The share of the baked brightness's variance the light explains (0 to 1).
  readonly fit: number
  readonly triangleCount: number
}

// Triangles of the prelit track: unit normals (3 per triangle), baked brightness (0 to 1) and area weights.
export type TriangleSamples = {
  readonly normals: Float32Array
  readonly brightness: Float32Array
  readonly weights: Float32Array
  // The material each triangle has (its brightness is the material's colour times the light, so only the variation inside
  // a material tells about the light).
  readonly groups: Uint16Array
  readonly groupCount: number
}

// The shadow of a cone of light from a direction: one fitted line `brightness = ambient + diffuse * max(0, normal . direction)`.
export type SunFit = {
  readonly ambient: number
  readonly diffuse: number
  readonly fit: number
}

export type GroupSums = {
  readonly weight: Float64Array
  readonly lit: Float64Array
  readonly brightness: Float64Array
  readonly litLit: Float64Array
  readonly litBrightness: Float64Array
  readonly brightnessBrightness: Float64Array
}

export type Candidate = {
  readonly azimuthDegrees: number
  readonly elevationDegrees: number
  readonly fit: SunFit
}

export type Accumulator = {
  normals: number[]
  brightness: number[]
  weights: number[]
  groups: number[]
}

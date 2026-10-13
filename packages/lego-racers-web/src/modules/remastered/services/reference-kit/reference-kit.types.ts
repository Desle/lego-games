// Triangles in studs (x forward, y to the left, z up), with a colour for each triangle.
export type ReferenceFaces = {
  // x, y, z per corner, three corners per triangle.
  readonly positions: Float32Array
  // r, g, b per triangle.
  readonly colors: Uint8Array
}

// A colour of the library as the sheets name it.
export type LDrawColorName = {
  readonly code: number
  readonly name: string
  readonly red: number
  readonly green: number
  readonly blue: number
}

// A wheel of a chassis in the car's frame, in studs.
export type WheelMount = {
  readonly centre: readonly [number, number, number]
  readonly radius: number
  readonly width: number
  // The car axis the wheel turns about: x, y or z.
  readonly axle: string
}

export type ReferenceBounds = {
  readonly minimum: readonly [number, number, number]
  readonly maximum: readonly [number, number, number]
}

export type ReferenceView = {
  readonly name: string
  // Screen right and up as signed car axes: [axis index, sign].
  readonly right: readonly [number, number]
  readonly up: readonly [number, number]
  // The axis that points toward the viewer, as [axis index, sign].
  readonly toward: readonly [number, number]
}

export type Hsv = {
  readonly hue: number
  readonly saturation: number
  readonly value: number
}

export type LDrawColorShare = LDrawColorName & {
  // The part of the triangles that are this colour, 0 to 1.
  readonly share: number
}

// What a reference sheet shows: a title, lines of text, the triangles, the wheel mounts and the colours as the legend lists them.
export type ReferenceSheetContent = {
  readonly title: string
  readonly lines: readonly string[]
  readonly faces: ReferenceFaces
  readonly wheelMounts: readonly WheelMount[]
  // Where the race seats the driver (the chassis's seat point, studs, in the sheet's frame): the steering wheel goes in front of it.
  readonly seat: readonly [number, number, number]
  readonly colorLines: readonly { readonly label: string; readonly hex: string }[]
}

// Where one view of a sheet lies on the page, and the range it shows (in studs along its own axes).
export type ReferenceSheetPanel = {
  readonly view: ReferenceView
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly uMinimum: number
  readonly vMaximum: number
}

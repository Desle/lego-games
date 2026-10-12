import type { Frame, Vector3 } from '../../simulation-math/index.ts'

// Four bytes in the order the ribbon stores them (+0x160, +0x164, +0x168).
export type RibbonColor = readonly [number, number, number, number]

// What the constructor 0x00493c90 fixes for a ribbon class: how many rings lie on a segment and how each ring's vertices
// sit round the ring's centre.
export type RibbonShape = {
  // +0xe0.
  readonly ringsPerSegment: number
  // +0xec: one offset per vertex of a ring, in the frame of the segment.
  readonly vertexOffsets: readonly Vector3[]
  // +0x128: the texture coordinate across the ring, one per vertex.
  readonly textureU: readonly number[]
  // +0x13c: the ring counter that runs along the ribbon is the texture's v; it wraps after this many.
  readonly wrapRingCount: number
  // Material flag 8 (config +0x14, +8): the counter wraps and a ring is repeated at the wrap.
  readonly isWrapped: boolean
  // +0x160: the colour at both ends of a segment.
  readonly endColor: RibbonColor
  // +0x164: the colour at the control point of a segment that bulges to the positive side.
  readonly positiveControlColor: RibbonColor
  // +0x168: the colour at the control point of a segment that does not.
  readonly negativeControlColor: RibbonColor
}

// One call of 0x00494870: a segment from the previous end to `end`, its middle bulging sideways by `bulge`.
export type RibbonSegment = {
  readonly end: Vector3
  readonly bulge: number
  // The rings' jitter in the segment's frame (0x00494be0), one entry per ring; null without.
  readonly jitter: readonly Vector3[] | null
}

// 0x00493ea0 and the calls after it: the ribbon starts at `begin`, its frame's first axis along `direction`.
export type RibbonRequest = {
  readonly begin: Vector3
  readonly direction: Vector3
  // The jitter the first ring takes (the array 0x00494be0 last set), null before any was set.
  readonly initialJitter: Vector3 | null
  readonly segments: readonly RibbonSegment[]
}

export type RibbonCorner = {
  readonly position: Vector3
  readonly u: number
  readonly v: number
  readonly color: RibbonColor
}

// One ring laid along the ribbon: where each vertex sits in the frame of the segment's bone, the colour and the texture's v.
export type RibbonRing = {
  // Each vertex in its segment's frame: the ring's centre, the vertex offset and the jitter.
  readonly locals: readonly Vector3[]
  readonly color: RibbonColor
  readonly v: number
  // The bone (segment) the ring belongs to.
  readonly bone: number
}

// A segment's bone (0x00494030): where the segment starts and how it points, in the ribbon figure's own frame.
export type Bone = {
  readonly frame: Frame
}

// The skinned strip 0x00494870 leaves in the figure: its frame, the bones, the rings and which ring joins which.
export type RibbonSkin = {
  readonly figure: Frame
  readonly bones: readonly Bone[]
  readonly rings: readonly RibbonRing[]
  // The strips: [ring, the ring laid before it].
  readonly pairs: readonly (readonly [number, number])[]
  readonly textureU: readonly number[]
}

// A ribbon an effect draws: the skin, in the material it is drawn with. A ribbon that faces the camera turns its bones to
// the camera when it is drawn (0x00494ca0).
export type RibbonView = {
  readonly materialName: string
  readonly skin: RibbonSkin
  readonly isFacingCamera: boolean
}

// A point with the colour it carries (0x00494ad0 interpolates both).
export type ColoredPoint = {
  readonly point: Vector3
  readonly color: RibbonColor
}

// A ring about to be laid: its centre in the segment's frame, its colour and the jitter it takes.
export type PlacedRing = {
  readonly center: Vector3
  readonly color: RibbonColor
  readonly jitter: Vector3 | null
}

// The strip while 0x00494870 builds it.
export type RibbonBuild = {
  rings: RibbonRing[]
  bones: Bone[]
  pairs: [number, number][]
}

import type { Vector3 } from '../../simulation-math/index.ts'

// The colour bytes of a trail (+0xd8..+0xdb); the alpha fades along the trail.
export type TrailColor = {
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly alpha: number
}

// What Trail_Start (0x00492ae0) reads of its parameter block, and the colour and material set after it.
export type TrailParameters = {
  // +0x00: the milliseconds the trail covers (rounded down to a multiple of the ring size).
  readonly durationMilliseconds: number
  // +0x04: the rings a trail keeps (the pool slots are two more).
  readonly ringSize: number
  // +0x08: the points of one ring.
  readonly verticesPerRing: number
  // +0x14 (1.0: the rings keep their points) and +0x18 (the alpha fraction the trail loses along its length).
  readonly fadeFactor: number
  readonly alphaReduction: number
  readonly color: TrailColor
  readonly materialName: string
}

// One slot of the ring buffer (0x4c bytes from +0xdc): the milliseconds it holds, its points and its centre.
export type TrailSlot = {
  readonly milliseconds: number
  readonly vertices: readonly Vector3[]
  readonly center: Vector3
}

export type TrailVertex = {
  readonly position: Vector3
  readonly u: number
  readonly v: number
  readonly color: TrailColor
}

export type TrailTriangle = {
  readonly first: number
  readonly second: number
  readonly third: number
}

// What Trail_BuildMesh (0x004931a0) writes into the dynamic mesh: the points are relative to `origin`, where the mesh sits.
export type TrailMesh = {
  readonly origin: Vector3
  readonly vertices: readonly TrailVertex[]
  readonly triangles: readonly TrailTriangle[]
}

// One trail of the pool (0x2a4 bytes; flags at +0x9c).
export type ProjectileTrail = {
  // Bit 0x1: in use.
  readonly isActive: boolean
  // Bit 0x2: let go, the rings age out.
  readonly isReleasing: boolean
  // Bit 0x8: no ring was pushed yet.
  readonly isAwaitingFirstRing: boolean
  // Bit 0x10: the rings are old enough to age.
  readonly isAgeing: boolean
  // Bit 0x20: the mesh was built once, so it is drawn.
  readonly isBuilt: boolean
  // +0xa0, +0xa4: the milliseconds covered and one slot holds.
  readonly durationMilliseconds: number
  readonly sliceMilliseconds: number
  // +0xa8, +0xac: the slot being filled and the oldest one.
  readonly writeIndex: number
  readonly readIndex: number
  // +0xb4, +0xb8, +0xbc.
  readonly ringSize: number
  readonly slotCount: number
  readonly verticesPerRing: number
  // +0xd0, +0xd4.
  readonly fadeFactor: number
  readonly alphaReduction: number
  readonly color: TrailColor
  readonly materialName: string
  readonly slots: readonly TrailSlot[]
  readonly mesh: TrailMesh | null
}

// The pool every trail of a race shares (world +0x44).
export type TrailPool = {
  readonly trails: readonly ProjectileTrail[]
}

export type TrailAllocation = {
  readonly pool: TrailPool
  // Null when no trail was free.
  readonly index: number | null
}

// The points one update hands to Trail_PushRing (0x00492ee0): the ring and the centre it fades towards.
export type TrailRing = {
  readonly vertices: readonly Vector3[]
  readonly center: Vector3
}

// A trail to draw (0x00493790).
export type TrailDrawing = {
  readonly materialName: string
  readonly mesh: TrailMesh
}

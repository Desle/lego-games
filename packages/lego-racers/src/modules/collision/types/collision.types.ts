import type { Frame, Vector3 } from '../../simulation-math/index.ts'

// One BVB node as 0x00403fa0 reads it (20 bytes, offsets in the node).
export type CollisionVolumeNode = {
  // +0..+8: the plane normal; the plane passes through the first vertex of the node's first triangle.
  readonly normal: Vector3
  // +0xc, +0xe: the node's triangles (keyword 0x2d entries) as a range.
  readonly firstTriangleIndex: number
  readonly triangleCount: number
  // +0x10 (side the normal points to) and +0x12; 0xfffe and 0xffff mean no child.
  readonly positiveChildIndex: number
  readonly negativeChildIndex: number
}

// One keyword 0x2d entry: three vertex indices (+0, +2, +4) and a material index (+6), all uint16.
export type CollisionVolumeTriangle = {
  readonly vertexIndices: readonly [number, number, number]
  readonly materialIndex: number
}

// A BVB as the race queries it, after the load-time mirror 0x004045e0.
export type CollisionVolume = {
  readonly nodes: readonly CollisionVolumeNode[]
  // Keyword 0x34, the vector list at BVB object +0xc (+8).
  readonly vertices: readonly Vector3[]
  readonly triangles: readonly CollisionVolumeTriangle[]
  readonly materialNames: readonly string[]
}

// The 13-float triangle record the query writes (the global 0x004c6db8 in the race code).
export type CollisionTriangle = {
  readonly vertices: readonly [Vector3, Vector3, Vector3]
  // +0x24: unit normal.
  readonly normal: Vector3
  // +0x30: -(vertex 0 · normal).
  readonly planeDistance: number
}

export type SegmentIntersection = {
  readonly point: Vector3
  readonly triangle: CollisionTriangle
  // Index into the material list the query object's +0x24 points to.
  readonly materialIndex: number
  // Where the plane cuts the segment, from start (0) to end (1).
  readonly fraction: number
}

export type SegmentQueryResult = {
  readonly intersection: SegmentIntersection | undefined
  // The query writes its hit-point target at every plane it crosses, so a miss can leave one behind.
  readonly lastCrossingPoint: Vector3 | undefined
}

// One 12-byte entry of the query's node stack (BVB object +0x2c): +0 plane vertex, +4 start distance
// (stored float), +8 node index, +0xa state (0 descend toward the start, 1 test the crossing, 2 done).
export type QueryStackEntry = {
  readonly nodeIndex: number
  readonly state: 0 | 1 | 2
  readonly startDistance: number
}

// The last triangle the crossing point fell in that faced away from the start (0x004042e9).
export type BackFacingTriangle = {
  readonly triangleIndex: number
  readonly crossProduct: Vector3
}

// A point in the plane 0x004497f0 projects onto: the two coordinates left after dropping one axis.
export type ProjectedPoint = {
  readonly first: number
  readonly second: number
}

// A cached triangle's segment test (0x00448b80) also writes the crossing point into its target.
export type TriangleSegmentResult = {
  readonly isInside: boolean
  readonly crossingPoint: Vector3 | undefined
}

// What loadCollisionObject reads: the .BVB file, whether the race is mirrored, and the instance frame.
export type CollisionObjectSource = {
  readonly bytes: Uint8Array
  readonly isMirrored: boolean
  readonly frame: Frame | undefined
}

// One collision object of a car rigid body's list (+0x140, count +0x154, at most five): a world BVB instance.
export type CollisionObject = {
  // The instance's frame; only objects after the first are queried in their own frame.
  readonly frame: Frame
  // Instance +0x58: the BVB.
  readonly volume: CollisionVolume
  // Instance +0x5c: a material list that replaces the volume's own (+0x18) when set.
  readonly materialNames: readonly string[] | undefined
}

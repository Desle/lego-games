export type SkeletonVector = readonly [number, number, number]

// x, y, z, w: 0x10002e30 normalises it and builds the bone's rotation matrix.
export type SkeletonQuaternion = readonly [number, number, number, number]

// One 0xd0-byte bone (constructor 0x10002890: identity matrices).
export type Bone = {
  readonly name: string
  // Keyword 0x28, set by 0x10003000 at +0x40; null keeps the constructor's zero translation.
  readonly position: SkeletonVector | null
  // Keyword 0x29, set by 0x10002e30; null keeps the constructor's identity rotation.
  readonly quaternion: SkeletonQuaternion | null
  // Keyword 0x2a: index of the bone named, linked by 0x1001ceb0; null for a root.
  readonly parentIndex: number | null
}

export type Skeleton = {
  // The last `0x27` block; each block replaces the bones and the name table (0x100149a0, 0x10028250).
  readonly bones: readonly Bone[]
  readonly readByteCount: number
}

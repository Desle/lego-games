export type Vector3 = readonly [number, number, number]
export type Quaternion = readonly [number, number, number, number]

// 0x00422710 records the car body's position truncated to int16 and four truncated bytes from 0x00449460.
export type GhostSample = {
  readonly position: Vector3
  readonly orientationBytes: readonly number[]
}

// Fields whose keyword is absent are null: the loader leaves the ghost's previous values.
export type Ghost = {
  readonly firstIntegers: readonly [number, number, number] | null
  readonly secondInteger: number | null
  // The first sample's full position and quaternion, also written by 0x00422710.
  readonly startPosition: Vector3 | null
  readonly startQuaternion: Quaternion | null
  readonly samples: readonly GhostSample[]
  readonly readByteCount: number
}

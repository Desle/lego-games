export type Vector3 = readonly [number, number, number]
export type Plane = readonly [number, number, number, number]

// The 0x24-byte checkpoint of race +0x27f4 (reset by 0x0041e600).
export type Checkpoint = {
  readonly plane: Plane
  readonly point: Vector3
  // Written by 0x0041e950 after loading; -1 when no walk reached it.
  readonly progress: number
  // Byte 0 is the next checkpoint; bytes 1..3 start branches; 0xff is none.
  readonly links: readonly number[]
}

export type CheckpointList = {
  readonly checkpoints: readonly Checkpoint[]
  readonly readByteCount: number
}

// What 0x0041ea90 returns: the first assigned checkpoint after a branch link, and the steps to it.
export type CheckpointMerge = {
  readonly merge: number
  readonly stepCount: number
}

export type CheckpointBlock = Omit<Checkpoint, 'progress'>

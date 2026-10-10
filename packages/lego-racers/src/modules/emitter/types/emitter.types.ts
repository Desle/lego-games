export type Vector3 = readonly [number, number, number]

// One `0x27 "name" { ... }` block of 0x0048a130, starting from the reset values of 0x0048a0e0.
export type Emitter = {
  readonly name: string
  readonly firstTruncatedValue: number
  readonly secondTruncatedValue: number
  readonly vector: Vector3
  readonly points: readonly Vector3[]
  readonly firstFloat: number
  readonly secondFloat: number
  readonly thirdFloat: number
  readonly fourthFloat: number
  readonly fifthFloat: number
  readonly entryIndex: number | null
  readonly firstInteger: number
  readonly secondInteger: number
  readonly thirdInteger: number
  readonly linkedName: string | null
}

export type EmitterList = {
  readonly emitters: readonly Emitter[]
  readonly readByteCount: number
}

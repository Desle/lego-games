export type Vector3 = readonly [number, number, number]

// One 0x5c-byte entry, named after the surface material it describes (+0x00, 8 characters).
export type TrackMaterial = {
  readonly name: string
  // +0x08: bit 1 once read, plus the bit of every keyword present.
  readonly flags: number
  readonly firstInteger: number
  readonly secondInteger: number
  readonly thirdInteger: number
  readonly fourthInteger: number
  readonly firstVector: Vector3
  readonly secondVector: Vector3
  readonly fifthInteger: number
  readonly sixthInteger: number
  readonly seventhInteger: number
  readonly linkedName: string | null
  readonly firstFloat: number
  readonly secondFloat: number
  readonly thirdFloat: number
  readonly fourthFloat: number
  readonly fifthFloat: number
}

export type TrackMaterialList = {
  readonly trackMaterials: readonly TrackMaterial[]
  readonly readByteCount: number
}

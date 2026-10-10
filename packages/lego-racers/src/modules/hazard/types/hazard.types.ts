export type Vector3 = readonly [number, number, number]

// Values a block leaves out are null: the hazard object keeps what its constructor set.
export type HazardWithoutData = {
  readonly keyword: number
}

export type CannonBlock = {
  readonly firstVector: Vector3 | null
  readonly secondVector: Vector3 | null
  readonly thirdVector: Vector3 | null
  readonly squaredFloat: number | null
  readonly integer: number | null
}

export type Hazard33 = CannonBlock & { readonly keyword: 0x33 }

export type Hazard34 = {
  readonly keyword: 0x34
  readonly integer: number | null
  readonly objectName: string | null
  readonly names: readonly string[]
}

export type Hazard36 = {
  readonly keyword: 0x36
  readonly name: string
  readonly firstFloat: number
  readonly secondFloat: number
}

export type HazardPoint = {
  readonly position: Vector3
  readonly integer: number
}

export type Hazard3D = {
  readonly keyword: 0x3d
  readonly points: readonly HazardPoint[] | null
  readonly secondPoints: readonly HazardPoint[] | null
  readonly block: CannonBlock
}

export type Hazard3E = {
  readonly keyword: 0x3e
  readonly name: string
  readonly integer: number
  readonly float: number
  readonly vector: Vector3
}

export type Hazard40 = {
  readonly keyword: 0x40
  readonly vector: Vector3 | null
  readonly integer: number | null
  readonly name: string | null
  readonly secondInteger: number | null
  readonly secondVector: Vector3 | null
}

export type Hazard43 = {
  readonly keyword: 0x43
  readonly integer: number | null
  readonly name: string | null
  readonly secondInteger: number | null
  readonly secondName: string | null
}

export type Hazard48 = {
  readonly keyword: 0x48
  readonly integer: number | null
  readonly name: string | null
  readonly vector: Vector3 | null
}

export type HazardWithData =
  Hazard33 | Hazard34 | Hazard36 | Hazard3D | Hazard3E | Hazard40 | Hazard43 | Hazard48

export type Hazard = HazardWithoutData | HazardWithData

export type HazardList = {
  readonly hazards: readonly Hazard[]
  readonly readByteCount: number
}

// The 1,024 uint16 values at 0x004befec, each 0..1023, read from the player's LEGORacers.exe.
export type RandomTable = {
  readonly values: readonly number[]
}

// The global position at 0x004c6ee4 (0..1023): explicit state, so a server can synchronise it.
export type RandomTablePosition = number

// One read: the advanced position and the value (or the value's reduction) read there.
export type RandomDraw = {
  readonly position: RandomTablePosition
  readonly value: number
}

export type PortableExecutableSection = {
  readonly name: string
  readonly virtualAddress: number
  readonly virtualSize: number
  readonly rawDataOffset: number
  readonly rawDataSize: number
}

export type PortableExecutableLayout = {
  readonly imageBase: number
  readonly sections: readonly PortableExecutableSection[]
}

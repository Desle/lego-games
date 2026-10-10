export type ByteTriple = readonly [number, number, number]

// One 0x10-byte keyframe; bytes 7, 11 and 15 stay 0xff and are not read from the file.
export type SkyKeyframe = {
  readonly integer: number
  readonly firstBytes: ByteTriple
  readonly secondBytes: ByteTriple
  readonly thirdBytes: ByteTriple
}

// One named 0x10-byte setting at sky +0xa8 (keyframes at +8, count at +0xc).
export type SkySetting = {
  readonly name: string
  readonly keyframes: readonly SkyKeyframe[]
}

export type Sky = {
  readonly settings: readonly SkySetting[]
  readonly selectedSettingName: string | null
  readonly float: number | null
  readonly readByteCount: number
}

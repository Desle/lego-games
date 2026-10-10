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

// The dome `Sky_Load` builds with the sphere builder 0x004907f0: ring-major vertices (ring 0 is nearest the pole).
export type SkyDome = {
  readonly ringCount: number
  readonly segmentCount: number
  readonly vertexCount: number
  // x, y, z per vertex
  readonly positions: Float32Array
  // Three vertex indices per triangle, in the order the builder writes the face bytes.
  readonly triangleCorners: Uint16Array
}

export type SkyDomeParameters = {
  readonly radius: number
  readonly segmentCount: number
}

// One colour per ring, ring 0 (the pole end) first: keyframe bytes +0x0c, +0x08, +0x04 (0x0041cfc0).
export type SkyRingColors = readonly [ByteTriple, ByteTriple, ByteTriple]

// Per setting: milliseconds into the current keyframe and the keyframe index (setting +0x00 and +0x04).
export type SkySettingProgress = {
  readonly elapsedMilliseconds: number
  readonly keyframeIndex: number
}

export type SkyState = {
  readonly sky: Sky
  readonly progress: readonly SkySettingProgress[]
  // Sky +0xb8 and +0xb4.
  readonly currentSettingIndex: number
  readonly previousSettingIndex: number
  // Sky +0xbc and +0xc0: a transition from the previous setting that has not finished while the duration is not 0.
  readonly blendDurationMilliseconds: number
  readonly blendElapsedMilliseconds: number
}

export type SkyPoint = {
  readonly x: number
  readonly y: number
  readonly z: number
}

// Where the sky draws its parts for one camera position (0x0041d040).
export type SkyPlacement = {
  readonly dome: SkyPoint
  readonly backdrop: SkyPoint
}

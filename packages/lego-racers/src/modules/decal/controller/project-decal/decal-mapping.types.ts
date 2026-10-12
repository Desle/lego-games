// 0x00414d50's coefficients (the engine's globals 0x004c3de8..0x004c3e1c): u = uX x + uY y + uZ z + uOffset and the same
// for v.
export type DecalMapping = {
  readonly uX: number
  readonly vX: number
  readonly uY: number
  readonly vY: number
  readonly uZ: number
  readonly vZ: number
  readonly uOffset: number
  readonly vOffset: number
}

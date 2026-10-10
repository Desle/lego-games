export type Vector3 = readonly [number, number, number]

// One 0x27 block of 0x00458a80; the race's mode flags (+0x58) may still override the kind at load.
export type PowerUpBrick = {
  readonly position: Vector3
  // 1..4: 0x2a gives 1, 0x2c gives 2, 0x2d gives 3, 0x2b gives 4.
  readonly kind: number
  readonly identifier: number
}

// One 0x2f block of 0x00458e80, built with the models "enh" and "enhblen".
export type EnhancementBrick = {
  readonly position: Vector3
}

export type PowerUpPlacements = {
  readonly bricks: readonly PowerUpBrick[]
  readonly enhancementBricks: readonly EnhancementBrick[]
  readonly readByteCount: number
}

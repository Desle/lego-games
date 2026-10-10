// The world names a race description (`.RAB`) gives; a parsed RaceDescription has these fields.
export type RaceWorldNames = {
  readonly globalWorld: string | null
  readonly trackWorld: string | null
  readonly collisionWorld: string | null
  readonly blendedWorld: string | null
  readonly localWorld: string | null
}

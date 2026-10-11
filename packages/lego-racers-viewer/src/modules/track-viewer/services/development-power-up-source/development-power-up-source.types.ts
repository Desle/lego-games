// Development only: keys that put a power-up in the player's hands, so every kind and level can be tried in play.
export type DevelopmentPowerUpSource = {
  // The grant asked for since the last call (kind 1..4 at the chosen level), or null.
  readonly take: () => DevelopmentPowerUpRequest | null
  readonly dispose: () => void
}

export type DevelopmentPowerUpRequest = {
  readonly kind: number
  readonly level: number
}

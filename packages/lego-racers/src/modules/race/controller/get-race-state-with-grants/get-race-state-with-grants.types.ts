// A brick put in a racer's hands: its kind code (1..4) and enhancement level (0..3).
export type RaceGrant = {
  readonly racer: number
  readonly kind: number
  readonly level: number
}

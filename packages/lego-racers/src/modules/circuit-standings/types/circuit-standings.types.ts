import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { CircuitResultScreen as CircuitResultScreenValues } from './standings-rules/standings-rules.ts'

export type CircuitResultScreen = EnumValues<typeof CircuitResultScreenValues>

// The points record the circuit runner hands every race (race +0x18, `CircuitRunner +4`, constructor 0x00440220).
export type CircuitStandings = {
  // +0x10..+0x27: each racer's points over the circuit so far.
  readonly totals: readonly number[]
  // +0x28..+0x3f: the points each racer won in the race that last ended.
  readonly racePoints: readonly number[]
}

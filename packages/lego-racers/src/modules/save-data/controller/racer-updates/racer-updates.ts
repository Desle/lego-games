import type { SaveRacer } from '../../types/save-data.types.ts'
import { MAXIMUM_CIRCUIT_RANK } from '../../types/racer-ranks/racer-ranks.ts'
import type { CircuitRankUpdate } from '../../types/racer-ranks/racer-ranks.types.ts'

const RANK_BIT_COUNT = 2
const RANK_MASK = 3

// FUN_0042b640 shifts the 16-bit ranks right by (circuit · 2) & 0x1f (a 16-bit shift by 16 or more leaves 0); a rank of
// 0 means no place was won there yet.
export const getCircuitRank = (racer: SaveRacer, circuitIndex: number): number => {
  const shift = (circuitIndex * RANK_BIT_COUNT) & 0x1f
  return shift >= 16 ? 0 : (racer.circuitRanks >> shift) & RANK_MASK
}

// FUN_0042b640: ranks above 3 are refused, and so is a rank that does not beat the one stored (a stored rank of 0
// counts as none). The result screen passes 1, 2 or 3 for the circuit's first three places (screen 0x16, 0x17, 0x18).
export const recordCircuitRank = (
  racer: SaveRacer,
  circuitIndex: number,
  rank: number
): CircuitRankUpdate => {
  const stored = getCircuitRank(racer, circuitIndex)
  if (rank > MAXIMUM_CIRCUIT_RANK || (stored !== 0 && stored <= rank)) {
    return Object.freeze({ racer, isRecorded: false })
  }
  const shift = (circuitIndex * RANK_BIT_COUNT) & 0x1f
  const circuitRanks = ((racer.circuitRanks & ~(RANK_MASK << shift)) | (rank << shift)) & 0xffff
  return Object.freeze({
    racer: Object.freeze({ ...racer, circuitRanks }),
    isRecorded: true,
  })
}

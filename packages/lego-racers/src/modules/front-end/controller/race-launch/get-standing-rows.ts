import { getStandingRank } from '../../../circuit-standings/index.ts'
import type { GameSession } from '../../../game-session/index.ts'
import type { FrontEndStandingRow } from '../../types/front-end.types.ts'

const PLAYER_NAME = 'You'
const FIRST_PLAYER_INDEX = 0

// The final points of a circuit as the result screens list them, best first (ties keep the racer order, and share the
// better place as the original's rank does, 0x00440300). Racer 0 is the player; the other racers are the circuit's
// drivers in the order of their codes (FUN_0042d730).
export const getStandingRows = (
  session: GameSession,
  racerCount: number
): readonly FrontEndStandingRow[] => {
  const { standings } = session
  if (standings === null) return []
  const circuit = session.resources.circuits.circuits.find(
    (candidate) => candidate.name === session.settings.circuitName
  )
  const codes = circuit?.racerCodes ?? []
  const rows = Array.from({ length: racerCount }, (_, racerIndex): FrontEndStandingRow => ({
    rank: getStandingRank(standings, racerIndex),
    racerName: racerIndex === FIRST_PLAYER_INDEX ? PLAYER_NAME : (codes[racerIndex] ?? ''),
    points: standings.totals[racerIndex] ?? 0,
    isPlayer: racerIndex < session.settings.localPlayerCount,
  }))
  return Object.freeze(rows.toSorted((first, second) => first.rank - second.rank))
}

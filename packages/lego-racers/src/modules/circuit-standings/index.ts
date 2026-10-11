export {
  awardPlacePoints,
  createCircuitStandings,
  getCircuitResultScreen,
  getCircuitResultScreenNumber,
  getIsRacerEliminated,
  getStandingRank,
  getStandingTotal,
  resetRacePoints,
  resetStandings,
} from './controller/standings/standings.ts'
export {
  CIRCUIT_RACE_COUNT,
  CIRCUIT_RESULT_SCREEN_NUMBERS,
  CircuitResultScreen,
  POINTS_BY_PLACE,
  POINTS_REQUIRED_PER_RACE,
  STANDINGS_RACER_COUNT,
} from './types/standings-rules/standings-rules.ts'
export type {
  CircuitResultScreen as CircuitResultScreenValue,
  CircuitStandings,
} from './types/circuit-standings.types.ts'

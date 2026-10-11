import type {
  CircuitResultScreen as CircuitResultScreenValue,
  CircuitStandings,
} from '../../types/circuit-standings.types.ts'
import {
  CIRCUIT_RESULT_SCREEN_NUMBERS,
  CircuitResultScreen,
  POINTS_BY_PLACE,
  POINTS_REQUIRED_PER_RACE,
  STANDINGS_RACER_COUNT,
} from '../../types/standings-rules/standings-rules.ts'

const ZEROS: readonly number[] = Object.freeze(new Array<number>(STANDINGS_RACER_COUNT).fill(0))

const getCheckedRacerIndex = (racerIndex: number): number => {
  if (!Number.isInteger(racerIndex) || racerIndex < 0 || racerIndex >= STANDINGS_RACER_COUNT) {
    throw new RangeError(`The points record has no racer ${String(racerIndex)}`)
  }
  return racerIndex
}

const getReplaced = (values: readonly number[], index: number, value: number): readonly number[] =>
  Object.freeze(values.map((current, position) => (position === index ? value : current)))

// 0x00440220 / 0x00440240 (the constructor's reset of +0x10..+0x3f).
export const createCircuitStandings = (): CircuitStandings =>
  Object.freeze({ totals: ZEROS, racePoints: ZEROS })

// 0x004402c0 (thiscall: racer, place): the racer's points for the race become the table value of its place and are
// added to its total. The original reads the table without a bound; a place beyond the table is refused here.
export const awardPlacePoints = (
  standings: CircuitStandings,
  racerIndex: number,
  place: number
): CircuitStandings => {
  const index = getCheckedRacerIndex(racerIndex)
  const points = POINTS_BY_PLACE[place]
  if (points === undefined) throw new RangeError(`No points for place ${String(place)}`)
  return Object.freeze({
    totals: getReplaced(standings.totals, index, ((standings.totals[index] ?? 0) + points) >>> 0),
    racePoints: getReplaced(standings.racePoints, index, points),
  })
}

// 0x004402b0, from Race_UpdateState1 when the countdown starts: the race's points are cleared, the totals stay.
export const resetRacePoints = (standings: CircuitStandings): CircuitStandings =>
  Object.freeze({ totals: standings.totals, racePoints: ZEROS })

// 0x00440860, the circuit restart (PlayCircuit and the pause menu): totals and race points are cleared.
export const resetStandings = (): CircuitStandings => createCircuitStandings()

// 0x004402f0.
export const getStandingTotal = (standings: CircuitStandings, racerIndex: number): number =>
  standings.totals[getCheckedRacerIndex(racerIndex)] ?? 0

// 0x00440300: how many other racers have more points; 0 is first, and a tie shares the better place.
export const getStandingRank = (standings: CircuitStandings, racerIndex: number): number => {
  const index = getCheckedRacerIndex(racerIndex)
  const own = standings.totals[index] ?? 0
  return standings.totals.filter((total, other) => other !== index && total > own).length
}

// The screen at the end of PlayCircuit (0x0041ef7f..): rank 0 to 3 pick the four result screens.
export const getCircuitResultScreen = (rank: number): CircuitResultScreenValue => {
  if (rank === 0) return CircuitResultScreen.FIRST_PLACE
  if (rank === 1) return CircuitResultScreen.SECOND_PLACE
  if (rank === 2) return CircuitResultScreen.THIRD_PLACE
  return CircuitResultScreen.NO_PLACE
}

export const getCircuitResultScreenNumber = (screen: CircuitResultScreenValue): number =>
  CIRCUIT_RESULT_SCREEN_NUMBERS[screen] ?? 0

// PlayCircuit 0x0041edfe..: with one local player, racer 0 must have `raceIndex · 10` points when race `raceIndex`
// is about to start, or the circuit ends at once on the "no place" screen (0x19).
export const getIsRacerEliminated = (
  standings: CircuitStandings,
  localPlayerCount: number,
  raceIndex: number
): boolean =>
  localPlayerCount === 1 && getStandingTotal(standings, 0) < raceIndex * POINTS_REQUIRED_PER_RACE

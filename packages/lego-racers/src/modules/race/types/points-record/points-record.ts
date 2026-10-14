import type { PointsRecord } from './points-record.types.ts'

export const POINTS_RECORD_SLOT_COUNT = 6
// The int table at 0x004b0b58: the points of the 1st to the 6th place (30, 20, 10, 3, 2, 1).
export const POINTS_BY_PLACE: readonly number[] = Object.freeze([30, 20, 10, 3, 2, 1])
// 0x00440330: the ticker restarts at 400 when the frame is longer than what is left.
export const POINTS_TICKER_RESTART_MILLISECONDS = 400

export const createPointsRecord = (): PointsRecord =>
  Object.freeze({
    totalPoints: Object.freeze(Array.from({ length: POINTS_RECORD_SLOT_COUNT }, () => 0)),
    racePoints: Object.freeze(Array.from({ length: POINTS_RECORD_SLOT_COUNT }, () => 0)),
    tickerMilliseconds: 0,
  })

// A record holding the circuit's totals so far (the races before this one; the race's points and countdown at 0).
export const getPointsRecordWithTotals = (totalPoints: readonly number[]): PointsRecord =>
  Object.freeze({
    ...createPointsRecord(),
    totalPoints: Object.freeze(
      Array.from({ length: POINTS_RECORD_SLOT_COUNT }, (_, slot) => totalPoints[slot] ?? 0)
    ),
  })

// 0x004402c0 (thiscall: racer slot, number of racers placed before): the slot's points for this race are the table's
// entry for its place, and they are added to its circuit total.
export const recordPlace = (
  record: PointsRecord,
  slot: number,
  placedCount: number
): PointsRecord => {
  const points = POINTS_BY_PLACE[placedCount] ?? 0
  const getWith = (values: readonly number[], getValue: (current: number) => number) =>
    Object.freeze(values.map((current, index) => (index === slot ? getValue(current) : current)))
  return Object.freeze({
    ...record,
    totalPoints: getWith(record.totalPoints, (current) => (current + points) | 0),
    racePoints: getWith(record.racePoints, () => points),
  })
}

// 0x00440330 (thiscall: frame milliseconds): a frame longer than the ticker restarts it at 400.
export const tickPointsRecord = (record: PointsRecord, frameMilliseconds: number): PointsRecord =>
  Object.freeze({
    ...record,
    tickerMilliseconds:
      record.tickerMilliseconds < frameMilliseconds
        ? POINTS_TICKER_RESTART_MILLISECONDS
        : record.tickerMilliseconds - frameMilliseconds,
  })

// 0x00440860: every slot's total and race points go back to 0.
export const clearPointsRecord = (record: PointsRecord): PointsRecord =>
  Object.freeze({
    ...record,
    totalPoints: Object.freeze(record.totalPoints.map(() => 0)),
    racePoints: Object.freeze(record.racePoints.map(() => 0)),
  })

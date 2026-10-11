// The circuit's points record (race +0x18, null for a single race): who finished where in this race and the points
// each slot has in the circuit so far. Race_UpdateState3 and 4 write it (0x004402c0), Race_UpdateState4 and 5 tick
// it (0x00440330), the pause menu clears it (0x00440860). The front end owns it between races.
export type PointsRecord = {
  // Record +0x10 + 4·slot: the points of each racer slot in the circuit so far.
  readonly totalPoints: readonly number[]
  // Record +0x28 + 4·slot: the points the slot got in this race.
  readonly racePoints: readonly number[]
  // Record +0x40: a countdown of the results display, in milliseconds (400 when it runs out).
  readonly tickerMilliseconds: number
}

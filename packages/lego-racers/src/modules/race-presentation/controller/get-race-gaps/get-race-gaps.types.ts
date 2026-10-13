// What 0x0043cf30 reads of a racer: the lap it is on (+0xce4), the time of each lap (+0xcec..) and its race position
// (+0xd00).
export type RaceGapRacer = {
  readonly currentLap: number
  readonly lapMilliseconds: readonly number[]
  readonly racePosition: number
}

// One entry of the table 0x0043cf30 fills (12 bytes): the racer it is about (null where the entry is cleared), its time
// behind the given racer (int32) and the entry's flag.
export type RaceGap = {
  readonly racerIndex: number | null
  readonly gapMilliseconds: number
  readonly isSet: boolean
}

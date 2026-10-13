// A racer is done with its laps just before the frame runs, in the original (racer +0xce4 = race +0x3348, the lap times at
// +0xcec) and in the port alike: the traces reach a race's end without driving it.
export type RacerFinish = {
  readonly frame: number
  readonly racer: number
  readonly lapMilliseconds: readonly number[]
}

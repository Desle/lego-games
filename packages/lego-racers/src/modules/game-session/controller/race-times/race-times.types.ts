import type { Racer } from '../../../racer/index.ts'

// The racer fields FUN_0043beb0 reads: the laps to run, the lap the racer is on and the time of each lap.
export type TimedRacer = Pick<Racer, 'lapCount' | 'currentLap' | 'lapMilliseconds'>

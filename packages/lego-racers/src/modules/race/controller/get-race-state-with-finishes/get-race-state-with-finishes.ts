import type { RaceState } from '../../types/race.types.ts'
import type { RacerFinish } from './get-race-state-with-finishes.types.ts'

// The racer's lap reaches the race's lap count and its lap times are the given ones (the later slots keep theirs);
// Race_UpdateState3 and 4 place it in their next run.
export const getRaceStateWithFinishes = (
  raceState: RaceState,
  finishes: readonly RacerFinish[]
): RaceState =>
  finishes.reduce(
    (current, finish) =>
      Object.freeze({
        ...current,
        racerSet: Object.freeze({
          ...current.racerSet,
          racers: Object.freeze(
            current.racerSet.racers.map((racer, index) =>
              index === finish.racer
                ? Object.freeze({
                    ...racer,
                    currentLap: current.lapCount,
                    lapMilliseconds: Object.freeze(
                      racer.lapMilliseconds.map(
                        (milliseconds, lap) => finish.lapMilliseconds[lap] ?? milliseconds
                      )
                    ),
                  })
                : racer
            )
          ),
        }),
      }),
    raceState
  )

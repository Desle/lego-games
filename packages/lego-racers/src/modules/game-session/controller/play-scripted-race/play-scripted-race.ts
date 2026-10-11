import {
  createRace,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  RacePhase,
  stepRace,
} from '../../../race/index.ts'
import type { RaceInputs, RaceState } from '../../../race/index.ts'
import type { GameSession, RaceStart } from '../../types/game-session.types.ts'
import { recordRaceStep } from '../session-flow/session-flow.ts'
import type {
  RacerLapScript,
  ScriptedRaceOptions,
  ScriptedRaceResult,
} from './play-scripted-race.types.ts'

const DEFAULT_FRAME_MILLISECONDS = 33
const DEFAULT_MAXIMUM_FRAME_COUNT = 20000
// Zone 1 is the start line; entering it from zone 0 after zones 2 and 1 counts a lap (0x00439ba0).
const LAP_ZONES = Object.freeze([2, 0, 1])
const FIRST_LINE_ZONES = Object.freeze([1])

// Runs a race headless with nobody at the controls, the way a server would, while the racers named in the scripts
// cross the start line at the given times of the racing state: the contacts that would put them over it are not
// ported, so they are delivered. A racer crosses the line once to be counted, then once per lap. The race ends by
// itself, or stops when a menu holds it (a race with a ghost). The events go through recordRaceStep, so a circuit's
// points are awarded; the caller finishes the race with finishRace.
export const playScriptedRace = (
  start: RaceStart,
  scripts: readonly RacerLapScript[],
  options: ScriptedRaceOptions = {}
): ScriptedRaceResult => {
  const frameMilliseconds = options.frameMilliseconds ?? DEFAULT_FRAME_MILLISECONDS
  const maximumFrameCount = options.maximumFrameCount ?? DEFAULT_MAXIMUM_FRAME_COUNT
  let raceState: RaceState = createRace(start.definition)
  let session: GameSession = start.session
  let frameCount = 0
  let racingMilliseconds = 0
  const crossedLaps = new Map<number, number>(scripts.map((script) => [script.racerIndex, -1]))
  while (raceState.isRunning && raceState.pauseState === 0 && frameCount < maximumFrameCount) {
    const isStarted =
      raceState.phase === RacePhase.RACING ||
      raceState.phase === RacePhase.FINISHING ||
      raceState.phase === RacePhase.RESULTS
    const crossings = isStarted
      ? scripts.flatMap((script) => {
          const lap = (crossedLaps.get(script.racerIndex) ?? -1) + 1
          const lapEnd = script.lapEndMilliseconds[lap - 1]
          const isLineDue =
            lap === 0 || (lapEnd !== undefined && racingMilliseconds + frameMilliseconds >= lapEnd)
          if (!isLineDue || lap > script.lapEndMilliseconds.length) return []
          crossedLaps.set(script.racerIndex, lap)
          return (lap === 0 ? FIRST_LINE_ZONES : LAP_ZONES).map((zone) => ({
            racerIndex: script.racerIndex,
            zone,
          }))
        })
      : []
    const inputs: RaceInputs = {
      controls: [IDLE_RACER_CONTROLS],
      contacts: { ...NO_RACE_CONTACTS, zoneCrossings: crossings },
    }
    const step = stepRace(raceState, inputs, frameMilliseconds)
    raceState = step.raceState
    session = recordRaceStep(session, step)
    frameCount += 1
    if (isStarted) racingMilliseconds += frameMilliseconds
  }
  return Object.freeze({
    session,
    raceState,
    frameCount,
    isHeldForMenu: raceState.isRunning && raceState.pauseState !== 0,
  })
}

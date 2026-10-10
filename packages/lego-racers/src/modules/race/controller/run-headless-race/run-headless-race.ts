import { createRace } from '../create-race/create-race.ts'
import { IDLE_RACER_CONTROLS, NO_RACE_CONTACTS } from '../race-world/race-world.ts'
import { stepRace } from '../step-race/step-race.ts'
import type { RaceDefinition, RaceEvent, RaceInputs, RaceState } from '../../types/race.types.ts'
import type {
  HeadlessRaceOptions,
  HeadlessRaceReport,
  HeadlessRacerReport,
} from './run-headless-race.types.ts'

const getRacerReport = (raceState: RaceState, racerIndex: number): HeadlessRacerReport => {
  const racer = raceState.racerSet.racers[racerIndex]
  if (racer === undefined) throw new RangeError(`No racer ${String(racerIndex)}`)
  const { rigidBody, routeFollower } = racer.carBody
  return Object.freeze({
    racerIndex,
    controllerKind: racer.controllerKind,
    position: rigidBody.displayFrame.position,
    speed: rigidBody.speed,
    groundedWheelCount: rigidBody.groundedWheelCount,
    routeTimeMilliseconds: routeFollower === null ? null : routeFollower.time,
    routeSampleIndex: routeFollower === null ? null : routeFollower.previousSampleIndex,
    checkpointIndex: racer.checkpointIndex,
    lap: racer.lap,
    racePosition: racer.racePosition,
  })
}

// Runs a race for a number of frames of the same length with nobody touching the controls, the way the
// original's loop would with a steady frame clock, and reports where everyone is.
export const runHeadlessRace = (
  definition: RaceDefinition,
  options: HeadlessRaceOptions
): HeadlessRaceReport => {
  const inputs: RaceInputs = { controls: [IDLE_RACER_CONTROLS], contacts: NO_RACE_CONTACTS }
  let raceState = createRace(definition)
  const events: RaceEvent[] = []
  for (let frame = 0; frame < options.frameCount; frame += 1) {
    const step = stepRace(raceState, inputs, options.frameMilliseconds)
    raceState = step.raceState
    events.push(...step.events)
  }
  return Object.freeze({
    frameCount: options.frameCount,
    elapsedMilliseconds: options.frameCount * options.frameMilliseconds,
    phase: raceState.phase,
    phaseMilliseconds: raceState.phaseMilliseconds,
    randomPosition: raceState.racerSet.randomPosition,
    racers: Object.freeze(
      raceState.racerSet.racers.map((_, index) => getRacerReport(raceState, index))
    ),
    events: Object.freeze(events),
    raceState,
  })
}

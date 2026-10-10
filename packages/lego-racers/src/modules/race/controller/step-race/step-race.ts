import type { RaceEvent, RaceInputs, RaceState, RaceStepResult } from '../../types/race.types.ts'
import { getStepOf, stepRacePhase } from '../race-phases/race-phases.ts'
import { applyPlayerControls, updateRace } from '../update-race/update-race.ts'

// The power-ups' events leave the race with the frame's other events.
const getFlushedStep = (step: RaceStepResult): RaceStepResult => {
  const { powerUpStep } = step.raceState
  const powerUpEvents: readonly RaceEvent[] = powerUpStep.events.map((event) => ({
    type: 'race.power_up',
    event,
  }))
  const { projectileWorld } = step.raceState
  const projectileEvents: readonly RaceEvent[] = projectileWorld.events.map((event) => ({
    type: 'race.projectile',
    event,
  }))
  return Object.freeze({
    raceState: Object.freeze({
      ...step.raceState,
      powerUpStep: Object.freeze({ ...powerUpStep, events: Object.freeze([]) }),
      projectileWorld: Object.freeze({ ...projectileWorld, events: Object.freeze([]) }),
    }),
    events: Object.freeze([...step.events, ...powerUpEvents, ...projectileEvents]),
  })
}

// One pass of Race_RunLoop 0x00432540 for a frame that is not paused: the players' controls arrive, the state
// timer takes the frame's milliseconds (race +0x332c, unscaled), the current state's function runs, then
// Race_Update 0x00435220 (race vtable +0x30) steps the simulation. Rendering is left out.
export const stepRace = (
  raceState: RaceState,
  inputs: RaceInputs,
  frameMilliseconds: number
): RaceStepResult => {
  if (!raceState.isRunning) return getStepOf(raceState)
  const controlled = applyPlayerControls(raceState, inputs)
  const timed: RaceState = Object.freeze({
    ...controlled,
    phaseMilliseconds: (controlled.phaseMilliseconds + frameMilliseconds) >>> 0,
  })
  const phased = stepRacePhase(getStepOf(timed))
  const updated = updateRace(phased.raceState, inputs, frameMilliseconds)
  return getFlushedStep(Object.freeze({ raceState: updated, events: phased.events }))
}

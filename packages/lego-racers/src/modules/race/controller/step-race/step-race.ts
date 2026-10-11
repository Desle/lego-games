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
  const trackEffects: readonly RaceEvent[] = step.raceState.trackEffects.map((effect) => ({
    type: 'race.track_effect',
    effect,
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
      trackEffects: Object.freeze([]),
    }),
    events: Object.freeze([...step.events, ...powerUpEvents, ...projectileEvents, ...trackEffects]),
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
  // A menu holds the race (race +0x30c0): the state timer stands still and Race_Update does not run.
  if (!raceState.isRunning || raceState.pauseState !== 0) return getStepOf(raceState)
  const controlled = applyPlayerControls(raceState, inputs)
  const timed: RaceState = Object.freeze({
    ...controlled,
    phaseMilliseconds: (controlled.phaseMilliseconds + frameMilliseconds) >>> 0,
  })
  const phased = stepRacePhase(getStepOf(timed))
  const updated = updateRace(phased.raceState, inputs, frameMilliseconds)
  const withCamera: RaceState = Object.freeze({
    ...updated,
    introductionCameraMilliseconds: updated.introductionCameraMilliseconds + frameMilliseconds,
  })
  return getFlushedStep(Object.freeze({ raceState: withCamera, events: phased.events }))
}

// Race_ResumeFromPause 0x00436160 with a menu answer that ends the race (`iVar4 == 2`, choice not zero): the loop's
// running flag (race +0x3334) becomes 0.
export const endRaceFromMenu = (raceState: RaceState): RaceStepResult =>
  Object.freeze({
    raceState: Object.freeze({ ...raceState, pauseState: 0, isRunning: false }),
    events: Object.freeze([{ type: 'race.ended' }] as const),
  })

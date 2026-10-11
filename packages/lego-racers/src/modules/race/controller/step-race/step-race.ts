import type { RaceEvent, RaceInputs, RaceState, RaceStepResult } from '../../types/race.types.ts'
import { getStepOf, stepRacePhase } from '../race-phases/race-phases.ts'
import {
  answerPauseMenu,
  applyMenuInput,
  getRaceWithMenuBlink,
  NO_MENU_INPUT,
} from '../pause-menu/pause-menu.ts'
import type { PauseMenuStep } from '../pause-menu/pause-menu.types.ts'
import { CLOSED_PAUSE_MENU, PauseMenuMode } from '../../types/pause-menu/pause-menu.ts'
import { RaceExit } from '../../types/race-exit/race-exit.ts'
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

// Race_Update 0x00435220 with a menu open: only the menu's blink timer runs, unless the player has answered the menu and
// the answer leaves the race going (not in a confirmation), when the frame is simulated as usual.
const stepPausedFrame = (
  raceState: RaceState,
  inputs: RaceInputs,
  frameMilliseconds: number
): PauseMenuStep => {
  const blinked = getRaceWithMenuBlink(raceState, frameMilliseconds)
  if (!blinked.pauseMenu.isAnswered) return Object.freeze({ raceState: blinked, events: [] })
  const answered = answerPauseMenu(blinked)
  if (answered.raceState.pauseMenu.mode === PauseMenuMode.CONFIRMATION) return answered
  return Object.freeze({
    raceState: updateRace(answered.raceState, inputs, frameMilliseconds),
    events: answered.events,
  })
}

// One pass of Race_RunLoop 0x00432540 for a frame that is not paused by the application: the menu keys arrive
// (0x00435c00), the players' controls (unless a menu is open), the state timer takes the frame's milliseconds (race
// +0x332c, unscaled) while no menu is open, the current state's function runs, then Race_Update 0x00435220 (race
// vtable +0x30) steps the simulation. Rendering is left out.
export const stepRace = (
  raceState: RaceState,
  inputs: RaceInputs,
  frameMilliseconds: number
): RaceStepResult => {
  if (!raceState.isRunning) return getStepOf(raceState)
  const keyed = applyMenuInput(raceState, inputs.menu ?? NO_MENU_INPUT)
  if (!keyed.raceState.isRunning) return getFlushedStep(keyed)
  const isMenuOpen = keyed.raceState.pauseMenu.mode !== PauseMenuMode.NONE
  const controlled = isMenuOpen ? keyed.raceState : applyPlayerControls(keyed.raceState, inputs)
  const timed: RaceState = Object.freeze({
    ...controlled,
    phaseMilliseconds: isMenuOpen
      ? controlled.phaseMilliseconds
      : (controlled.phaseMilliseconds + frameMilliseconds) >>> 0,
  })
  const phased = stepRacePhase(getStepOf(timed), frameMilliseconds)
  const updated = isMenuOpen
    ? stepPausedFrame(phased.raceState, inputs, frameMilliseconds)
    : getStepOf(updateRace(phased.raceState, inputs, frameMilliseconds))
  return getFlushedStep(
    Object.freeze({
      raceState: Object.freeze({
        ...updated.raceState,
        introductionCameraMilliseconds:
          updated.raceState.introductionCameraMilliseconds + frameMilliseconds,
      }),
      events: [...keyed.events, ...phased.events, ...updated.events],
    })
  )
}

// Race_ResumeFromPause 0x00436160 with a menu answer that ends the race (`iVar4 == 2`): the loop's running flag
// (race +0x3334) becomes 0, a restart for the first item and a leave for the other.
export const endRaceFromMenu = (raceState: RaceState): RaceStepResult => {
  const exit = raceState.pauseMenu.selection === 0 ? RaceExit.RESTART : RaceExit.LEFT
  return Object.freeze({
    raceState: Object.freeze({
      ...raceState,
      pauseMenu: CLOSED_PAUSE_MENU,
      isRunning: false,
      exit,
    }),
    events: Object.freeze([{ type: 'race.ended', exit }] as const),
  })
}

import {
  activatePowerUp,
  BrickKind,
  rollComputerStartTurbo,
  setBrickSoundsEnabled,
} from '../../../power-ups/index.ts'
import { getRacer, playRacerVoice, setRacer, stopRacerPowerSlide } from '../../../racer/index.ts'
import type { PlayerController, Racer, RacerSet } from '../../../racer/index.ts'
import {
  COUNTDOWN_MILLISECONDS,
  FINISHING_MILLISECONDS,
  INTRODUCTION_MILLISECONDS,
  RacePhase,
  SKIPPED_COUNTDOWN_FINISHING_START_MILLISECONDS,
} from '../../types/race-phase/race-phase.ts'
import type {
  RaceEvent,
  RacePhase as RacePhaseValue,
  RaceState,
  RaceStepResult,
} from '../../types/race.types.ts'
import {
  convertRacerToComputer,
  COMPUTER_CONTROLLER,
  RACER_FINISHED_FLAG,
  RACER_PLACED_FLAG,
  RACER_STARTING_FLAG,
  releaseRacerAtStart,
} from '../../types/racer-transitions/racer-transitions.ts'
import {
  changePowerUps,
  getRaceRacerSet,
  getRaceRacerSetOf,
  getRacerSetOf,
  NO_RACE_CONTACTS,
} from '../race-world/race-world.ts'
import type { FinishingProgress, PhaseChange, RaceWorldChanger } from './race-phases.types.ts'

const POWER_SLIDING_FLAG = 0x80
const CONTROLS_DISABLED_FLAG = 0x2
const BEFORE_START_FLAG = 0x1
const ACCELERATING_FLAG = 0x8
const STRONG_START_BOOST_MILLISECONDS = 59
const START_BOOST_WINDOW_MILLISECONDS = 100

export const getStepOf = (raceState: RaceState): RaceStepResult =>
  Object.freeze({ raceState, events: Object.freeze([]) })

const getStepWith = (
  step: RaceStepResult,
  raceState: RaceState,
  events: readonly RaceEvent[]
): RaceStepResult =>
  Object.freeze({ raceState, events: Object.freeze([...step.events, ...events]) })

// Applies a change to the racers and the power-ups together, the way the sub-steps see them.
const changeRaceWorld = (state: RaceState, change: RaceWorldChanger): RaceState => {
  const changed = change(getRaceRacerSet(state, NO_RACE_CONTACTS))
  return Object.freeze({
    ...state,
    racerSet: getRacerSetOf(changed),
    powerUpStep: changed.powerUpStep,
  })
}

const getPhaseChange = (
  state: RaceState,
  to: RacePhaseValue,
  phaseMilliseconds: number
): PhaseChange => ({
  raceState: Object.freeze({ ...state, phase: to, phaseMilliseconds }),
  event: Object.freeze({ type: 'race.phase_changed', from: state.phase, to }),
})

// 0x0043a210 (thiscall: place): a racer that has not finished gets a voice line when its place changes.
const setRacePlace = (state: RaceState, racerIndex: number, place: number): RaceState => {
  const racer = getRacer(state.racerSet, racerIndex)
  const isChanged = (racer.flags & RACER_FINISHED_FLAG) === 0 && place !== racer.racePosition
  const voiced: RacerSet = isChanged
    ? playRacerVoice(state.context, state.racerSet, racerIndex)
    : state.racerSet
  return Object.freeze({
    ...state,
    racerSet: setRacer(
      voiced,
      racerIndex,
      Object.freeze({ ...getRacer(voiced, racerIndex), racePosition: place })
    ),
  })
}

// The shared part of states 3 and 4: the racer is given the next place and the placed flag 0x1000.
const placeRacer = (
  step: RaceStepResult,
  racerIndex: number,
  isFlagged: boolean
): RaceStepResult => {
  const { raceState } = step
  const racer = getRacer(raceState.racerSet, racerIndex)
  const place = raceState.finishedRacerCount + 1
  const flagged = isFlagged
    ? setRacer(
        raceState.racerSet,
        racerIndex,
        Object.freeze({ ...racer, flags: (racer.flags | RACER_PLACED_FLAG) >>> 0 })
      )
    : raceState.racerSet
  const counted = setRacePlace(
    Object.freeze({ ...raceState, racerSet: flagged, finishedRacerCount: place }),
    racerIndex,
    place
  )
  return getStepWith(step, counted, [{ type: 'race.racer_finished', racerIndex, place }])
}

const getHasFinishedLaps = (raceState: RaceState, racer: Racer): boolean =>
  raceState.lapCount <= racer.currentLap && (racer.flags & RACER_PLACED_FLAG) === 0

// 0x00430760: the finished player's controls are disabled and the computer drives the racer.
const disablePlayerControls = (raceState: RaceState, racerIndex: number): RaceState => {
  const playerIndex = raceState.playerRacerIndices.indexOf(racerIndex)
  const controller = raceState.playerControllers[playerIndex]
  if (controller === undefined) return raceState
  const converted = setRacer(
    raceState.racerSet,
    racerIndex,
    convertRacerToComputer(getRacer(raceState.racerSet, racerIndex))
  )
  const isPowerSliding = (getRacer(converted, racerIndex).flags & POWER_SLIDING_FLAG) !== 0
  const stopped = isPowerSliding
    ? stopRacerPowerSlide(raceState.context, converted, racerIndex, (_context, set) => set)
    : converted
  return Object.freeze({
    ...raceState,
    racerSet: stopped,
    playerControllers: Object.freeze(
      raceState.playerControllers.map((candidate: PlayerController, index) =>
        index === playerIndex
          ? Object.freeze({
              ...candidate,
              stateFlags: candidate.stateFlags | CONTROLS_DISABLED_FLAG,
            })
          : candidate
      )
    ),
  })
}

// 0x00430710: the controller leaves its before-start state; a start boost held since the countdown fires now.
const releasePlayerController = (
  raceState: RaceState,
  playerIndex: number,
  racerIndex: number
): RaceState => {
  const controller = raceState.playerControllers[playerIndex]
  if (controller === undefined) return raceState
  const isBoostHeld = controller.startBoostMilliseconds !== 0
  const released: PlayerController = Object.freeze({
    ...controller,
    stateFlags: controller.stateFlags & ~BEFORE_START_FLAG,
    startBoostMilliseconds: isBoostHeld
      ? 0
      : (controller.stateFlags & ACCELERATING_FLAG) === 0
        ? START_BOOST_WINDOW_MILLISECONDS
        : controller.startBoostMilliseconds,
  })
  const withController = Object.freeze({
    ...raceState,
    playerControllers: Object.freeze(
      raceState.playerControllers.map((candidate, index) =>
        index === playerIndex ? released : candidate
      )
    ),
  })
  return isBoostHeld
    ? changeRaceWorld(withController, (racerSet) =>
        changePowerUps(withController.context, racerSet, (step, powerUpContext) =>
          activatePowerUp(step, powerUpContext, racerIndex, {
            category: BrickKind.TURBO,
            level: controller.startBoostMilliseconds > STRONG_START_BOOST_MILLISECONDS ? 1 : 0,
          })
        )
      )
    : withController
}

// Race_UpdateState5 0x00435180 without the points record (race +0x18): the loop ends at once.
const stepResults = (step: RaceStepResult): RaceStepResult =>
  getStepWith(step, Object.freeze({ ...step.raceState, phaseMilliseconds: 0, isRunning: false }), [
    { type: 'race.ended' },
  ])

// Race_UpdateState4 0x00434eb0 (without a ghost): after 10 s the racers still running are given the next places
// in racer order and every racer's place is recorded; before that, racers that finished their laps are placed.
const stepFinishing = (step: RaceStepResult): RaceStepResult => {
  const { raceState } = step
  const racerCount = raceState.racerSet.racers.length
  const indices = Array.from({ length: racerCount }, (_, index) => index)
  if (raceState.phaseMilliseconds >= FINISHING_MILLISECONDS) {
    const change = getPhaseChange(raceState, RacePhase.RESULTS, 0)
    const placed = indices.reduce(
      (current, index) =>
        (getRacer(current.raceState.racerSet, index).flags & RACER_PLACED_FLAG) === 0
          ? placeRacer(current, index, false)
          : current,
      getStepWith(step, change.raceState, [change.event])
    )
    return stepResults(
      getStepWith(
        placed,
        Object.freeze({
          ...placed.raceState,
          placements: Object.freeze(
            indices.map((index) => getRacer(placed.raceState.racerSet, index).racePosition & 0xff)
          ),
        }),
        []
      )
    )
  }
  return indices.reduce((current, index) => {
    const racer = getRacer(current.raceState.racerSet, index)
    if (!getHasFinishedLaps(current.raceState, racer)) return current
    const placed = placeRacer(current, index, true)
    return racer.controllerKind === COMPUTER_CONTROLLER
      ? placed
      : getStepWith(placed, disablePlayerControls(placed.raceState, index), [])
  }, step)
}

// Race_UpdateState3 0x00434c80: racers that finished their laps are placed; when a human (or the
// demonstration's racer 0) finishes, the finishing state starts and its function runs at once.
const stepRacing = (step: RaceStepResult): RaceStepResult => {
  const racerCount = step.raceState.racerSet.racers.length
  const indices = Array.from({ length: racerCount }, (_, index) => index)
  const result = indices.reduce<FinishingProgress>(
    (current, index) => {
      if (current.isFinishing) return current
      const racer = getRacer(current.step.raceState.racerSet, index)
      if (!getHasFinishedLaps(current.step.raceState, racer)) return current
      const placed = placeRacer(current.step, index, true)
      const isHuman =
        racer.controllerKind !== COMPUTER_CONTROLLER ||
        (current.step.raceState.isDemonstration && index === 0)
      if (!isHuman) return { step: placed, isFinishing: false }
      const change = getPhaseChange(
        placed.raceState,
        RacePhase.FINISHING,
        placed.raceState.isCountdownSkipped ? SKIPPED_COUNTDOWN_FINISHING_START_MILLISECONDS : 0
      )
      const disabled = disablePlayerControls(change.raceState, index)
      return { step: getStepWith(placed, disabled, [change.event]), isFinishing: true }
    },
    { step, isFinishing: false }
  )
  return result.isFinishing ? stepFinishing(result.step) : result.step
}

// Race_UpdateState2 0x00434b00: after 3 s (or at once when the countdown is skipped) the racers are released
// (0x0043ccb0 → 0x00439340), the players' controls are released (0x00430710), the bricks may play sounds
// (0x0045b900), and the racing state's function runs at once.
const stepCountdown = (step: RaceStepResult): RaceStepResult => {
  const { raceState } = step
  if (raceState.phaseMilliseconds < COUNTDOWN_MILLISECONDS && !raceState.isCountdownSkipped)
    return step
  const change = getPhaseChange(raceState, RacePhase.RACING, 0)
  const released = changeRaceWorld(change.raceState, (racerSet) =>
    racerSet.racers.reduce((current, racer, index) => {
      const started = getRaceRacerSetOf(
        setRacer(
          current,
          index,
          releaseRacerAtStart(
            Object.freeze({
              ...racer,
              carBody: Object.freeze({ ...racer.carBody, isRouteHeld: false }),
            })
          )
        )
      )
      const setup = racerSet.powerUpSetups[index]
      return setup === undefined
        ? started
        : changePowerUps(change.raceState.context, started, (powerUps, powerUpContext) =>
            rollComputerStartTurbo(powerUps, powerUpContext, index, setup.personality)
          )
    }, racerSet)
  )
  const controlled = released.playerRacerIndices.reduce(
    (current, racerIndex, playerIndex) => releasePlayerController(current, playerIndex, racerIndex),
    released
  )
  const sounding: RaceState = Object.freeze({
    ...controlled,
    finishedRacerCount: 0,
    powerUpStep: setBrickSoundsEnabled(controlled.powerUpStep, true),
  })
  return stepRacing(getStepWith(step, sounding, [change.event, { type: 'race.controls_enabled' }]))
}

// Race_UpdateState1 0x004349a0: after 2 s each local player's racer is marked as starting (0x004393d0, flag
// 0x400) and the countdown's function runs at once. The track's introduction camera (race +0x3ac) can hold the
// state longer in the original; it is not modelled.
const stepIntroduction = (step: RaceStepResult): RaceStepResult => {
  const { raceState } = step
  if (raceState.phaseMilliseconds < INTRODUCTION_MILLISECONDS) return step
  const change = getPhaseChange(raceState, RacePhase.COUNTDOWN, 0)
  const marked = raceState.playerRacerIndices.reduce(
    (racerSet, racerIndex) =>
      setRacer(
        racerSet,
        racerIndex,
        Object.freeze({
          ...getRacer(racerSet, racerIndex),
          flags: (getRacer(racerSet, racerIndex).flags | RACER_STARTING_FLAG) >>> 0,
        })
      ),
    raceState.racerSet
  )
  return stepCountdown(
    getStepWith(step, Object.freeze({ ...change.raceState, racerSet: marked }), [change.event])
  )
}

// Race_RunLoop 0x00432540: the state function for the current state.
export const stepRacePhase = (step: RaceStepResult): RaceStepResult => {
  switch (step.raceState.phase) {
    case RacePhase.INTRODUCTION:
      return stepIntroduction(step)
    case RacePhase.COUNTDOWN:
      return stepCountdown(step)
    case RacePhase.RACING:
      return stepRacing(step)
    case RacePhase.FINISHING:
      return stepFinishing(step)
    default:
      return stepResults(step)
  }
}

import { createGhostSession } from '../../../ghost/index.ts'
import { getRacer, setRacer } from '../../../racer/index.ts'
import {
  COUNTDOWN_MILLISECONDS,
  FINISHING_MILLISECONDS,
  GHOST_MENU_MILLISECONDS,
  GHOST_MENU_PAUSE_STATE,
  INTRODUCTION_MILLISECONDS,
  RacePhase,
  RESULTS_MILLISECONDS,
} from '../../types/race-phase/race-phase.ts'
import type { RaceInputs, RaceState } from '../../types/race.types.ts'
import { createRace } from '../create-race/create-race.ts'
import { createFixtureDefinition, createFixtureRace } from '../race-fixtures/race-fixtures.ts'
import { IDLE_RACER_CONTROLS, NO_RACE_CONTACTS } from '../race-world/race-world.ts'
import { endRaceFromMenu, stepRace } from './step-race.ts'

const IDLE_INPUTS: RaceInputs = { controls: [IDLE_RACER_CONTROLS], contacts: NO_RACE_CONTACTS }
const PLAYER = 0
const COMPUTER = 1
const FINISHED_LAPS = 3

const withLaps = (state: RaceState, racerIndex: number, currentLap: number): RaceState =>
  Object.freeze({
    ...state,
    racerSet: setRacer(
      state.racerSet,
      racerIndex,
      Object.freeze({ ...getRacer(state.racerSet, racerIndex), currentLap })
    ),
  })

const stepUntil = (state: RaceState, phase: string): RaceState => {
  const step = stepRace(state, IDLE_INPUTS, 100)
  return step.raceState.phase === phase ? step.raceState : stepUntil(step.raceState, phase)
}

describe('stepRace', () => {
  it('starts in the introduction and holds it for 2,000 ms', () => {
    // Arrange
    const state = createFixtureRace()

    // Act
    const step = stepRace(state, IDLE_INPUTS, INTRODUCTION_MILLISECONDS - 1)

    // Assert
    expect(step.raceState.phase).toBe(RacePhase.INTRODUCTION)
    expect(step.raceState.phaseMilliseconds).toBe(INTRODUCTION_MILLISECONDS - 1)
    expect(step.events).toEqual([])
  })

  it('moves on to the countdown at 2,000 ms and marks the players as starting', () => {
    // Arrange
    const state = createFixtureRace()

    // Act
    const step = stepRace(state, IDLE_INPUTS, INTRODUCTION_MILLISECONDS)

    // Assert
    expect(step.raceState.phase).toBe(RacePhase.COUNTDOWN)
    expect(step.raceState.phaseMilliseconds).toBe(0)
    expect(step.events).toEqual([
      { type: 'race.phase_changed', from: RacePhase.INTRODUCTION, to: RacePhase.COUNTDOWN },
    ])
    expect(getRacer(step.raceState.racerSet, PLAYER).flags & 0x400).toBe(0x400)
  })

  it('releases the racers and the players 3,000 ms into the countdown', () => {
    // Arrange
    const countdown = stepRace(createFixtureRace(), IDLE_INPUTS, INTRODUCTION_MILLISECONDS)

    // Act
    const step = stepRace(countdown.raceState, IDLE_INPUTS, COUNTDOWN_MILLISECONDS)

    // Assert
    expect(step.raceState.phase).toBe(RacePhase.RACING)
    expect(step.events).toContainEqual({ type: 'race.controls_enabled' })
    expect(getRacer(step.raceState.racerSet, PLAYER).flags & 0x2).toBe(0)
    expect(getRacer(step.raceState.racerSet, COMPUTER).flags & 0x2).toBe(0)
    expect(step.raceState.playerControllers[0]?.stateFlags).toBe(0)
  })

  it('places a computer racer that finishes its laps without ending the racing state', () => {
    // Arrange
    const racing = stepUntil(createFixtureRace(), RacePhase.RACING)

    // Act
    const step = stepRace(withLaps(racing, COMPUTER, FINISHED_LAPS), IDLE_INPUTS, 33)

    // Assert
    expect(step.raceState.phase).toBe(RacePhase.RACING)
    expect(step.events).toContainEqual({
      type: 'race.racer_finished',
      racerIndex: COMPUTER,
      place: 1,
    })
    expect(getRacer(step.raceState.racerSet, COMPUTER).flags & 0x1000).toBe(0x1000)
    expect(step.raceState.finishedRacerCount).toBe(1)
  })

  it('starts the finishing state when the player finishes and hands the car to the computer', () => {
    // Arrange
    const racing = stepUntil(createFixtureRace(), RacePhase.RACING)

    // Act
    const step = stepRace(withLaps(racing, PLAYER, FINISHED_LAPS), IDLE_INPUTS, 33)

    // Assert
    expect(step.raceState.phase).toBe(RacePhase.FINISHING)
    expect(getRacer(step.raceState.racerSet, PLAYER).controllerKind).toBe(2)
    expect(step.raceState.playerControllers[0]?.stateFlags).toBe(2)
  })

  it('places the racers still running after 10 s, records the places and ends the race', () => {
    // Arrange
    const finishing = stepUntil(
      withLaps(stepUntil(createFixtureRace(), RacePhase.RACING), PLAYER, FINISHED_LAPS),
      RacePhase.FINISHING
    )

    // Act
    const step = stepRace(finishing, IDLE_INPUTS, FINISHING_MILLISECONDS)

    // Assert
    expect(step.raceState.isRunning).toBe(false)
    expect(step.raceState.placements).toEqual([1, 2])
    expect(step.events.at(-1)).toEqual({ type: 'race.ended' })
  })

  it('does nothing once the race has ended', () => {
    // Arrange
    const ended = Object.freeze({ ...createFixtureRace(), isRunning: false })

    // Act
    const step = stepRace(ended, IDLE_INPUTS, 33)

    // Assert
    expect(step.raceState).toBe(ended)
    expect(step.events).toEqual([])
  })

  it('keeps the results of a circuit race for 5 s before the loop ends', () => {
    // Arrange
    const circuitRace = createRace({ ...createFixtureDefinition(), isPointsRecordPresent: true })
    const finishing = stepUntil(
      withLaps(stepUntil(circuitRace, RacePhase.RACING), PLAYER, FINISHED_LAPS),
      RacePhase.FINISHING
    )
    const results = stepRace(finishing, IDLE_INPUTS, FINISHING_MILLISECONDS)

    // Act
    const early = stepRace(results.raceState, IDLE_INPUTS, RESULTS_MILLISECONDS - 1)
    const late = stepRace(early.raceState, IDLE_INPUTS, 1)

    // Assert
    expect(results.raceState.phase).toBe(RacePhase.RESULTS)
    expect(results.raceState.isRunning).toBe(true)
    expect(results.raceState.placements).toEqual([1, 2])
    expect(early.raceState.isRunning).toBe(true)
    expect(late.raceState.isRunning).toBe(false)
  })

  it('records the ghost while racing, keeps the finished run and holds the race for the menu', () => {
    // Arrange
    const ghostRace = createRace({ ...createFixtureDefinition(), ghost: createGhostSession(false) })
    const racing = stepUntil(ghostRace, RacePhase.RACING)
    const recorded = stepRace(racing, IDLE_INPUTS, 100)
    const finished = stepRace(withLaps(recorded.raceState, PLAYER, FINISHED_LAPS), IDLE_INPUTS, 33)

    // Act
    const held = stepRace(finished.raceState, IDLE_INPUTS, GHOST_MENU_MILLISECONDS)
    const stillHeld = stepRace(held.raceState, IDLE_INPUTS, 5000)
    const ended = endRaceFromMenu(stillHeld.raceState)

    // Assert
    expect(racing.ghost?.isRunning).toBe(true)
    expect(recorded.raceState.ghost?.currentRun.samples.length).toBeGreaterThan(0)
    expect(finished.raceState.ghost?.bestRun).not.toBeNull()
    expect(finished.raceState.ghost?.isRunning).toBe(false)
    expect(held.raceState.pauseState).toBe(GHOST_MENU_PAUSE_STATE)
    expect(held.raceState.isRunning).toBe(true)
    expect(stillHeld.raceState).toBe(held.raceState)
    expect(ended.raceState.isRunning).toBe(false)
    expect(ended.events).toEqual([{ type: 'race.ended' }])
  })
})

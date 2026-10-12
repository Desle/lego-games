import { createGhostSession } from '../../../ghost/index.ts'
import { createSkeletonAnimationState } from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import { getRacer, setRacer } from '../../../racer/index.ts'
import {
  COUNTDOWN_MILLISECONDS,
  FINISHING_MILLISECONDS,
  GHOST_MENU_MILLISECONDS,
  INTRODUCTION_MILLISECONDS,
  RacePhase,
  RESULTS_MILLISECONDS,
} from '../../types/race-phase/race-phase.ts'
import type { RaceInputs, RaceState } from '../../types/race.types.ts'
import { PauseMenuMode } from '../../types/pause-menu/pause-menu.ts'
import { RaceExit } from '../../types/race-exit/race-exit.ts'
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

  it('keeps the introduction while the camera instance plays, then restarts the timer once (0x00434a55)', () => {
    // Arrange
    const animation: SkeletalAnimation = {
      positions: [],
      rotations: [],
      times: [],
      tracks: [],
      clips: [
        {
          name: 'camera',
          framesPerMillisecond: 0,
          velocity: [0, 0, 0],
          firstTrackIndex: 0,
          frameCount: 60,
          loopLength: 60,
        },
      ],
    }
    const clip = { ...createSkeletonAnimationState(animation, 0), isLooping: false }
    const getRaceWithCameraTime = (timeInFrames: number): RaceState => {
      const base = createFixtureRace()
      const instance = {
        name: 'camera',
        animation,
        skeleton: null,
        clip: { ...clip, clip: { ...clip.clip, timeInFrames } },
        isAnimated: true,
        otherFlags: 0,
        position: [0, 0, 0] as const,
        levelSquaredDistances: [],
      }
      return {
        ...base,
        introductionCameraObject: 'camera',
        trackLogic: {
          ...base.trackLogic,
          worlds: {
            ...base.trackLogic.worlds,
            track: { ...base.trackLogic.worlds.track, skeletonInstances: [instance] },
          },
        },
      }
    }

    // Act
    const held = stepRace(getRaceWithCameraTime(0), IDLE_INPUTS, INTRODUCTION_MILLISECONDS)
    const finished = stepRace(getRaceWithCameraTime(59), IDLE_INPUTS, 16)

    // Assert
    expect(held.raceState.phase).toBe(RacePhase.INTRODUCTION)
    expect(held.raceState.introductionCameraObject).toBe('camera')
    expect(finished.raceState.phase).toBe(RacePhase.INTRODUCTION)
    expect(finished.raceState.introductionCameraObject).toBeNull()
    expect(finished.raceState.phaseMilliseconds).toBe(0)
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
    expect(step.events.at(-1)).toEqual({ type: 'race.ended', exit: 'finished' })
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
    expect(held.raceState.pauseMenu.mode).toBe(PauseMenuMode.RESULTS)
    expect(held.raceState.isRunning).toBe(true)
    expect(stillHeld.raceState.pauseMenu.mode).toBe(PauseMenuMode.RESULTS)
    expect(stillHeld.raceState.phaseMilliseconds).toBe(held.raceState.phaseMilliseconds)
    expect(ended.raceState.isRunning).toBe(false)
    expect(ended.events).toEqual([{ type: 'race.ended', exit: RaceExit.RESTART }])
  })

  it('starts the introduction tune and, outside a circuit, picks the racing tune with the random table', () => {
    // Arrange
    const musicRace = createRace({ ...createFixtureDefinition(), musicTuneCount: 7 })
    const countdown = stepRace(musicRace, IDLE_INPUTS, INTRODUCTION_MILLISECONDS)

    // Act
    const step = stepRace(countdown.raceState, IDLE_INPUTS, COUNTDOWN_MILLISECONDS)

    // Assert
    const before = countdown.raceState.racerSet.randomPosition
    const tuneEvents = step.events.filter((event) => event.type === 'race.tune_changed')
    expect(musicRace.tuneIndex).toBe(0)
    expect(tuneEvents).toHaveLength(1)
    expect(step.raceState.racerSet.randomPosition).not.toBe(before)
    expect([1, 4, 5, 6]).toContain(step.raceState.tuneIndex)
  })

  it('keeps tune 1 and draws nothing for a circuit race or a short music list', () => {
    // Arrange
    const circuit = createRace({
      ...createFixtureDefinition(),
      musicTuneCount: 7,
      isPointsRecordPresent: true,
    })
    const shortList = createRace({ ...createFixtureDefinition(), musicTuneCount: 4 })
    const getRacingStep = (race: RaceState) =>
      stepRace(
        stepRace(race, IDLE_INPUTS, INTRODUCTION_MILLISECONDS).raceState,
        IDLE_INPUTS,
        COUNTDOWN_MILLISECONDS
      )

    // Act
    const circuitStep = getRacingStep(circuit)
    const shortStep = getRacingStep(shortList)

    // Assert
    expect(circuitStep.raceState.tuneIndex).toBe(1)
    expect(shortStep.raceState.tuneIndex).toBe(1)
    expect(circuitStep.raceState.racerSet.randomPosition).toBe(
      shortStep.raceState.racerSet.randomPosition
    )
  })

  it('plays the winning tune for a human who finishes first and the losing tune otherwise', () => {
    // Arrange
    const racing = stepUntil(
      createRace({ ...createFixtureDefinition(), musicTuneCount: 4 }),
      RacePhase.RACING
    )
    const first = withLaps(racing, PLAYER, FINISHED_LAPS)
    const computerFirst = stepRace(withLaps(racing, COMPUTER, FINISHED_LAPS), IDLE_INPUTS, 33)
    const second = withLaps(computerFirst.raceState, PLAYER, FINISHED_LAPS)

    // Act
    const firstStep = stepRace(first, IDLE_INPUTS, 33)
    const secondStep = stepRace(second, IDLE_INPUTS, 33)

    // Assert
    expect(firstStep.raceState.tuneIndex).toBe(3)
    expect(secondStep.raceState.tuneIndex).toBe(2)
  })

  it('plays no music without a music list', () => {
    // Arrange
    const state = createFixtureRace()

    // Act
    const step = stepRace(
      stepRace(state, IDLE_INPUTS, INTRODUCTION_MILLISECONDS).raceState,
      IDLE_INPUTS,
      COUNTDOWN_MILLISECONDS
    )

    // Assert
    expect(state.tuneIndex).toBeNull()
    expect(step.raceState.tuneIndex).toBeNull()
    expect(step.events.some((event) => event.type === 'race.tune_changed')).toBe(false)
  })
})

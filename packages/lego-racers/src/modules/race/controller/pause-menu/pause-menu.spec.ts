import { PauseMenuMode, PendingAction } from '../../types/pause-menu/pause-menu.ts'
import type { RaceMenuInput } from '../../types/pause-menu/pause-menu.types.ts'
import { createPointsRecord, recordPlace } from '../../types/points-record/points-record.ts'
import { RaceExit } from '../../types/race-exit/race-exit.ts'
import type { RaceInputs, RaceState } from '../../types/race.types.ts'
import { createFixtureRace } from '../race-fixtures/race-fixtures.ts'
import { IDLE_RACER_CONTROLS, NO_RACE_CONTACTS } from '../race-world/race-world.ts'
import { stepRace } from '../step-race/step-race.ts'
import { NO_MENU_INPUT } from './pause-menu.ts'

const FRAME_MILLISECONDS = 33

const press = (state: RaceState, menu: Partial<RaceMenuInput>) => {
  const inputs: RaceInputs = {
    controls: [IDLE_RACER_CONTROLS],
    contacts: NO_RACE_CONTACTS,
    menu: { ...NO_MENU_INPUT, ...menu },
  }
  return stepRace(state, inputs, FRAME_MILLISECONDS)
}

// A tap: the confirm key goes down (the waiting flag clears) and up (the menu is answered) on separate calls.
const confirm = (state: RaceState): ReturnType<typeof press> =>
  press(press(state, { isConfirmPressed: true }).raceState, { isConfirmReleased: true })

const choose = (state: RaceState, selection: number): ReturnType<typeof press> => {
  const moved = press(state, { selectionChange: selection === 0 ? 0 : 1 })
  const selected = selection <= 1 ? moved : press(moved.raceState, { selectionChange: 1 })
  return confirm(selected.raceState)
}

// The confirmation selects "no" first; one step up selects "yes".
const chooseYes = (state: RaceState): ReturnType<typeof press> =>
  confirm(press(state, { selectionChange: -1 }).raceState)

describe('the pause menu', () => {
  it('opens on the pause key and stops the state timer (0x00435c00, 0x00436010)', () => {
    // Arrange
    const state = createFixtureRace()

    // Act
    const paused = press(state, { isPausePressed: true })
    const later = press(paused.raceState, {})

    // Assert
    expect(paused.raceState.pauseMenu.mode).toBe(PauseMenuMode.PAUSED)
    expect(paused.raceState.pauseMenu.selection).toBe(0)
    expect(paused.events).toContainEqual({ type: 'race.paused' })
    expect(paused.raceState.phaseMilliseconds).toBe(state.phaseMilliseconds)
    expect(later.raceState.phaseMilliseconds).toBe(state.phaseMilliseconds)
  })

  it('counts the blink timer while it is open and wraps it at 500 ms (0x00427420)', () => {
    // Arrange
    const paused = press(createFixtureRace(), { isPausePressed: true }).raceState

    // Act
    const blinked = Array.from({ length: 16 }, (_, index) => index).reduce(
      (current) => press(current, {}).raceState,
      paused
    )

    // Assert
    // The opening frame counted one step (33 ms); the sixteenth frame reached 528 ms and cleared it; one more step.
    expect(blinked.pauseMenu.blinkMilliseconds).toBe(FRAME_MILLISECONDS)
  })

  it('moves the selection with wrap-around (0x00427810)', () => {
    // Arrange
    const paused = press(createFixtureRace(), { isPausePressed: true }).raceState

    // Act
    const up = press(paused, { selectionChange: -1 }).raceState
    const down = press(up, { selectionChange: 1 }).raceState

    // Assert
    expect(up.pauseMenu.selection).toBe(2)
    expect(down.pauseMenu.selection).toBe(0)
  })

  it('resumes when the first item is chosen and runs the frame as usual (0x00436160)', () => {
    // Arrange
    const paused = press(createFixtureRace(), { isPausePressed: true }).raceState

    // Act
    const resumed = confirm(paused)
    const later = press(resumed.raceState, {})

    // Assert
    expect(resumed.raceState.pauseMenu.mode).toBe(PauseMenuMode.NONE)
    expect(resumed.events).toContainEqual({ type: 'race.resumed' })
    expect(later.raceState.phaseMilliseconds).toBe(FRAME_MILLISECONDS)
  })

  it('asks for a confirmation before a restart, the second item selected first', () => {
    // Arrange
    const paused = press(createFixtureRace(), { isPausePressed: true }).raceState

    // Act
    const asked = choose(paused, 1)

    // Assert
    expect(asked.raceState.pauseMenu.mode).toBe(PauseMenuMode.CONFIRMATION)
    expect(asked.raceState.pauseMenu.pendingAction).toBe(PendingAction.RESTART)
    expect(asked.raceState.pauseMenu.selection).toBe(1)
    expect(asked.raceState.isRunning).toBe(true)
  })

  it('leaves the race for a restart once it is confirmed', () => {
    // Arrange
    const asked = choose(press(createFixtureRace(), { isPausePressed: true }).raceState, 1)

    // Act
    const confirmed = chooseYes(asked.raceState)

    // Assert
    expect(confirmed.raceState.isRunning).toBe(false)
    expect(confirmed.raceState.exit).toBe(RaceExit.RESTART)
    expect(confirmed.events).toContainEqual({ type: 'race.ended', exit: RaceExit.RESTART })
  })

  it('leaves the race for a quit once it is confirmed', () => {
    // Arrange
    const asked = choose(press(createFixtureRace(), { isPausePressed: true }).raceState, 2)

    // Act
    const confirmed = chooseYes(asked.raceState)

    // Assert
    expect(asked.raceState.pauseMenu.pendingAction).toBe(PendingAction.QUIT)
    expect(confirmed.raceState.exit).toBe(RaceExit.QUIT)
    expect(confirmed.raceState.isRunning).toBe(false)
  })

  it('resumes when the confirmation is declined', () => {
    // Arrange
    const asked = choose(press(createFixtureRace(), { isPausePressed: true }).raceState, 2)

    // Act
    const declined = confirm(asked.raceState)

    // Assert
    expect(declined.raceState.isRunning).toBe(true)
    expect(declined.raceState.pauseMenu.mode).toBe(PauseMenuMode.NONE)
    expect(declined.raceState.pauseMenu.pendingAction).toBe(PendingAction.NONE)
  })

  it('clears the points record of a circuit restarted in place (settings flag 0x40, 0x00440860)', () => {
    // Arrange
    const record = recordPlace(createPointsRecord(), 0, 0)
    const state = Object.freeze({
      ...createFixtureRace(),
      pointsRecord: record,
      isSettingsFlag40Set: true,
    })
    const asked = choose(press(state, { isPausePressed: true }).raceState, 1)

    // Act
    const confirmed = chooseYes(asked.raceState)

    // Assert
    expect(confirmed.raceState.exit).toBe(RaceExit.RESTART)
    expect(confirmed.raceState.pointsRecord?.totalPoints).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('ends a demonstration at any key (0x00435c00)', () => {
    // Arrange
    const demonstration = Object.freeze({ ...createFixtureRace(), isDemonstration: true })

    // Act
    const ended = press(demonstration, { isAnyInputPressed: true })

    // Assert
    expect(ended.raceState.isRunning).toBe(false)
    expect(ended.raceState.exit).toBe(RaceExit.DEMONSTRATION_INTERRUPTED)
    expect(ended.events).toEqual([{ type: 'race.ended', exit: RaceExit.DEMONSTRATION_INTERRUPTED }])
  })

  it('answers only when the confirm key goes up, after it went down (0x00427810, 0x004278c0)', () => {
    // Arrange
    const paused = press(createFixtureRace(), { isPausePressed: true }).raceState

    // Act
    const held = press(paused, { isConfirmPressed: true })
    const heldLonger = press(held.raceState, {})
    const released = press(heldLonger.raceState, { isConfirmReleased: true })

    // Assert
    expect(heldLonger.raceState.pauseMenu.mode).toBe(PauseMenuMode.PAUSED)
    expect(released.raceState.pauseMenu.mode).toBe(PauseMenuMode.NONE)
  })

  it('ignores a confirm key that goes up while the menu still waits, and the selection keys after the key went down', () => {
    // Arrange
    const paused = press(createFixtureRace(), { isPausePressed: true }).raceState

    // Act
    const earlyRelease = press(paused, { isConfirmReleased: true })
    const down = press(earlyRelease.raceState, { isConfirmPressed: true })
    const moved = press(down.raceState, { selectionChange: 1 })

    // Assert
    expect(earlyRelease.raceState.pauseMenu.mode).toBe(PauseMenuMode.PAUSED)
    expect(moved.raceState.pauseMenu.selection).toBe(0)
  })
})

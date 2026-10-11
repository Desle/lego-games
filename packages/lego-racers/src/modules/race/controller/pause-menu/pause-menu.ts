import {
  CLOSED_PAUSE_MENU,
  PAUSE_MENU_BLINK_PERIOD_MILLISECONDS,
  PAUSE_MENU_FIRST_SELECTIONS,
  PAUSE_MENU_ITEM_COUNTS,
  PauseMenuMode,
  PendingAction,
} from '../../types/pause-menu/pause-menu.ts'
import type { PauseMenu, RaceMenuInput } from '../../types/pause-menu/pause-menu.types.ts'
import { clearPointsRecord } from '../../types/points-record/points-record.ts'
import { RaceExit } from '../../types/race-exit/race-exit.ts'
import type { RaceEvent, RaceExit as RaceExitValue, RaceState } from '../../types/race.types.ts'
import type { PauseMenuStep } from './pause-menu.types.ts'
import { IDLE_RACER_CONTROLS, NO_RACE_CONTACTS } from '../race-world/race-world.ts'
import { applyPlayerControls } from '../update-race/update-race.ts'

// The menu keys of a frame in which nothing is pressed.
export const NO_MENU_INPUT: RaceMenuInput = Object.freeze({
  isPausePressed: false,
  selectionChange: 0,
  isConfirmPressed: false,
  isAnyInputPressed: false,
})

const getStep = (raceState: RaceState, events: readonly RaceEvent[] = []): PauseMenuStep =>
  Object.freeze({ raceState, events: Object.freeze([...events]) })

const getEnded = (raceState: RaceState, exit: RaceExitValue): PauseMenuStep =>
  getStep(Object.freeze({ ...raceState, isRunning: false, exit }), [{ type: 'race.ended', exit }])

const getOpenedMenu = (mode: PauseMenu['mode'], pendingAction: PauseMenu['pendingAction']) =>
  Object.freeze({
    mode,
    selection: PAUSE_MENU_FIRST_SELECTIONS[mode],
    isAnswered: false,
    pendingAction,
    blinkMilliseconds: 0,
  })

// 0x00436010 (the pause menu is built): every local player's controls are released (0x00430c20) and the menu opens with
// its first item selected.
const openMenu = (
  raceState: RaceState,
  mode: PauseMenu['mode'],
  pendingAction: PauseMenu['pendingAction']
): RaceState => {
  const released = applyPlayerControls(raceState, {
    controls: raceState.playerRacerIndices.map(() => IDLE_RACER_CONTROLS),
    contacts: NO_RACE_CONTACTS,
  })
  return Object.freeze({ ...released, pauseMenu: getOpenedMenu(mode, pendingAction) })
}

// 0x00427810: while a menu waits for an answer the selection moves with wrap-around, and a confirm key answers it.
const getMenuAfterKeys = (menu: PauseMenu, input: RaceMenuInput): PauseMenu => {
  if (menu.isAnswered) return menu
  const count = PAUSE_MENU_ITEM_COUNTS[menu.mode]
  const moved =
    input.selectionChange > 0
      ? menu.selection + 1 === count
        ? 0
        : menu.selection + 1
      : input.selectionChange < 0
        ? (menu.selection === 0 ? count : menu.selection) - 1
        : menu.selection
  return Object.freeze({ ...menu, selection: moved, isAnswered: input.isConfirmPressed })
}

// Race_RunLoop 0x00432540 and 0x00435c00 (the race's key handler): in a demonstration any key ends the race; the
// pause key opens the pause menu; an open menu takes the selection and confirm keys.
export const applyMenuInput = (raceState: RaceState, input: RaceMenuInput): PauseMenuStep => {
  if (raceState.isDemonstration && input.isAnyInputPressed) {
    return getEnded(raceState, RaceExit.DEMONSTRATION_INTERRUPTED)
  }
  const isOpening = input.isPausePressed && raceState.pauseMenu.mode === PauseMenuMode.NONE
  const opened = isOpening
    ? openMenu(raceState, PauseMenuMode.PAUSED, PendingAction.NONE)
    : raceState
  const { pauseMenu } = opened
  const keyed =
    pauseMenu.mode === PauseMenuMode.NONE
      ? opened
      : Object.freeze({ ...opened, pauseMenu: getMenuAfterKeys(pauseMenu, input) })
  return getStep(keyed, isOpening ? [{ type: 'race.paused' }] : [])
}

// Race_Update 0x00435220 while a menu is open: 0x00427420 advances the menu's blink timer, wrapping at 500 ms.
export const getRaceWithMenuBlink = (
  raceState: RaceState,
  frameMilliseconds: number
): RaceState => {
  const blink = raceState.pauseMenu.blinkMilliseconds + frameMilliseconds
  return Object.freeze({
    ...raceState,
    pauseMenu: Object.freeze({
      ...raceState.pauseMenu,
      blinkMilliseconds: blink >= PAUSE_MENU_BLINK_PERIOD_MILLISECONDS ? 0 : blink,
    }),
  })
}

// The pause menu's item chosen: the second asks to restart, the third to quit; both are confirmed first.
const getPendingAction = (selection: number): PauseMenu['pendingAction'] =>
  selection === 1
    ? PendingAction.RESTART
    : selection === 2
      ? PendingAction.QUIT
      : PendingAction.NONE

// 0x00436160's confirmation: "yes" (the first item) of a restart or a quit. A restart in a circuit leaves the loop
// (settings +0x1e |= 0x20) unless settings +0x1e & 0x40, when the points record is cleared (0x00440860) and the
// race restarts in place (0x004362e0, the port leaves the loop for the caller to start it again). A quit sets
// settings +0x1e |= 0x8 and leaves the loop.
const getConfirmedStep = (raceState: RaceState): PauseMenuStep => {
  const { pendingAction } = raceState.pauseMenu
  const closed: RaceState = Object.freeze({ ...raceState, pauseMenu: CLOSED_PAUSE_MENU })
  if (pendingAction === PendingAction.RESTART) {
    const { pointsRecord } = raceState
    const cleared: RaceState =
      pointsRecord !== null && raceState.isSettingsFlag40Set
        ? Object.freeze({ ...closed, pointsRecord: clearPointsRecord(pointsRecord) })
        : closed
    return getEnded(cleared, RaceExit.RESTART)
  }
  return pendingAction === PendingAction.QUIT ? getEnded(closed, RaceExit.QUIT) : getStep(closed)
}

// 0x00436160 (once the player has answered a menu): the answer is applied and the menu closes, or a confirmation opens.
export const answerPauseMenu = (raceState: RaceState): PauseMenuStep => {
  const { pauseMenu } = raceState
  const { selection } = pauseMenu
  if (pauseMenu.mode === PauseMenuMode.PAUSED) {
    const pending = getPendingAction(selection)
    return pending === PendingAction.NONE
      ? getStep(Object.freeze({ ...raceState, pauseMenu: CLOSED_PAUSE_MENU }), [
          { type: 'race.resumed' },
        ])
      : getStep(openMenu(raceState, PauseMenuMode.CONFIRMATION, pending))
  }
  if (pauseMenu.mode === PauseMenuMode.RESULTS) {
    const closed: RaceState = Object.freeze({ ...raceState, pauseMenu: CLOSED_PAUSE_MENU })
    return selection === 0 ? getEnded(closed, RaceExit.RESTART) : getEnded(closed, RaceExit.LEFT)
  }
  if (pauseMenu.mode === PauseMenuMode.CONFIRMATION && selection === 0) {
    return getConfirmedStep(raceState)
  }
  return getStep(Object.freeze({ ...raceState, pauseMenu: CLOSED_PAUSE_MENU }), [
    { type: 'race.resumed' },
  ])
}

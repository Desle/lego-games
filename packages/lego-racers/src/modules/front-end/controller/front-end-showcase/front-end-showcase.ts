import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  FrontEndEnvironment,
  FrontEndResources,
  FrontEndState,
} from '../../types/front-end.types.ts'
import { getBaseCar } from '../driver-base/driver-base.ts'
import { getSavedCarOfRacer } from '../profile/profile.ts'
import type { ScreenNavigation } from '../../types/front-end-screen.types.ts'
import {
  createRacerShowcase,
  getIsRacerShowcaseReactionDone,
  startRacerShowcaseReaction,
  stepRacerShowcase,
} from '../racer-showcase/racer-showcase.ts'

// The screens with a racer showcase (FUN_00488ed0 builds the racer widgets of the pick screens).
const SHOWCASE_SCREEN_IDS: ReadonlySet<number> = new Set([
  FrontEndScreen.PICK_RACER,
  FrontEndScreen.PICK_RACER_PLAYER_ONE,
  FrontEndScreen.PICK_RACER_PLAYER_TWO,
])

const getIsShowcaseScreen = (state: FrontEndState): boolean =>
  SHOWCASE_SCREEN_IDS.has(state.screens.at(-1)?.screenId ?? -1)

// The car of the racer the list shows: the save's racer at that index, else the car the menus work on.
const getShownCar = (state: FrontEndState, resources: FrontEndResources, racerIndex: number) => {
  const racer = state.settings.saveFile?.racers[racerIndex]
  return racer === undefined
    ? getBaseCar(state.settings, resources)
    : getSavedCarOfRacer(resources, racer)
}

// 0x00486a00 each frame: while a showcase screen is on top the driver's clip and the turntable advance (the idle clips
// are drawn from the shared random table, so the cursor of the settings moves).
export const getStateWithShowcaseStep = (
  state: FrontEndState,
  resources: FrontEndResources,
  environment: FrontEndEnvironment,
  elapsedMilliseconds: number
): FrontEndState => {
  if (!getIsShowcaseScreen(state) || state.showcase === null) return state
  const step = stepRacerShowcase(
    state.showcase,
    resources.getRacerShowcaseAnimation(),
    environment.randomTable,
    state.settings.randomPosition,
    elapsedMilliseconds
  )
  return {
    ...state,
    showcase: step.showcase,
    settings: { ...state.settings, randomPosition: step.randomPosition },
  }
}

// A showcase screen opens, or its racer changes (0x004864a0: the slot's flag is set again and the update draws a new
// clip): the showcase starts over for the racer shown. A screen that is not a showcase screen has none.
export const getStateWithShowcaseOpened = (
  before: FrontEndState | null,
  after: FrontEndState,
  resources: FrontEndResources,
  environment: FrontEndEnvironment,
  elapsedMilliseconds: number
): FrontEndState => {
  const top = after.screens.at(-1)
  if (top === undefined || !getIsShowcaseScreen(after)) return { ...after, showcase: null }
  const racerIndex = top.selection.racerIndex
  const isSameScreen =
    before !== null &&
    before.screens.length === after.screens.length &&
    before.screens.at(-1)?.screenId === top.screenId
  if (isSameScreen && after.showcase !== null && after.showcase.racerIndex === racerIndex) {
    return after
  }
  const step = createRacerShowcase(
    racerIndex,
    getShownCar(after, resources, racerIndex),
    resources.getRacerShowcaseAnimation(),
    environment.randomTable,
    after.settings.randomPosition,
    elapsedMilliseconds
  )
  return {
    ...after,
    showcase: step.showcase,
    settings: { ...after.settings, randomPosition: step.randomPosition },
  }
}

// 0x00484f40: a racer picked on the race select (the screen goes on to the next player or the race) first starts his
// reaction clip; the navigation waits for the clip. Null for any other answer.
export const getStateWithShowcaseReaction = (
  state: FrontEndState,
  navigation: ScreenNavigation,
  resources: FrontEndResources,
  environment: FrontEndEnvironment,
  elapsedMilliseconds: number
): FrontEndState | null => {
  if (!getIsShowcaseScreen(state) || state.showcase === null) return null
  if (navigation.kind !== 'push' && navigation.kind !== 'race') return null
  const step = startRacerShowcaseReaction(
    state.showcase,
    resources.getRacerShowcaseAnimation(),
    environment.randomTable,
    state.settings.randomPosition,
    navigation,
    elapsedMilliseconds
  )
  return {
    ...state,
    showcase: step.showcase,
    settings: { ...state.settings, randomPosition: step.randomPosition },
  }
}

// 0x004869b0: the navigation a pressed button asked for, once the reaction clip has ended.
export const getPendingShowcaseNavigation = (
  state: FrontEndState,
  resources: FrontEndResources
): ScreenNavigation | null => {
  const pending = state.showcase?.pendingNavigation ?? null
  if (pending === null || state.showcase === null || state.outcome !== 'running') return null
  return getIsRacerShowcaseReactionDone(state.showcase, resources.getRacerShowcaseAnimation())
    ? pending
    : null
}

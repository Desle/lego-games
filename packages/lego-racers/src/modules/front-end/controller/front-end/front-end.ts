import type {
  FrontEndMemory,
  FrontEndDrawCommand,
  FrontEndEnvironment,
  FrontEndFrame,
  FrontEndInput,
  FrontEndRaceRequest,
  FrontEndResources,
  FrontEndState,
  FrontEndStep,
  OpenedScreen,
} from '../../types/front-end.types.ts'
import { createBuilderSession } from '../../../car-builder/index.ts'
import { getSettingsWithMemory } from '../profile/profile.ts'
import { getDriverForScreen } from '../driver-base/driver-base.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type { ScreenRuntime } from '../../types/front-end-screen.types.ts'
import {
  getInitialSelection,
  getScreenDefinition,
  getScreenFileName,
} from '../front-end-screens/front-end-screens.ts'
import { createFrontEndSettings } from '../screen-helpers/screen-helpers.ts'
import { getFrontEndMusicIndex } from '../front-end-music/front-end-music.ts'
import { getWidgetCommands } from '../widget-commands/widget-commands.ts'

const getRuntime = (
  state: FrontEndState,
  resources: FrontEndResources,
  environment: FrontEndEnvironment
): ScreenRuntime | null => {
  const screen = state.screens.at(-1)
  if (screen === undefined) return null
  return {
    resources,
    environment,
    settings: state.settings,
    selection: screen.selection,
    builder: state.builder,
    driver: state.driver,
    screenMilliseconds: state.screenMilliseconds,
  }
}

// 0x004738a0 .. 0x00476ff0: the builder screen starts a new car on the first set the first time it opens.
const getBuilderForScreen = (
  screenId: number,
  builder: FrontEndState['builder'],
  resources: FrontEndResources
): FrontEndState['builder'] =>
  screenId === FrontEndScreen.CAR_BUILD && builder === null
    ? createBuilderSession(resources.getBuilderCatalog())
    : builder

// What the menus keep between two visits of one game session: the car and driver the player made, and the shared random
// position (the original keeps both in the application's settings object and global).
export const NO_FRONT_END_MEMORY: FrontEndMemory = Object.freeze({
  playerCar: null,
  randomPosition: 0,
  saveFile: null,
  racerIndex: 0,
})

// GameApplication_RunFrontEnd 0x0042bdc0 → FrontEnd_Run 0x0042b1e0: the front end starts on the screen the application
// names (`+0x1c`; the main menu once the introductions are over) with the settings of a new session.
export const createFrontEnd = (
  resources: FrontEndResources,
  environment: FrontEndEnvironment,
  firstScreenId: number = FrontEndScreen.MAIN_MENU,
  memory: FrontEndMemory = NO_FRONT_END_MEMORY
): FrontEndState => {
  const settings = getSettingsWithMemory(resources, createFrontEndSettings(), memory)
  return Object.freeze({
    builder: getBuilderForScreen(firstScreenId, null, resources),
    driver: getDriverForScreen(firstScreenId, settings, resources, environment),
    screens: [
      {
        screenId: firstScreenId,
        selection: getInitialSelection(firstScreenId, {
          resources,
          environment,
          settings,
          builder: null,
          driver: null,
          screenMilliseconds: 0,
        }),
      },
    ],
    settings,
    outcome: 'running',
    screenMilliseconds: 0,
    musicListIndex: getFrontEndMusicIndex(firstScreenId, null),
  })
}

// The state after a screen opened: the music its opening starts, if any.
const getOpenedState = (state: FrontEndState, screenId: number): OpenedScreen => {
  const musicListIndex = getFrontEndMusicIndex(screenId, state.musicListIndex)
  return {
    state: musicListIndex === null ? state : { ...state, musicListIndex },
    musicListIndex,
  }
}

// One pass of the loop of 0x0042d510: the time advances and the input, if any, reaches the current screen, which
// answers with the next screen, the race or the exit (0x004812c0, 0x004850a0).
export const stepFrontEnd = (
  state: FrontEndState,
  resources: FrontEndResources,
  environment: FrontEndEnvironment,
  input: FrontEndInput | null,
  frameMilliseconds: number
): FrontEndStep => {
  const advanced: FrontEndState = {
    ...state,
    screenMilliseconds: state.screenMilliseconds + frameMilliseconds,
  }
  const runtime = getRuntime(advanced, resources, environment)
  const current = advanced.screens.at(-1)
  if (input === null || runtime === null || current === undefined || state.outcome !== 'running') {
    return { state: advanced, soundNames: [], musicListIndex: null }
  }
  const result = getScreenDefinition(current.screenId).handleInput(runtime, input)
  const screens = [...advanced.screens.slice(0, -1), { ...current, selection: result.selection }]
  const navigated: FrontEndState = {
    ...advanced,
    screens,
    settings: result.settings,
    builder: result.builder,
    driver: result.driver,
  }
  switch (result.navigation.kind) {
    case 'push': {
      const screenId = result.navigation.screenId
      const next = {
        screenId,
        selection: getInitialSelection(screenId, { ...runtime, settings: result.settings }),
      }
      const opened = getOpenedState(
        {
          ...navigated,
          screens: [...screens, next],
          builder: getBuilderForScreen(screenId, navigated.builder, resources),
          driver: getDriverForScreen(screenId, navigated.settings, resources, environment),
          screenMilliseconds: 0,
        },
        screenId
      )
      return { ...opened, soundNames: result.soundNames }
    }
    case 'pop': {
      if (screens.length <= 1) {
        return { state: navigated, soundNames: result.soundNames, musicListIndex: null }
      }
      const remaining = screens.slice(0, -1)
      const opened = getOpenedState(
        { ...navigated, screens: remaining, screenMilliseconds: 0 },
        remaining.at(-1)?.screenId ?? FrontEndScreen.MAIN_MENU
      )
      return { ...opened, soundNames: result.soundNames }
    }
    case 'race':
      return {
        state: { ...navigated, outcome: 'race' },
        soundNames: result.soundNames,
        musicListIndex: null,
      }
    case 'quit':
      return {
        state: { ...navigated, outcome: 'quit' },
        soundNames: result.soundNames,
        musicListIndex: null,
      }
    case 'none':
      return { state: navigated, soundNames: result.soundNames, musicListIndex: null }
  }
}

// The commands of the current screen's widgets, in the order the screen lists them.
export const getFrontEndFrame = (
  state: FrontEndState,
  resources: FrontEndResources,
  environment: FrontEndEnvironment
): FrontEndFrame => {
  const runtime = getRuntime(state, resources, environment)
  const current = state.screens.at(-1)
  if (runtime === null || current === undefined) return { commands: [], soundNames: [] }
  const files = resources.getScreenFiles(getScreenFileName(current.screenId, resources.menuNames))
  if (files === null) return { commands: [], soundNames: [] }
  const commands: FrontEndDrawCommand[] = getScreenDefinition(current.screenId)
    .getWidgets(runtime)
    .flatMap((widget) => getWidgetCommands({ resources, files }, widget))
  return { commands, soundNames: [] }
}

// What the menus leave in the game settings when a race starts (FrontEnd_PrepareRaceSettings 0x0042d730).
export const getFrontEndRaceRequest = (state: FrontEndState): FrontEndRaceRequest | null => {
  if (state.outcome !== 'race') return null
  const { settings } = state
  return Object.freeze({
    mode: settings.mode,
    raceName: settings.raceName,
    raceFolder: settings.raceFolder,
    isRaceFlagged: settings.isRaceFlagged,
    circuitRaces: settings.circuitRaces,
    circuitName: settings.circuitName,
    racerCount: settings.racerCount,
    localPlayerCount: settings.localPlayerCount,
    lapCount: settings.lapCount,
    playerRacerNames: settings.playerRacerNames,
    playerCar: settings.playerCar,
    randomPosition: settings.randomPosition,
  })
}

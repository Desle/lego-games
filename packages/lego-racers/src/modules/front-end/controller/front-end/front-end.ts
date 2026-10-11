import type {
  FrontEndDrawCommand,
  FrontEndEnvironment,
  FrontEndFrame,
  FrontEndInput,
  FrontEndRaceRequest,
  FrontEndResources,
  FrontEndState,
  FrontEndStep,
} from '../../types/front-end.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type { ScreenRuntime } from '../../types/front-end-screen.types.ts'
import {
  getInitialSelection,
  getScreenDefinition,
  getScreenFileName,
} from '../front-end-screens/front-end-screens.ts'
import { createFrontEndSettings } from '../screen-helpers/screen-helpers.ts'
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
    screenMilliseconds: state.screenMilliseconds,
  }
}

// GameApplication_RunFrontEnd 0x0042bdc0 → FrontEnd_Run 0x0042b1e0: the front end starts on the screen the application
// names (`+0x1c`; the main menu once the introductions are over) with the settings of a new session.
export const createFrontEnd = (
  resources: FrontEndResources,
  environment: FrontEndEnvironment,
  firstScreenId: number = FrontEndScreen.MAIN_MENU
): FrontEndState => {
  const settings = createFrontEndSettings()
  return Object.freeze({
    screens: [
      {
        screenId: firstScreenId,
        selection: getInitialSelection(firstScreenId, {
          resources,
          environment,
          settings,
          screenMilliseconds: 0,
        }),
      },
    ],
    settings,
    outcome: 'running',
    screenMilliseconds: 0,
  })
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
    return { state: advanced, soundNames: [] }
  }
  const result = getScreenDefinition(current.screenId).handleInput(runtime, input)
  const screens = [...advanced.screens.slice(0, -1), { ...current, selection: result.selection }]
  const navigated: FrontEndState = { ...advanced, screens, settings: result.settings }
  switch (result.navigation.kind) {
    case 'push': {
      const screenId = result.navigation.screenId
      const next = {
        screenId,
        selection: getInitialSelection(screenId, { ...runtime, settings: result.settings }),
      }
      return {
        state: { ...navigated, screens: [...screens, next], screenMilliseconds: 0 },
        soundNames: result.soundNames,
      }
    }
    case 'pop':
      return {
        state:
          screens.length > 1
            ? { ...navigated, screens: screens.slice(0, -1), screenMilliseconds: 0 }
            : navigated,
        soundNames: result.soundNames,
      }
    case 'race':
      return { state: { ...navigated, outcome: 'race' }, soundNames: result.soundNames }
    case 'quit':
      return { state: { ...navigated, outcome: 'quit' }, soundNames: result.soundNames }
    case 'none':
      return { state: navigated, soundNames: result.soundNames }
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
  })
}

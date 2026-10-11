import type {
  FrontEndMemory,
  FrontEndDemonstrationRequest,
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
import {
  createMenuFigureAnimation,
  restartMenuFigureAnimation,
  stepMenuFigureAnimation,
} from '../menu-figure-animation/menu-figure-animation.ts'
import type {
  MenuFigureAnimation,
  MenuFigureStep,
} from '../../types/menu-figure/menu-figure-animation.types.ts'
import {
  getStateWithShowcaseOpened,
  getStateWithShowcaseStep,
} from '../front-end-showcase/front-end-showcase.ts'
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
    menuFigureAnimation: state.menuFigure?.animation ?? null,
    showcase: state.showcase,
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
  const created: FrontEndState = {
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
          menuFigureAnimation: null,
          showcase: null,
        }),
      },
    ],
    settings,
    outcome: 'running',
    screenMilliseconds: 0,
    musicListIndex: getFrontEndMusicIndex(firstScreenId, null),
    menuFigure:
      firstScreenId === FrontEndScreen.MAIN_MENU
        ? createMenuFigureAnimation(resources.getMenuFigureAnimation())
        : null,
    showcase: null,
  }
  return Object.freeze(getStateWithShowcaseOpened(null, created, resources, environment, 0))
}

// The state after a screen opened: the music its opening starts, if any.
const getOpenedState = (state: FrontEndState, screenId: number): OpenedScreen => {
  const musicListIndex = getFrontEndMusicIndex(screenId, state.musicListIndex)
  return {
    state: musicListIndex === null ? state : { ...state, musicListIndex },
    musicListIndex,
  }
}

// The current screen's answer to the input, if any: the next screen, the race or the exit (0x004812c0, 0x004850a0).
const getInputStep = (
  advanced: FrontEndState,
  resources: FrontEndResources,
  environment: FrontEndEnvironment,
  input: FrontEndInput | null
): FrontEndStep => {
  const runtime = getRuntime(advanced, resources, environment)
  const current = advanced.screens.at(-1)
  if (
    input === null ||
    runtime === null ||
    current === undefined ||
    advanced.outcome !== 'running'
  ) {
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

// The main menu figure (0x00481450, 0x00480e10): its timers and clips run while that screen is the top one, and it
// plays `start` again every time the screen is entered (0x00481000).
const getFigureStep = (
  state: FrontEndState,
  resources: FrontEndResources,
  frameMilliseconds: number
): MenuFigureStep | null => {
  const isMainMenu = state.screens.at(-1)?.screenId === FrontEndScreen.MAIN_MENU
  if (!isMainMenu || state.menuFigure === null) return null
  return stepMenuFigureAnimation(
    state.menuFigure,
    resources.getMenuFigureAnimation(),
    frameMilliseconds
  )
}

const getEnteredFigure = (
  state: FrontEndState,
  resources: FrontEndResources
): MenuFigureAnimation | null => {
  if (state.screens.at(-1)?.screenId !== FrontEndScreen.MAIN_MENU) return state.menuFigure
  const animation = resources.getMenuFigureAnimation()
  return state.menuFigure === null
    ? createMenuFigureAnimation(animation)
    : restartMenuFigureAnimation(state.menuFigure, animation)
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
  const figureStep = getFigureStep(state, resources, frameMilliseconds)
  const advanced: FrontEndState = {
    ...getStateWithShowcaseStep(state, resources, environment, frameMilliseconds),
    screenMilliseconds: state.screenMilliseconds + frameMilliseconds,
    menuFigure: figureStep?.figure ?? state.menuFigure,
  }
  const figureSounds = figureStep?.soundNames ?? []
  const stepped = getInputStep(advanced, resources, environment, input)
  if (
    stepped.state.outcome === 'running' &&
    stepped.state.screens.at(-1)?.screenId === FrontEndScreen.MAIN_MENU &&
    figureStep?.figure.idleMilliseconds === 0
  ) {
    return { ...stepped, state: { ...stepped.state, outcome: 'demonstration' } }
  }
  const entered: FrontEndState = getStateWithShowcaseOpened(
    advanced,
    {
      ...stepped.state,
      menuFigure:
        stepped.state.screens.length === advanced.screens.length &&
        stepped.state.screens.at(-1)?.screenId === advanced.screens.at(-1)?.screenId
          ? stepped.state.menuFigure
          : getEnteredFigure(stepped.state, resources),
    },
    resources,
    environment,
    frameMilliseconds
  )
  return { ...stepped, state: entered, soundNames: [...figureSounds, ...stepped.soundNames] }
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

// 0x00481450 with the idle timer out: the screen's done flag is set with no target, the front end returns and the game
// starts a demonstration (`createDemonstrationSettings`, `FrontEnd_PrepareRaceSettings` 0x0042d730 with no local
// player), which draws from the shared random table at the cursor the menus left.
export const getFrontEndDemonstrationRequest = (
  state: FrontEndState
): FrontEndDemonstrationRequest | null =>
  state.outcome === 'demonstration'
    ? Object.freeze({ randomPosition: state.settings.randomPosition })
    : null

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

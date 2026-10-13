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
import type { ScreenNavigation, ScreenRuntime } from '../../types/front-end-screen.types.ts'
import type { RacePreviewClock } from '../../types/race-preview.types.ts'
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
  getPendingShowcaseNavigation,
  getStateWithShowcaseOpened,
  getStateWithShowcaseReaction,
  getStateWithShowcaseStep,
} from '../front-end-showcase/front-end-showcase.ts'
import { advanceRacePreviewEffects } from '../race-preview/race-preview-effects.ts'
import { advanceRacePreviewEmitters } from '../race-preview/race-preview-emitters.ts'
import {
  advanceRacePreviewClock,
  createRacePreviewClock,
  restartBestTimeClock,
} from '../race-preview/race-preview.ts'
import { getCinemaScreenSource, getScreenCinema } from '../screens/cinema-screens.ts'
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
    racePreview: state.racePreview,
    racePreviewEmitters: state.racePreviewEmitters,
    racePreviewEffects: state.racePreviewEffects,
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
          racePreview: createRacePreviewClock(),
          racePreviewEmitters: null,
          racePreviewEffects: null,
          menuFigureAnimation: null,
          showcase: null,
        }),
      },
    ],
    settings,
    outcome: 'running',
    screenMilliseconds: 0,
    racePreview: createRacePreviewClock(),
    racePreviewEmitters: null,
    racePreviewEffects: null,
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

// The screen asked to go somewhere (0x004812c0, 0x004850a0): the next screen, back, the race or the exit.
const applyNavigation = (
  navigated: FrontEndState,
  navigation: ScreenNavigation,
  soundNames: readonly string[],
  resources: FrontEndResources,
  environment: FrontEndEnvironment
): FrontEndStep => {
  const { screens } = navigated
  const runtime = getRuntime(navigated, resources, environment)
  switch (navigation.kind) {
    case 'push': {
      if (runtime === null) return { state: navigated, soundNames, musicListIndex: null }
      const screenId = navigation.screenId
      const next = { screenId, selection: getInitialSelection(screenId, runtime) }
      const opened = getOpenedState(
        {
          ...navigated,
          screens: [...screens, next],
          builder: getBuilderForScreen(screenId, navigated.builder, resources),
          driver: getDriverForScreen(screenId, navigated.settings, resources, environment),
          screenMilliseconds: 0,
          racePreview: createRacePreviewClock(),
          racePreviewEmitters: null,
          racePreviewEffects: null,
        },
        screenId
      )
      return { ...opened, soundNames }
    }
    case 'pop': {
      if (screens.length <= 1) return { state: navigated, soundNames, musicListIndex: null }
      const remaining = screens.slice(0, -1)
      const opened = getOpenedState(
        {
          ...navigated,
          screens: remaining,
          screenMilliseconds: 0,
          racePreview: createRacePreviewClock(),
        },
        remaining.at(-1)?.screenId ?? FrontEndScreen.MAIN_MENU
      )
      return { ...opened, soundNames }
    }
    case 'race':
      return { state: { ...navigated, outcome: 'race' }, soundNames, musicListIndex: null }
    case 'quit':
      return { state: { ...navigated, outcome: 'quit' }, soundNames, musicListIndex: null }
    case 'none':
      return { state: navigated, soundNames, musicListIndex: null }
  }
}

// The current screen's answer to the input, if any. A racer picked on the race select starts his reaction clip and the
// screen leaves when it has ended (0x00484f40, 0x004869b0).
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
    advanced.outcome !== 'running' ||
    advanced.showcase?.pendingNavigation != null
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
  const delayed = getStateWithShowcaseReaction(navigated, result.navigation, resources, environment)
  if (delayed !== null) {
    return { state: delayed, soundNames: result.soundNames, musicListIndex: null }
  }
  return applyNavigation(navigated, result.navigation, result.soundNames, resources, environment)
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

// Only the circuit race screen switches races (0x0047a3f0), and not on the last circuit.
const getIsPreviewCycling = (state: FrontEndState, resources: FrontEndResources): boolean => {
  const screen = state.screens.at(-1)
  return (
    screen?.screenId === FrontEndScreen.CIRCUIT_RACE &&
    screen.selection.circuitIndex !== resources.circuits.circuits.length - 1
  )
}

// The race preview's emitters after a frame (Cinema_Update 0x00466d90): they follow the cinema of the race on show, and
// their births draw from the shared random table, which moves its cursor.
const getStateWithPreviewEmitters = (
  before: FrontEndState,
  after: FrontEndState,
  isRestarted: boolean,
  resources: FrontEndResources,
  environment: FrontEndEnvironment,
  frameMilliseconds: number
): FrontEndState => {
  const runtime = getRuntime(after, resources, environment)
  const screenId = after.screens.at(-1)?.screenId
  const screenCinema =
    runtime === null || screenId === undefined ? null : getScreenCinema(runtime, screenId)
  if (
    screenCinema === null &&
    before.racePreviewEmitters === null &&
    before.racePreviewEffects === null
  )
    return after
  if (screenCinema === null) {
    return { ...after, racePreviewEmitters: null, racePreviewEffects: null }
  }
  const preview = resources.getCinemaFiles(screenCinema.source)
  const cinema =
    preview.cinemas.cinemas.find(
      (candidate) => candidate.name.toLowerCase() === screenCinema.cinemaName.toLowerCase()
    ) ?? null
  const isRestartedNow =
    isRestarted || after.racePreview.cycleCount !== before.racePreview.cycleCount
  const step = advanceRacePreviewEmitters({
    previous: before.racePreviewEmitters,
    resources: preview,
    cinema,
    previousMilliseconds: before.racePreview.cinemaMilliseconds,
    milliseconds: after.racePreview.cinemaMilliseconds,
    frameMilliseconds,
    isRestarted: isRestartedNow,
    random: { table: environment.randomTable, position: after.settings.randomPosition },
  })
  return {
    ...after,
    racePreviewEffects: advanceRacePreviewEffects({
      previous: before.racePreviewEffects,
      cinema,
      events: preview.events,
      previousMilliseconds: before.racePreview.cinemaMilliseconds,
      milliseconds: after.racePreview.cinemaMilliseconds,
      frameMilliseconds,
      isRestarted: isRestartedNow,
    }),
    racePreviewEmitters: step.emitters,
    settings: { ...after.settings, randomPosition: step.randomPosition },
  }
}

// A full-screen cinema that has run its length is done (Cinema_Update 0x00466d90 sets its finished flag): the screen takes
// the way out a key would give it.
const getIsCinemaScreenEnded = (state: FrontEndState, resources: FrontEndResources): boolean => {
  const screenId = state.screens.at(-1)?.screenId
  const source = screenId === undefined ? null : getCinemaScreenSource(screenId)
  const cinema = source === null ? undefined : resources.getCinemaFiles(source).cinemas.cinemas[0]
  return (
    cinema !== undefined &&
    cinema.framesPerSecond !== 0 &&
    state.racePreview.cinemaMilliseconds >= (cinema.lengthFrames * 1000) / cinema.framesPerSecond
  )
}

// A race changed on the screen that stays open: its handler (0x00488010) restarts the best time's countdown at 2,500 ms, and
// the frame's update (0x00488150) has run already. A screen that opens runs its update in its first frame.
const getRestartedClock = (clock: RacePreviewClock, isScreenChanged: boolean): RacePreviewClock =>
  isScreenChanged ? clock : restartBestTimeClock(clock)

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
    racePreview: advanceRacePreviewClock(
      state.racePreview,
      frameMilliseconds,
      getIsPreviewCycling(state, resources)
    ),
    menuFigure: figureStep?.figure ?? state.menuFigure,
  }
  const figureSounds = figureStep?.soundNames ?? []
  const pending = getPendingShowcaseNavigation(advanced, resources)
  const stepped =
    pending === null
      ? getInputStep(
          advanced,
          resources,
          environment,
          input ?? (getIsCinemaScreenEnded(advanced, resources) ? 'accept' : null)
        )
      : applyNavigation(advanced, pending, [], resources, environment)
  if (
    stepped.state.outcome === 'running' &&
    stepped.state.screens.at(-1)?.screenId === FrontEndScreen.MAIN_MENU &&
    figureStep?.figure.idleMilliseconds === 0
  ) {
    return { ...stepped, state: { ...stepped.state, outcome: 'demonstration' } }
  }
  const isScreenChanged =
    stepped.state.screens.length !== advanced.screens.length ||
    stepped.state.screens.at(-1)?.screenId !== advanced.screens.at(-1)?.screenId
  // A new circuit shows its first race (0x0047a0e0 calls 0x0047a2b0): the timer and the cinema start again.
  const isPreviewRestarted =
    isScreenChanged ||
    stepped.state.screens.at(-1)?.selection.circuitIndex !==
      advanced.screens.at(-1)?.selection.circuitIndex
  const entered: FrontEndState = getStateWithShowcaseOpened(
    advanced,
    {
      ...stepped.state,
      // The frame that opens a screen already runs its update (0x0047a3f0).
      racePreview: isPreviewRestarted
        ? getRestartedClock(
            advanceRacePreviewClock(
              createRacePreviewClock(),
              frameMilliseconds,
              getIsPreviewCycling(stepped.state, resources)
            ),
            isScreenChanged
          )
        : stepped.state.racePreview,
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
  const previewed = getStateWithPreviewEmitters(
    state,
    entered,
    isPreviewRestarted,
    resources,
    environment,
    frameMilliseconds
  )
  return { ...stepped, state: previewed, soundNames: [...figureSounds, ...stepped.soundNames] }
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

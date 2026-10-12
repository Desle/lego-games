import { createRandomTable } from '../../../random-table/index.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import type { Circuit } from '../../../circuit-database/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { RaceCatalogEntry } from '../../../race-catalog/index.ts'
import { loadFrontEndResources } from '../../services/load-front-end-resources/load-front-end-resources.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  FrontEndEnvironment,
  FrontEndInput,
  FrontEndResources,
  FrontEndState,
} from '../../types/front-end.types.ts'
import { getRaceLoadOptions } from '../race-launch/get-race-load-options.ts'
import {
  createFrontEnd,
  getFrontEndDemonstrationRequest,
  getFrontEndFrame,
  getFrontEndRaceRequest,
  stepFrontEnd,
} from './front-end.ts'

const MENU_FIGURE_CLIP = {
  name: 'clip',
  framesPerMillisecond: 0.03,
  velocity: [0, 0, 0] as const,
  firstTrackIndex: 0,
  frameCount: 100,
  loopLength: 101,
}

const MENU_FIGURE_ANIMATION: SkeletalAnimation = {
  positions: [],
  rotations: [],
  times: [],
  tracks: [],
  clips: [MENU_FIGURE_CLIP, MENU_FIGURE_CLIP, MENU_FIGURE_CLIP],
}

const getCircuit = (name: string): Circuit => ({
  name,
  racerCodes: ['KK', 'IL'],
  firstNumber: 0,
  secondNumber: 0,
  nextName: '',
})

const getEntry = (
  name: string,
  circuitName: string,
  raceNumber: number,
  folder: string
): RaceCatalogEntry => ({
  name,
  raceNumber,
  firstName: folder,
  circuitName,
  shortNumber: 4 + raceNumber,
  isFlagged: false,
  secondName: '',
  thirdName: '',
})

const resources: FrontEndResources = {
  menuNames: ['testmenu', 'splash', 'mainmenu'],
  getMenuText: (stringId) => `text ${String(stringId)}`,
  getCircuitText: (stringId) => `circuit ${String(stringId)}`,
  circuits: { circuits: [getCircuit('c0'), getCircuit('c1')], readByteCount: 0 },
  races: {
    entries: [
      getEntry('a', 'c0', 0, 'racec0r1'),
      getEntry('b', 'c0', 1, 'racec1r0'),
      getEntry('c', 'c1', 0, 'racec0r0'),
    ],
    readByteCount: 0,
  },
  globalStyles: { total: 0, sections: [], readByteCount: 0 },
  getScreenFiles: () => null,
  getFont: () => null,
  getImage: () => null,
  getFontImage: () => null,
  getBuilderCatalog: () => {
    throw new RangeError('The test has no brick catalog')
  },
  getRacerTemplate: () => {
    throw new RangeError('The test has no racer record')
  },
  getDefaultCar: () => ({
    record: {
      name: 'TEST',
      colorBytes: [0, 0, 0, 0, 0],
      chassisName: 'testchas',
      designBytes: [],
      circuitRanks: 0,
    },
    design: null,
  }),
  getDriverCatalog: () => {
    throw new RangeError('The test has no driver catalog')
  },
  getDriverDatabase: () => {
    throw new RangeError('The test has no driver database')
  },
  getMenuFigureAnimation: () => MENU_FIGURE_ANIMATION,
  getRacerShowcaseAnimation: () => ({
    animation: MENU_FIGURE_ANIMATION,
    idleClipIndices: [0, 1, 2],
  }),
}

const environment: FrontEndEnvironment = {
  controllerCount: 0,
  unlockedCircuitMask: 0x7f,
  randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
  isEveryPartUnlocked: true,
  playerRacerNames: ['ALICE', 'BOB'],
  standingRows: [],
}

const play = (
  inputs: readonly FrontEndInput[],
  options: FrontEndEnvironment = environment
): FrontEndState =>
  inputs.reduce(
    (state, input) => stepFrontEnd(state, resources, options, input, 16).state,
    createFrontEnd(resources, options)
  )

const getScreenIds = (state: FrontEndState): readonly number[] =>
  state.screens.map((screen) => screen.screenId)

describe('the front end', () => {
  it('asks for a demonstration when the main menu has waited 60 seconds', () => {
    // Arrange
    const idleFrames = Math.ceil(60000 / 16)
    const wait = (frames: number): FrontEndState =>
      Array.from({ length: frames }).reduce<FrontEndState>(
        (current) => stepFrontEnd(current, resources, environment, null, 16).state,
        createFrontEnd(resources, environment)
      )

    // Act
    const early = wait(idleFrames - 2)
    const waited = wait(idleFrames)

    // Assert
    expect(getFrontEndDemonstrationRequest(early)).toBeNull()
    expect(waited.outcome).toBe('demonstration')
    expect(getFrontEndDemonstrationRequest(waited)).toEqual({ randomPosition: 0 })
  })

  it('starts on the main menu with the garage button focused', () => {
    // Arrange / Act
    const state = createFrontEnd(resources, environment)

    // Assert
    expect(getScreenIds(state)).toEqual([FrontEndScreen.MAIN_MENU])
    expect(state.screens[0]?.selection.focusIndex).toBe(0)
    expect(state.outcome).toBe('running')
  })

  it('opens the screen of the focused main menu button and plays the accept sound', () => {
    // Arrange
    const state = createFrontEnd(resources, environment)

    // Act
    const down = stepFrontEnd(state, resources, environment, 'down', 16)
    const accepted = stepFrontEnd(down.state, resources, environment, 'accept', 16)

    // Assert
    expect(down.soundNames).toEqual(['hilight1'])
    expect(getScreenIds(accepted.state)).toEqual([
      FrontEndScreen.MAIN_MENU,
      FrontEndScreen.CIRCUIT_RACE,
    ])
    expect(accepted.soundNames).toEqual(['ok'])
  })

  it('cannot reach the versus race without a controller and clears the versus flag on the other races', () => {
    // Arrange / Act
    const blocked = play(['down', 'down', 'down', 'accept'])

    // Assert
    expect(getScreenIds(blocked)).toEqual([FrontEndScreen.MAIN_MENU, FrontEndScreen.TIME_TRIAL])
    expect(blocked.settings.isVersus).toBe(false)
  })

  it('opens the versus race with a controller and sets the versus flag', () => {
    // Arrange
    const withController = { ...environment, controllerCount: 1 }

    // Act
    const state = play(['down', 'down', 'down', 'accept'], withController)

    // Assert
    expect(getScreenIds(state)).toEqual([FrontEndScreen.MAIN_MENU, FrontEndScreen.SINGLE_RACE])
    expect(state.settings.isVersus).toBe(true)
  })

  it('asks before it quits and leaves on yes', () => {
    // Arrange / Act
    const asked = play(['down', 'down', 'down', 'down', 'down', 'accept'])
    const declined = stepFrontEnd(asked, resources, environment, 'accept', 16).state
    const answered = play([
      'down',
      'down',
      'down',
      'down',
      'down',
      'down',
      'accept',
      'up',
      'accept',
    ])

    // Assert
    expect(asked.screens[0]?.selection.isDialogOpen).toBe(true)
    expect(asked.outcome).toBe('running')
    expect(declined.screens[0]?.selection.isDialogOpen).toBe(false)
    expect(answered.outcome).toBe('quit')
  })

  it('writes the race the player chose into the settings and starts it after the racer pick', () => {
    // Arrange / Act: single race, circuit c0 (first race a), next, racer pick, confirm.
    const state = play(['down', 'down', 'accept', 'accept', 'accept'])

    // Assert
    expect(getScreenIds(state)).toEqual([
      FrontEndScreen.MAIN_MENU,
      FrontEndScreen.SINGLE_RACE,
      FrontEndScreen.PICK_RACER,
    ])
    expect(state.outcome).toBe('race')
    expect(getFrontEndRaceRequest(state)).toMatchObject({
      mode: 'single_race',
      circuitName: 'c0',
      raceName: 'a',
      raceFolder: 'racec0r1',
      racerCount: 6,
      localPlayerCount: 1,
      playerRacerNames: ['ALICE'],
    })
  })

  it('moves the circuit with left and right and picks the racer with left and right', () => {
    // Arrange / Act
    const state = play(['down', 'down', 'accept', 'right', 'accept', 'right', 'accept'])

    // Assert
    expect(getFrontEndRaceRequest(state)).toMatchObject({
      circuitName: 'c1',
      raceFolder: 'racec0r0',
      playerRacerNames: ['BOB'],
    })
  })

  it('keeps all the races of the circuit in a circuit race and gives it five opponents', () => {
    // Arrange / Act
    const state = play(['down', 'accept', 'accept', 'accept'])
    const request = getFrontEndRaceRequest(state)

    // Assert
    expect(request?.mode).toBe('circuit')
    expect(request?.racerCount).toBe(6)
    expect(request?.circuitRaces.map((race) => race.raceFolder)).toEqual(['racec0r1', 'racec1r0'])
  })

  it('runs a time trial with the player alone', () => {
    // Arrange / Act
    const state = play(['down', 'down', 'down', 'accept', 'accept', 'accept'])

    // Assert
    expect(getFrontEndRaceRequest(state)).toMatchObject({ mode: 'time_trial', racerCount: 1 })
  })

  it('disables "next" on a closed circuit and refuses to go on', () => {
    // Arrange
    const closed = { ...environment, unlockedCircuitMask: 0b1 }

    // Act
    const state = play(['down', 'accept', 'right', 'down', 'up', 'accept'], closed)

    // Assert
    expect(getScreenIds(state)).toEqual([FrontEndScreen.MAIN_MENU, FrontEndScreen.CIRCUIT_RACE])
  })

  it('returns to the previous screen on back and clears the versus flag', () => {
    // Arrange / Act
    const state = play(['down', 'down', 'accept', 'back'])

    // Assert
    expect(getScreenIds(state)).toEqual([FrontEndScreen.MAIN_MENU])
  })

  it('asks a second racer for the versus race and starts it with two players and no computers', () => {
    // Arrange
    const withController = { ...environment, controllerCount: 1 }

    // Act
    const state = play(
      ['down', 'down', 'down', 'accept', 'accept', 'accept', 'right', 'accept'],
      withController
    )

    // Assert
    expect(getFrontEndRaceRequest(state)).toMatchObject({
      localPlayerCount: 2,
      racerCount: 2,
      playerRacerNames: ['ALICE', 'BOB'],
    })
  })

  it('chooses the options of the game tab', () => {
    // Arrange / Act
    const state = play([
      'down',
      'down',
      'down',
      'down',
      'accept',
      'accept',
      'left',
      'down',
      'right',
    ])

    // Assert
    expect(state.settings.racerCount).toBe(4)
    expect(state.settings.lapCount).toBe(4)
  })

  it('maps the request to the options of the race loader', () => {
    // Arrange
    const state = play(['down', 'down', 'accept', 'accept', 'accept'])
    const request = getFrontEndRaceRequest(state)

    // Act
    const options = request === null ? null : getRaceLoadOptions(request)

    // Assert
    expect(options).toEqual({
      raceFolder: 'RACEC0R1',
      racerCount: 6,
      localPlayerCount: 1,
      multiplayerLapCount: 3,
    })
  })
})

describe('the front end frame', () => {
  it.skipIf(!getIsOriginalJamPresent())(
    'draws the main menu from the original files: backdrop, logo, buttons',
    () => {
      // Arrange
      const files = loadFrontEndResources(openJamArchive(readOriginalJam()))
      const state = createFrontEnd(files, environment)

      // Act
      const frame = getFrontEndFrame(state, files, environment)

      // Assert
      const images = frame.commands.flatMap((command) =>
        command.kind === 'image' ? [command.imageName] : []
      )
      const texts = frame.commands.filter((command) => command.kind === 'text')
      expect(images.slice(0, 2)).toEqual(['backdrp', 'racers'])
      expect(images.slice(2).every((name) => name === 'clear32')).toBe(true)
      expect(texts).toHaveLength(7)
      expect(frame.commands.some((command) => command.kind === 'viewport')).toBe(true)
    }
  )

  it.skipIf(!getIsOriginalJamPresent())(
    'draws every screen the front end can reach without an error',
    () => {
      // Arrange
      const files = loadFrontEndResources(openJamArchive(readOriginalJam()))
      const withController = { ...environment, controllerCount: 1 }
      const paths: readonly (readonly FrontEndInput[])[] = [
        ['down', 'accept'],
        ['down', 'down', 'accept'],
        ['down', 'down', 'down', 'accept'],
        ['down', 'down', 'down', 'down', 'accept'],
        ['down', 'down', 'down', 'down', 'down', 'accept'],
        ['down', 'down', 'accept', 'accept'],
        ['accept'],
        ['down', 'down', 'down', 'down', 'down', 'accept', 'down', 'down', 'accept'],
      ]

      // Act
      const commandCounts = paths.map((inputs) => {
        const state = inputs.reduce(
          (current, input) => stepFrontEnd(current, files, withController, input, 16).state,
          createFrontEnd(files, withController)
        )
        return getFrontEndFrame(state, files, withController).commands.length
      })

      // Assert
      expect(commandCounts.every((count) => count > 0)).toBe(true)
    }
  )
})

import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { loadFrontEndResources } from '../../services/load-front-end-resources/load-front-end-resources.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  FrontEndEnvironment,
  FrontEndInput,
  FrontEndResources,
  FrontEndState,
} from '../../types/front-end.types.ts'
import { createFrontEnd, getFrontEndFrame, stepFrontEnd } from '../front-end/front-end.ts'

const isPresent = getIsOriginalJamPresent()

const environment: FrontEndEnvironment = {
  controllerCount: 0,
  unlockedCircuitMask: 0x7f,
  playerRacerNames: [],
  standingRows: [],
}

describe.skipIf(!isPresent)('the car build screen (0x004736b0)', () => {
  const resources: FrontEndResources | null = isPresent
    ? loadFrontEndResources(openJamArchive(readOriginalJam()))
    : null
  const getResources = (): FrontEndResources => {
    if (resources === null) throw new Error('The original files are missing')
    return resources
  }
  const press = (state: FrontEndState, inputs: readonly FrontEndInput[]): FrontEndState =>
    inputs.reduce(
      (current, input) => stepFrontEnd(current, getResources(), environment, input, 0).state,
      state
    )

  it('opens from the garage page with the chassis alone and a brick in the cursor', () => {
    // Arrange
    const garage = createFrontEnd(getResources(), environment, FrontEndScreen.GARAGE)

    // Act
    const state = press(garage, ['accept'])

    // Assert
    expect(state.screens.at(-1)?.screenId).toBe(FrontEndScreen.CAR_BUILD)
    expect(state.builder?.design.bricks).toHaveLength(1)
  })

  it('draws the garage world with the car of the builder in it', () => {
    // Arrange
    const state = press(createFrontEnd(getResources(), environment, FrontEndScreen.GARAGE), [
      'accept',
    ])

    // Act
    const frame = getFrontEndFrame(state, getResources(), environment)

    // Assert
    const viewport = frame.commands.find((command) => command.kind === 'viewport')
    expect(viewport).toMatchObject({ kind: 'viewport', modelName: 'garage' })
    expect(viewport?.kind === 'viewport' ? viewport.builder?.design.bricks : []).toHaveLength(2)
  })

  it('moves the brick with the arrows, as far as the grid allows', () => {
    // Arrange
    const opened = press(createFrontEnd(getResources(), environment, FrontEndScreen.GARAGE), [
      'accept',
    ])
    const start = opened.builder?.cursor

    // Act
    const moved = press(opened, ['up', 'up', 'left'])
    const edge = press(
      opened,
      Array.from({ length: 12 }, (): FrontEndInput => 'up')
    )

    // Assert
    expect(moved.builder?.cursor.x).toBe((start?.x ?? 0) - 2)
    expect(moved.builder?.cursor.y).toBe((start?.y ?? 0) - 1)
    expect(edge.builder?.cursor.x).toBe(0)
  })

  it('keeps the car when the screen is left, for the race', () => {
    // Arrange
    const opened = press(createFrontEnd(getResources(), environment, FrontEndScreen.GARAGE), [
      'accept',
    ])

    // Act
    const left = press(opened, ['back'])

    // Assert
    expect(left.screens.at(-1)?.screenId).toBe(FrontEndScreen.GARAGE)
    expect(left.settings.playerCar?.design?.bricks).toHaveLength(1)
    expect(left.settings.playerCar?.record.chassisName).toBe('ddchas0')
    expect(left.settings.playerCar?.record.designBytes.slice(0, 2)).toEqual([0, 1])
  })

  it('changes the set, which starts another car on its chassis', () => {
    // Arrange
    const opened = press(createFrontEnd(getResources(), environment, FrontEndScreen.GARAGE), [
      'accept',
    ])

    // Act
    const next = press(opened, ['next_set'])

    // Assert
    expect(next.builder?.setIndex).toBe(1)
    expect(next.builder?.design.bricks[0]?.piece.name).toBe('DBCHAS0')
  })
})

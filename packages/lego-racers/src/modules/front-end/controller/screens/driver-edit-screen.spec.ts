import { createRandomTable } from '../../../random-table/index.ts'
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
  randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
  isEveryPartUnlocked: true,
  playerRacerNames: [],
  standingRows: [],
}

describe.skipIf(!isPresent)('the driver editor screen (0x0047ce30)', () => {
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
  const open = (): FrontEndState =>
    press(createFrontEnd(getResources(), environment, FrontEndScreen.GARAGE), ['down', 'accept'])

  it('opens from the garage page on the racer of DEFAULT.LRS, the hat chooser first', () => {
    // Arrange / Act
    const state = open()

    // Assert
    expect(state.screens.at(-1)?.screenId).toBe(FrontEndScreen.EDIT_DRIVER)
    expect(state.driver?.hat.indices).toHaveLength(36)
    expect(state.driver?.face.indices).toHaveLength(30)
  })

  it('draws the platform with the driver of the choosers', () => {
    // Arrange
    const state = press(open(), ['right'])

    // Act
    const frame = getFrontEndFrame(state, getResources(), environment)

    // Assert
    const viewport = frame.commands.find((command) => command.kind === 'viewport')
    expect(viewport).toMatchObject({ kind: 'viewport', modelName: 'cbset' })
    expect(viewport?.kind === 'viewport' ? viewport.driver?.partBytes : []).toHaveLength(5)
  })

  it('changes the chooser the focus is on and puts the parts into the racer on "next"', () => {
    // Arrange
    const opened = open()
    const startHat = opened.driver?.hat.position ?? 0

    // Act
    const changed = press(opened, ['right', 'down', 'left', 'left'])
    const applied = press(changed, ['down', 'down', 'down', 'down', 'accept'])

    // Assert
    expect(changed.driver?.hat.position).toBe((startHat + 1) % 36)
    expect(applied.screens.at(-1)?.screenId).toBe(FrontEndScreen.GARAGE)
    const hatByte = applied.settings.playerCar?.record.colorBytes[1]
    expect(hatByte).toBe(changed.driver?.hat.indices[changed.driver.hat.position])
  })

  it('mixes the driver and advances the shared random position by four', () => {
    // Arrange
    const opened = open()

    // Act
    const mixed = press(opened, ['down', 'down', 'down', 'down', 'accept'])

    // Assert
    expect(mixed.settings.randomPosition).toBe(4)
  })

  it('leaves without changes on back', () => {
    // Arrange
    const changed = press(open(), ['right', 'back'])

    // Assert
    expect(changed.settings.playerCar).toBeNull()
    expect(changed.screens.at(-1)?.screenId).toBe(FrontEndScreen.GARAGE)
  })
})

import { createRandomTable } from '../../../random-table/index.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parseSaveFile, serializeSaveFile } from '../../../save-data/index.ts'
import type { SaveFile } from '../../../save-data/index.ts'
import { loadFrontEndResources } from '../../services/load-front-end-resources/load-front-end-resources.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  FrontEndEnvironment,
  FrontEndInput,
  FrontEndMemory,
  FrontEndResources,
  FrontEndState,
} from '../../types/front-end.types.ts'
import { createFrontEnd, stepFrontEnd } from '../front-end/front-end.ts'

const isPresent = getIsOriginalJamPresent()

const environment: FrontEndEnvironment = {
  controllerCount: 0,
  unlockedCircuitMask: 0x7f,
  randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
  isEveryPartUnlocked: true,
  playerRacerNames: [],
  standingRows: [],
}

describe.skipIf(!isPresent)(
  'the profile: garage, new racer, options and parts on a save file',
  () => {
    const archive = isPresent ? openJamArchive(readOriginalJam()) : null
    const resources: FrontEndResources | null =
      archive === null ? null : loadFrontEndResources(archive)
    const getResources = (): FrontEndResources => {
      if (resources === null) throw new Error('The original files are missing')
      return resources
    }
    const getDefaultSave = (): SaveFile => {
      if (archive === null) throw new Error('The original files are missing')
      return parseSaveFile(archive.readFile('MENUDATA\\DEFAULT.LRS'))
    }
    const press = (state: FrontEndState, inputs: readonly FrontEndInput[]): FrontEndState =>
      inputs.reduce(
        (current, input) => stepFrontEnd(current, getResources(), environment, input, 0).state,
        state
      )
    const open = (
      screenId: number,
      saveFile: SaveFile | null = getDefaultSave()
    ): FrontEndState => {
      const memory: FrontEndMemory = { playerCar: null, randomPosition: 0, saveFile, racerIndex: 0 }
      return createFrontEnd(getResources(), environment, screenId, memory)
    }

    it('plays the first racer of the save, with its options', () => {
      // Arrange
      const save = getDefaultSave()

      // Act
      const state = open(FrontEndScreen.GARAGE, save)

      // Assert
      expect(state.settings.playerCar?.record.name).toBe(save.racers[0]?.name)
      expect(state.settings.racerCount).toBe(save.profile.racerCountOption)
      expect(state.settings.lapCount).toBe(save.profile.optionBytes[6])
    })

    it('chooses another racer of the save with left and right', () => {
      // Arrange
      const state = open(FrontEndScreen.GARAGE)

      // Act
      const next = press(state, ['right'])

      // Assert
      expect(next.settings.racerIndex).toBe(1)
      expect(next.settings.playerCar?.record.name).toBe(getDefaultSave().racers[1]?.name)
    })

    it('makes a new racer with a typed name and plays him', () => {
      // Arrange
      const state = open(FrontEndScreen.GARAGE)

      // Act
      const typed = press(state, ['down', 'down', 'accept', 'up', 'up', 'right', 'up', 'up', 'up'])
      const made = press(typed, ['accept'])

      // Assert
      expect(typed.screens.at(-1)?.screenId).toBe(FrontEndScreen.NEW_RACER)
      expect(typed.settings.saveFile).toBe(state.settings.saveFile)
      expect(made.screens.at(-1)?.screenId).toBe(FrontEndScreen.GARAGE)
      expect(made.settings.saveFile?.racers).toHaveLength(5)
      expect(made.settings.saveFile?.racers.at(-1)?.name).toBe('BD')
      expect(made.settings.racerIndex).toBe(4)
    })

    it('refuses an empty name', () => {
      // Arrange
      const state = press(open(FrontEndScreen.GARAGE), ['down', 'down', 'accept'])

      // Act
      const refused = press(state, ['accept'])

      // Assert
      expect(refused.screens.at(-1)?.screenId).toBe(FrontEndScreen.NEW_RACER)
    })

    it('deletes the racer who plays, down to the last one', () => {
      // Arrange
      const state = open(FrontEndScreen.GARAGE)

      // Act
      const deleted = press(state, ['down', 'down', 'down', 'accept'])

      // Assert
      expect(deleted.settings.saveFile?.racers).toHaveLength(3)
    })

    it('writes the car the player built into his record and keeps the file readable', () => {
      // Arrange
      const state = open(FrontEndScreen.GARAGE)

      // Act
      const built = press(state, ['accept', 'back'])
      const bytes = serializeSaveFile(built.settings.saveFile ?? getDefaultSave())
      const reread = parseSaveFile(bytes)

      // Assert
      expect(reread.racers[0]?.designBytes.slice(0, 2)).toEqual([0, 1])
      expect(reread.racers[0]?.name).toBe(getDefaultSave().racers[0]?.name)
    })

    it('offers the driver parts the profile has earned, not all of them', () => {
      // Arrange
      const state = open(FrontEndScreen.GARAGE)

      // Act
      const editor = press(state, ['down', 'accept'])

      // Assert
      expect(editor.driver?.hat.indices.length).toBeLessThan(36)
      expect(editor.driver?.hat.indices.length).toBeGreaterThan(0)
    })

    it('offers every part without a save', () => {
      // Arrange
      const state = open(FrontEndScreen.GARAGE, null)

      // Act
      const editor = press(state, ['down', 'accept'])

      // Assert
      expect(editor.driver?.hat.indices).toHaveLength(36)
    })

    it('keeps the options in the profile', () => {
      // Arrange
      const state = open(FrontEndScreen.OPTIONS)

      // Act
      const changed = press(state, ['accept', 'left', 'down', 'right'])

      // Assert
      expect(changed.settings.saveFile?.profile.racerCountOption).toBe(
        getDefaultSave().profile.racerCountOption - 1
      )
      expect(changed.settings.saveFile?.profile.optionBytes[6]).toBe(
        (getDefaultSave().profile.optionBytes[6] ?? 0) + 1
      )
    })
  }
)

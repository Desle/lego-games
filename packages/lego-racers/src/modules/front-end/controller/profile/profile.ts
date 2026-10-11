import { loadCarDesign } from '../../../car-builder/index.ts'
import type { SavedCar } from '../../../car-builder/index.ts'
import {
  getCircuitUnlockFlags,
  getProfileWithRaceOptions,
  getSaveWithRacer,
  LAP_OPTION_BYTE_INDEX,
} from '../../../save-data/index.ts'
import type { SaveFile, SaveRacer } from '../../../save-data/index.ts'
import type {
  FrontEndMemory,
  FrontEndResources,
  FrontEndSettings,
} from '../../types/front-end.types.ts'
import type { ScreenRuntime } from '../../types/front-end-screen.types.ts'

// The racer a record describes with his design loaded onto the grid (0x0042dcb0 loads it the same way).
export const getSavedCarOfRacer = (resources: FrontEndResources, racer: SaveRacer): SavedCar =>
  Object.freeze({
    record: racer,
    design: loadCarDesign(
      Uint8Array.from(racer.designBytes),
      resources.getBuilderCatalog().database
    ),
  })

// The settings the menus start with: the memory of the last visit, and with a save the options of its profile
// (FrontEnd_ApplyProfileOptions 0x0042e1f0: opponents from the racer count option, laps from option byte 6) and the car of
// its current racer (FrontEnd_BuildBuiltCarSlot 0x0042dcb0).
export const getSettingsWithMemory = (
  resources: FrontEndResources,
  base: FrontEndSettings,
  memory: FrontEndMemory
): FrontEndSettings => {
  const { saveFile } = memory
  if (saveFile === null) return { ...base, ...memory }
  const racerIndex = Math.min(memory.racerIndex, saveFile.racers.length - 1)
  const racer = saveFile.racers[racerIndex]
  return {
    ...base,
    ...memory,
    racerIndex,
    racerCount: saveFile.profile.racerCountOption,
    lapCount: saveFile.profile.optionBytes[LAP_OPTION_BYTE_INDEX] ?? base.lapCount,
    playerCar:
      memory.playerCar ?? (racer === undefined ? null : getSavedCarOfRacer(resources, racer)),
  }
}

// The player's car changed (the builder, the driver editor): with a save the current racer's record takes it.
export const getSettingsWithPlayerCar = (
  settings: FrontEndSettings,
  playerCar: SavedCar
): FrontEndSettings => ({
  ...settings,
  playerCar,
  saveFile:
    settings.saveFile === null
      ? null
      : getSaveWithRacer(settings.saveFile, settings.racerIndex, playerCar.record),
})

// Another racer of the save becomes the player.
export const getSettingsWithRacer = (
  resources: FrontEndResources,
  settings: FrontEndSettings,
  saveFile: SaveFile,
  racerIndex: number
): FrontEndSettings => {
  const racer = saveFile.racers[racerIndex]
  return {
    ...settings,
    saveFile,
    racerIndex,
    playerCar: racer === undefined ? settings.playerCar : getSavedCarOfRacer(resources, racer),
  }
}

// The options screen changed the opponents or the laps: with a save the profile keeps them (0x004833e0).
export const getSettingsWithRaceOptions = (settings: FrontEndSettings): FrontEndSettings =>
  settings.saveFile === null
    ? settings
    : {
        ...settings,
        saveFile: {
          ...settings.saveFile,
          profile: getProfileWithRaceOptions(
            settings.saveFile.profile,
            settings.racerCount,
            settings.lapCount
          ),
        },
      }

// FrontEnd_Initialize loads the profile's circuit unlocks (0x0042f1f0); without a save the front end's own hook says.
export const getUnlockedCircuitMask = (
  runtime: Pick<ScreenRuntime, 'settings' | 'environment'>
): number =>
  runtime.settings.saveFile === null
    ? runtime.environment.unlockedCircuitMask
    : getCircuitUnlockFlags(runtime.settings.saveFile.profile)

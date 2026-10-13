import type { LDrawModelFolders } from '@lego-games/ldraw/files'
import {
  LDRAW_CHASSIS_FOLDER,
  LDRAW_DRIVERS_FOLDER,
  LDRAW_POWER_UPS_FOLDER,
} from '../ldraw-models/ldraw-models-route.ts'
import type { LDrawModelIndex } from '../ldraw-models/ldraw-model-index.types.ts'

const ROOT_FOLDER = ''

const getStem = (name: string): string => name.replace(/\.[^.]+$/, '')

const getEntries = (
  folders: LDrawModelFolders,
  folder: string,
  getKey: (stem: string) => string
): Readonly<Record<string, string>> =>
  Object.freeze(
    Object.fromEntries(
      (folders[folder] ?? [])
        .filter((name) => !name.startsWith('_'))
        .toSorted((first, second) => second.localeCompare(first))
        .map((name) => [getKey(getStem(name)), folder === ROOT_FOLDER ? name : `${folder}/${name}`])
    )
  )

// The index of a models folder (on the dev server): the car models in the folder itself, the chassis recipes in `chassis/`, the
// drivers in `drivers/`, the power-up objects in `powerups/`. A `.ldr` wins over a `.mpd` of the same name. Files that begin with an underscore are notes and tests, not models.
export const createLDrawModelIndex = (folders: LDrawModelFolders): LDrawModelIndex =>
  Object.freeze({
    cars: getEntries(folders, ROOT_FOLDER, (stem) => stem.toUpperCase()),
    chassis: getEntries(folders, LDRAW_CHASSIS_FOLDER, (stem) => stem.toLowerCase()),
    drivers: getEntries(folders, LDRAW_DRIVERS_FOLDER, (stem) => stem.toUpperCase()),
    powerUps: getEntries(folders, LDRAW_POWER_UPS_FOLDER, (stem) => stem.toUpperCase()),
  })

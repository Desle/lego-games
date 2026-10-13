import { readdirSync, existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { LDRAW_CHASSIS_FOLDER, LDRAW_MODEL_EXTENSIONS } from '../ldraw-models/ldraw-models-route.ts'
import type { LDrawModelIndex } from '../ldraw-models/ldraw-model-index.types.ts'

const getModelFiles = (folder: string): readonly string[] =>
  existsSync(folder)
    ? readdirSync(folder).filter((name) =>
        LDRAW_MODEL_EXTENSIONS.includes(extname(name).toLowerCase())
      )
    : []

// The index of a models folder (read on the dev server): the car models in the folder itself, the chassis recipes in `chassis/`. A
// `.ldr` wins over a `.mpd` of the same name. Files that begin with an underscore are notes and tests, not models.
export const readLDrawModelIndex = (root: string): LDrawModelIndex => {
  const getEntries = (folder: string, subfolder: string, getKey: (name: string) => string) =>
    Object.fromEntries(
      getModelFiles(folder)
        .filter((name) => !name.startsWith('_'))
        .sort((first, second) => second.localeCompare(first))
        .map((name) => [getKey(basename(name, extname(name))), join(subfolder, name)])
    )
  return Object.freeze({
    cars: Object.freeze(getEntries(root, '', (name) => name.toUpperCase())),
    chassis: Object.freeze(
      getEntries(join(root, LDRAW_CHASSIS_FOLDER), LDRAW_CHASSIS_FOLDER, (name) =>
        name.toLowerCase()
      )
    ),
  })
}

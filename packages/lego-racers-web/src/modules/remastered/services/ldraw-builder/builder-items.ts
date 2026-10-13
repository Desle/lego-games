import { CHAMPION_CAR_CODES, CHASSIS_NAMES } from '../ldraw-racer-model/known-racer-models.ts'
import { BuilderItemKind } from './ldraw-builder.types.ts'
import type { BuilderItem, StartFileGroup } from './ldraw-builder.types.ts'

const CHASSIS_RECIPE_FILE = /^chassis\/[^/]+\.ldr$/i
const CAR_FILE = /^([^/]+)\.(ldr|mpd)$/i

export const getChassisItemId = (name: string): string => `chassis/${name.toLowerCase()}`

// The queue: the 12 chassis first (the cars stand on them), then the 20 champions' cars, each on the chassis its champion drives.
export const getBuilderItems = (
  championChassis: ReadonlyMap<string, string>
): readonly BuilderItem[] =>
  Object.freeze([
    ...CHASSIS_NAMES.map((name) =>
      Object.freeze({
        id: getChassisItemId(name),
        kind: BuilderItemKind.CHASSIS,
        name,
        chassisName: name,
      })
    ),
    ...CHAMPION_CAR_CODES.map((code) =>
      Object.freeze({
        id: code,
        kind: BuilderItemKind.CAR,
        name: code,
        chassisName: (championChassis.get(code) ?? '').toLowerCase(),
      })
    ),
  ])

// The models folder's file an item is saved to: the file already there (whatever its case), else `chassis/<NAME>.ldr` or `<CODE>.ldr`.
// Null for an id that is not one of the 32 items.
export const getBuilderItemFile = (
  itemId: string,
  existingFiles: readonly string[]
): string | null => {
  const chassisName = CHASSIS_NAMES.find((name) => getChassisItemId(name) === itemId)
  const isCar = CHAMPION_CAR_CODES.includes(itemId)
  if (chassisName === undefined && !isCar) return null
  const wanted =
    chassisName === undefined ? `${itemId}.ldr` : `chassis/${chassisName.toUpperCase()}.ldr`
  return existingFiles.find((file) => file.toLowerCase() === wanted.toLowerCase()) ?? wanted
}

// The item after the given one that is not done yet, from the start again when none follows; null when all are done.
export const getNextBuilderItem = (
  items: readonly BuilderItem[],
  currentId: string,
  done: readonly string[]
): BuilderItem | null => {
  const start = items.findIndex((item) => item.id === currentId)
  const ordered = [...items.slice(start + 1), ...items.slice(0, start + 1)]
  return ordered.find((item) => !done.includes(item.id)) ?? null
}

const getStem = (path: string): string =>
  (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '').toLowerCase()

// The models folder's files an item may start from, grouped: for a car, every champion's car (its parts are copied in, a chassis
// recipe it places made its own) and every chassis recipe; for a chassis, its own recipe; then the item's own drafts and backups.
export const getStartFiles = (
  item: BuilderItem,
  paths: readonly string[]
): readonly StartFileGroup[] => {
  const name = item.name.toLowerCase()
  const isCar = item.kind === BuilderItemKind.CAR
  const carCodes = new Set(CHAMPION_CAR_CODES.map((code) => code.toLowerCase()))
  const cars = isCar
    ? paths.filter((path) => {
        const match = CAR_FILE.exec(path)
        return match?.[1] !== undefined && carCodes.has(match[1].toLowerCase())
      })
    : []
  const chassis = paths.filter(
    (path) => CHASSIS_RECIPE_FILE.test(path) && (isCar || getStem(path) === name)
  )
  const drafts = paths.filter(
    (path) => getStem(path).startsWith(name) && !cars.includes(path) && !chassis.includes(path)
  )
  return Object.freeze(
    [
      { label: 'Cars', files: cars },
      { label: 'Chassis', files: chassis },
      { label: 'Backups/drafts', files: drafts },
    ]
      .filter((group) => group.files.length > 0)
      .map((group) => Object.freeze({ label: group.label, files: Object.freeze(group.files) }))
  )
}

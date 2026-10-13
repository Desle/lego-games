import {
  CHAMPION_CAR_CODES,
  CHASSIS_NAMES,
  DRIVER_NAMES,
} from '../ldraw-racer-model/known-racer-models.ts'
import { BuilderItemKind } from './ldraw-builder.types.ts'
import type { BuilderItem, StartFileGroup } from './ldraw-builder.types.ts'

const CHASSIS_RECIPE_FILE = /^chassis\/[^/]+\.ldr$/i
const CAR_FILE = /^([^/]+)\.(ldr|mpd)$/i
const DRIVER_FILE = /^drivers\/[^/]+\.ldr$/i
const DRAFTS_FOLDER = 'drafts/'

export const getChassisItemId = (name: string): string => `chassis/${name.toLowerCase()}`

const getDriverItemId = (name: string): string => `drivers/${name.toUpperCase()}`

// The queue: the 12 chassis first (the cars stand on them), then the 20 champions' cars, each on the chassis its champion drives, then
// the 24 drivers.
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
    ...DRIVER_NAMES.map((name) =>
      Object.freeze({
        id: getDriverItemId(name),
        kind: BuilderItemKind.DRIVER,
        name,
        chassisName: '',
      })
    ),
  ])

const getWantedFile = (itemId: string): string | null => {
  const chassisName = CHASSIS_NAMES.find((name) => getChassisItemId(name) === itemId)
  if (chassisName !== undefined) return `chassis/${chassisName.toUpperCase()}.ldr`
  if (CHAMPION_CAR_CODES.includes(itemId)) return `${itemId}.ldr`
  return DRIVER_NAMES.some((name) => getDriverItemId(name) === itemId) ? `${itemId}.ldr` : null
}

// The models folder's file an item is saved to: the file already there (whatever its case), else `chassis/<NAME>.ldr`, `<CODE>.ldr`
// or `drivers/<NAME>.ldr`. Null for an id that is not one of the items.
export const getBuilderItemFile = (
  itemId: string,
  existingFiles: readonly string[]
): string | null => {
  const wanted = getWantedFile(itemId)
  if (wanted === null) return null
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
// recipe it places made its own) and every chassis recipe; for a chassis, its own recipe; for a driver, every driver; then the item's
// own drafts and backups (a driver's only in `drafts/`, by `<NAME>-`: a short name is the start of many others).
export const getStartFiles = (
  item: BuilderItem,
  paths: readonly string[]
): readonly StartFileGroup[] => {
  const name = item.name.toLowerCase()
  const isCar = item.kind === BuilderItemKind.CAR
  const isDriver = item.kind === BuilderItemKind.DRIVER
  const carCodes = new Set(CHAMPION_CAR_CODES.map((code) => code.toLowerCase()))
  const cars = isCar
    ? paths.filter((path) => {
        const match = CAR_FILE.exec(path)
        return match?.[1] !== undefined && carCodes.has(match[1].toLowerCase())
      })
    : []
  const chassis = isDriver
    ? []
    : paths.filter((path) => CHASSIS_RECIPE_FILE.test(path) && (isCar || getStem(path) === name))
  const drivers = isDriver ? paths.filter((path) => DRIVER_FILE.test(path)) : []
  const getIsDraft = (path: string) =>
    isDriver
      ? path.toLowerCase().startsWith(DRAFTS_FOLDER) &&
        (getStem(path) === name || getStem(path).startsWith(`${name}-`))
      : getStem(path).startsWith(name) && !cars.includes(path) && !chassis.includes(path)
  const drafts = paths.filter(getIsDraft)
  return Object.freeze(
    [
      { label: 'Cars', files: cars },
      { label: 'Chassis', files: chassis },
      { label: 'Drivers', files: drivers },
      { label: 'Backups/drafts', files: drafts },
    ]
      .filter((group) => group.files.length > 0)
      .map((group) => Object.freeze({ label: group.label, files: Object.freeze(group.files) }))
  )
}

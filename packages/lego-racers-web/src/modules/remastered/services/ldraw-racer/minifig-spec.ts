import { parseBodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import type { BodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import { parseDriverDatabase } from '@lego-games/lego-racers/driver-database'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadBuiltDriverScene } from '@lego-games/lego-racers/racer-appearance'
import { LDRAW_HATS } from './ldraw-minifig-hats.ts'
import { readMinifigSurfaces } from './minifig-surfaces.ts'
import type { MinifigSpec } from './minifig-spec.types.ts'

const CATALOG_PATH = 'MENUDATA\\PARTDB\\BODYPART.PCB'
const DRIVER_DATABASE_PATH = 'GAMEDATA\\COMMON\\DRIVERS.DDB'
const PART_BYTE_COUNT = 5
const HOOK_TORSO_TYPE = 1
const PEG_LEGS_TYPE = 1

const catalogs = new WeakMap<JamArchive, BodyPartCatalog>()

const getCatalog = (archive: JamArchive): BodyPartCatalog => {
  const known = catalogs.get(archive)
  if (known !== undefined) return known
  const catalog = parseBodyPartCatalog(archive.readFile(CATALOG_PATH))
  catalogs.set(archive, catalog)
  return catalog
}

// The five part bytes of a driver the original draws as a fixed model: its record in the driver database lists them (hat, face,
// torso, legs, expression; the port calls them `unreadBytes`, the race does not read them, the menus do). Null for a name it does not hold.
export const getDriverPartBytes = (
  archive: JamArchive,
  modelName: string
): readonly number[] | null => {
  const driver = parseDriverDatabase(archive.readFile(DRIVER_DATABASE_PATH)).drivers.find(
    (candidate) => candidate.modelName.toLowerCase() === modelName.toLowerCase()
  )
  return driver?.unreadBytes.length === PART_BYTE_COUNT ? driver.unreadBytes : null
}

// The parts of a driver of these part bytes: the catalogue says the hat and whether the torso and legs are the hook and peg ones, and
// the figure builder's model of the bytes says the colours and the pictures.
export const createMinifigSpec = (
  archive: JamArchive,
  partBytes: readonly number[]
): MinifigSpec => {
  const catalog = getCatalog(archive)
  return Object.freeze({
    partBytes,
    hat: LDRAW_HATS[partBytes[0] ?? 0] ?? null,
    isHookTorso: catalog.torsos.entries[partBytes[2] ?? 0]?.type === HOOK_TORSO_TYPE,
    isPegLegs: catalog.legs.entries[partBytes[3] ?? 0]?.type === PEG_LEGS_TYPE,
    surfaces: readMinifigSurfaces(loadBuiltDriverScene(archive, partBytes)),
  })
}

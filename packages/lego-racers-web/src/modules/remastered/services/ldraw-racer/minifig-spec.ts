import { parseBodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import type { BodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import { parseDriverDatabase } from '@lego-games/lego-racers/driver-database'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadBuiltDriverScene } from '@lego-games/lego-racers/racer-appearance'
import { LDRAW_FACES, LDRAW_HATS, LDRAW_LEGS, LDRAW_TORSOS } from './ldraw-minifig-parts.ts'
import { readMinifigSurfaces } from './minifig-surfaces.ts'
import type { MinifigSpec } from './minifig-spec.types.ts'

const CATALOG_PATH = 'MENUDATA\\PARTDB\\BODYPART.PCB'
const DRIVER_DATABASE_PATH = 'GAMEDATA\\COMMON\\DRIVERS.DDB'
const PART_BYTE_COUNT = 5
const HOOK_TORSO_TYPE = 1
// A hat that is a whole helmet takes the face out of the model; the model without a hat has the face, the torso and the legs.
const NO_HAT = 0

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

// The parts of a driver of these part bytes: the tables of `ldraw-minifig-parts` say the library part of each hat, face, torso and pair of
// legs, the catalogue whether the torso is the hook one, and the figure builder's model of the bytes the colours and the pictures of
// what has no library part.
export const createMinifigSpec = (
  archive: JamArchive,
  partBytes: readonly number[]
): MinifigSpec => {
  const catalog = getCatalog(archive)
  return Object.freeze({
    partBytes,
    hats: LDRAW_HATS[partBytes[0] ?? 0]?.hats ?? [],
    face: LDRAW_FACES[partBytes[1] ?? 0] ?? null,
    torso: LDRAW_TORSOS[partBytes[2] ?? 0]?.print ?? null,
    legs: LDRAW_LEGS[partBytes[3] ?? 0] ?? null,
    isHookTorso: catalog.torsos.entries[partBytes[2] ?? 0]?.type === HOOK_TORSO_TYPE,
    surfaces: readMinifigSurfaces(loadBuiltDriverScene(archive, [NO_HAT, ...partBytes.slice(1)])),
  })
}

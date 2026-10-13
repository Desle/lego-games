import { parseDriverDatabase } from '@lego-games/lego-racers/driver-database'
import { parseBodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import type { BodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import { getLDrawModelIndex } from '../ldraw-models/ldraw-model-client.ts'
import { findDriverRecord } from './driver-file.ts'
import type { DriverRecordKey } from './driver-file.types.ts'
import type { DriverSource, ModelFigure } from './driver-records.types.ts'
import { getCatalogueDriverParts } from './driver-assembly.ts'
import { getFigurePartBytes, getModelPictureNames } from './figure-picture-parts.ts'

const DRIVER_DATABASE_PATH = 'GAMEDATA\\COMMON\\DRIVERS.DDB'
const CATALOG_PATH = 'MENUDATA\\PARTDB\\BODYPART.PCB'
const FACE_BYTE_INDEX = 1

const recordKeys = new WeakMap<JamArchive, readonly DriverRecordKey[]>()
const catalogs = new WeakMap<JamArchive, BodyPartCatalog>()

const getCatalog = (archive: JamArchive): BodyPartCatalog => {
  const known = catalogs.get(archive)
  if (known !== undefined) return known
  const catalog = parseBodyPartCatalog(archive.readFile(CATALOG_PATH))
  catalogs.set(archive, catalog)
  return catalog
}

const getDriverRecordKeys = (archive: JamArchive): readonly DriverRecordKey[] => {
  const known = recordKeys.get(archive)
  if (known !== undefined) return known
  const keys = parseDriverDatabase(archive.readFile(DRIVER_DATABASE_PATH)).drivers.map(
    (driver): DriverRecordKey => ({
      name: driver.name,
      modelName: driver.modelName,
      partBytes: driver.unreadBytes,
    })
  )
  recordKeys.set(archive, keys)
  return keys
}

// A champion's face is his alone: the driver whose record has the face of these bytes, when exactly one has it.
const findFaceRecord = (
  drivers: readonly DriverRecordKey[],
  partBytes: readonly number[]
): DriverRecordKey | null => {
  const matching = drivers.filter(
    (driver) => driver.partBytes[FACE_BYTE_INDEX] === partBytes[FACE_BYTE_INDEX]
  )
  return matching.length === 1 ? (matching[0] ?? null) : null
}

// The record and part bytes of a figure a world draws with a model of its own (a cinema's): its parts read off its pictures, the
// champion of its face when it wears one.
const getModelFigure = (archive: JamArchive, model: ModelScene): ModelFigure | null => {
  const partBytes = getFigurePartBytes(getCatalog(archive), getModelPictureNames(model))
  if (partBytes === null) return null
  const record = findFaceRecord(getDriverRecordKeys(archive), partBytes)
  return record === null
    ? { name: null, partBytes }
    : { name: record.name.toUpperCase(), partBytes: record.partBytes }
}

// Where the parts of the driver a request names come from: his file in the models folder (`drivers/<NAME>.ldr`, by his driver database
// record), else the catalogue pieces his part bytes (the record's, or the request's for a figure the player built) choose. A figure
// of a model of its own that no record names (a cinema's) is known by its pictures. Null when a piece has no mapping (the original's
// driver is drawn then).
export const findDriverSource = (
  archive: JamArchive,
  modelName: string | null,
  partBytes: readonly number[] | null,
  model: ModelScene | null
): DriverSource | null => {
  const record = findDriverRecord(getDriverRecordKeys(archive), modelName, partBytes)
  const figure =
    record === null && partBytes === null && model !== null ? getModelFigure(archive, model) : null
  const name = record?.name ?? figure?.name ?? null
  const file = name === null ? undefined : getLDrawModelIndex().drivers[name]
  const bytes = record?.partBytes ?? figure?.partBytes ?? partBytes
  if (bytes === null) return null
  if (file !== undefined) return Object.freeze({ kind: 'file', file, partBytes: bytes })
  const parts = getCatalogueDriverParts(bytes)
  return parts === null ? null : Object.freeze({ kind: 'catalogue', parts, partBytes: bytes })
}

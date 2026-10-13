import { parseDriverDatabase } from '@lego-games/lego-racers/driver-database'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getLDrawModelIndex } from '../ldraw-models/ldraw-model-client.ts'
import { findDriverRecord } from './driver-file.ts'
import type { DriverRecordKey } from './driver-file.types.ts'
import type { DriverSource } from './driver-records.types.ts'
import { getCatalogueDriverParts } from './driver-assembly.ts'

const DRIVER_DATABASE_PATH = 'GAMEDATA\\COMMON\\DRIVERS.DDB'

const recordKeys = new WeakMap<JamArchive, readonly DriverRecordKey[]>()

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

// Where the parts of the driver a request names come from: his file in the models folder (`drivers/<NAME>.ldr`, by his driver database
// record), else the catalogue pieces his part bytes (the record's, or the request's for a figure the player built) choose. Null when a
// piece has no mapping (the original's driver is drawn then).
export const findDriverSource = (
  archive: JamArchive,
  modelName: string | null,
  partBytes: readonly number[] | null
): DriverSource | null => {
  const record = findDriverRecord(getDriverRecordKeys(archive), modelName, partBytes)
  const file = record === null ? undefined : getLDrawModelIndex().drivers[record.name]
  const bytes = record?.partBytes ?? partBytes
  if (bytes === null) return null
  if (file !== undefined) return Object.freeze({ kind: 'file', file, partBytes: bytes })
  const parts = getCatalogueDriverParts(bytes)
  return parts === null ? null : Object.freeze({ kind: 'catalogue', parts, partBytes: bytes })
}

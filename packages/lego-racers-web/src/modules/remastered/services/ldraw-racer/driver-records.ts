import { parseDriverDatabase } from '@lego-games/lego-racers/driver-database'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getLDrawModelIndex } from '../ldraw-models/ldraw-model-client.ts'
import { findDriverRecord } from './driver-file.ts'
import type { DriverRecordKey } from './driver-file.types.ts'
import type { DriverFileSource } from './driver-records.types.ts'

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

// The models folder's file of the driver a request names (`drivers/<NAME>.ldr`, by its driver database record) and the record's part
// bytes; null when the folder has no file for him (the original's driver is drawn then).
export const findDriverFile = (
  archive: JamArchive,
  modelName: string | null,
  partBytes: readonly number[] | null
): DriverFileSource | null => {
  const record = findDriverRecord(getDriverRecordKeys(archive), modelName, partBytes)
  const file = record === null ? undefined : getLDrawModelIndex().drivers[record.name]
  return record === null || file === undefined
    ? null
    : Object.freeze({ file, partBytes: record.partBytes })
}

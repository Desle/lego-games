import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseDriverDatabase } from '@lego-games/lego-racers/driver-database'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { createMinifigSpec } from '../ldraw-racer/minifig-spec.ts'
import { getDriverExportParts, getDriverLDrawText } from './driver-ldraw-export.ts'
import type { DriverExportOutcome } from './driver-export.types.ts'

const DEFAULT_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const DRIVER_DATABASE_PATH = 'GAMEDATA\\COMMON\\DRIVERS.DDB'
const PART_BYTE_COUNT = 5
const DRIVERS_FOLDER = 'drivers'

// eslint-disable-next-line no-restricted-properties -- a developer tool finds the models folder from the shell, as vite.config.ts does
const environment = process.env
const modelsRoot = environment['LEGO_LDRAW_MODELS_ROOT'] ?? join(homedir(), 'ldraw-models')
const jamPath = environment['LEGO_JAM_PATH'] ?? DEFAULT_JAM_PATH

// Every driver of the driver database as `drivers/<NAME>.ldr`; a file that is already there is the user's and stays as it is.
const run = () => {
  const archive = openJamArchive(new Uint8Array(readFileSync(jamPath)))
  const folder = join(modelsRoot, DRIVERS_FOLDER)
  mkdirSync(folder, { recursive: true })
  const drivers = parseDriverDatabase(archive.readFile(DRIVER_DATABASE_PATH)).drivers
  const outcomes = drivers
    .filter((driver) => driver.unreadBytes.length === PART_BYTE_COUNT)
    .map((driver): DriverExportOutcome => {
      const name = driver.name.toUpperCase()
      const fileName = `${name}.ldr`
      const path = join(folder, fileName)
      const spec = createMinifigSpec(archive, driver.unreadBytes)
      const partCount = getDriverExportParts(spec).length
      if (existsSync(path)) return { fileName, partCount, isWritten: false }
      writeFileSync(path, getDriverLDrawText(name, spec), { flag: 'wx' })
      return { fileName, partCount, isWritten: true }
    })
  for (const outcome of outcomes) {
    console.log(
      `${outcome.isWritten ? 'wrote  ' : 'skipped'} ${DRIVERS_FOLDER}/${outcome.fileName} (${String(outcome.partCount)} parts)${outcome.isWritten ? '' : ': already there'}`
    )
  }
  console.log(`${String(outcomes.length)} drivers, in ${folder}`)
}

run()

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  BRICK_DATABASE_PATH,
  findBrickPieceByName,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, BrickPiece } from '@lego-games/lego-racers/car-builder'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { readRacerDatabases } from '@lego-games/lego-racers/race'
import { LDRAW_BRICK_COLORS } from '../ldraw-car/ldraw-brick-colors.ts'
import {
  createChassisFallbackText,
  getChassisTriangles,
} from '../ldraw-chassis/chassis-fallback.ts'
import { CHAMPION_CAR_CODES, CHASSIS_NAMES } from '../ldraw-racer-model/known-racer-models.ts'
import { loadChampionBodyFaces } from './champion-body-faces.ts'
import {
  getChassisOrigin,
  getChassisReferenceLine,
  getReferenceNumber,
} from './chassis-reference-line.ts'
import { CONVENTION_MARKERS, getConventionTestText } from './convention-test-model.ts'
import { countLDrawColors, parseBrickColorNames } from './ldraw-color-names.ts'
import { createReferenceSheet, getModelExtent } from './orthographic-sheet.ts'
import type { LDrawColorName, ReferenceFaces, WheelMount } from './reference-kit.types.ts'
import { getWheelMounts } from './wheel-mounts.ts'

const DEFAULT_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const LDRAW_UNITS_PER_STUD = 20
const STUDS_PER_PLATE = 0.4
const PLATES_PER_BRICK = 3
const PLACED_COLOR_CODE = 16
const CHASSIS_GREY = 0x9ba19d
const BYTE = 255
const FALLBACK_FOLDER = '_fallback'

const getNumber = getReferenceNumber

const getHex = (red: number, green: number, blue: number): string =>
  `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`

const getDimensionText = (faces: ReferenceFaces): string => {
  const [length = 0, width = 0, height = 0] = getModelExtent(faces)
  return (
    `length ${getNumber(length)} studs, width ${getNumber(width)} studs, height ${getNumber(height)} studs ` +
    `(${getNumber(height / STUDS_PER_PLATE)} plates, ${getNumber(height / STUDS_PER_PLATE / PLATES_PER_BRICK)} bricks)`
  )
}

const getWheelText = (mounts: readonly WheelMount[]): readonly string[] =>
  mounts.map(
    (mount, index) =>
      `wheel ${String(index + 1)}: centre x ${getNumber(mount.centre[0])}, y ${getNumber(mount.centre[1])}, z ${getNumber(mount.centre[2])} studs; ` +
      `diameter ${getNumber(mount.radius * 2)} studs (${getNumber(mount.radius * 2 * LDRAW_UNITS_PER_STUD)} LDU), ` +
      `width ${getNumber(mount.width)} studs, axle along ${mount.axle}`
  )

const getColorLines = (faces: ReferenceFaces, palette: readonly LDrawColorName[]) =>
  countLDrawColors(faces, palette).map((color) => ({
    label: `${color.name} (${String(color.code)}): ${String(Math.round(color.share * 100))} %`,
    hex: getHex(color.red, color.green, color.blue),
  }))

// The triangles of a chassis part in the chassis recipe's frame (the footprint's corner, the brick's bottom), in studs, with the
// colours the game gives them.
const getChassisFaces = (
  archive: JamArchive,
  database: BrickDatabase,
  piece: BrickPiece
): ReferenceFaces => {
  const triangles = getChassisTriangles(archive, database, piece)
  const positions = triangles.flatMap(({ vertices }) =>
    vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z * STUDS_PER_PLATE])
  )
  const colors = triangles.flatMap(({ colorCode }) => {
    const hex =
      colorCode === PLACED_COLOR_CODE
        ? CHASSIS_GREY
        : (LDRAW_BRICK_COLORS.find((color) => color.code === colorCode)?.hex ?? CHASSIS_GREY)
    return [(hex >> 16) & BYTE, (hex >> 8) & BYTE, hex & BYTE]
  })
  return { positions: Float32Array.from(positions), colors: Uint8Array.from(colors) }
}

const run = () => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((argument) => argument !== '--'),
    options: {
      jam: { type: 'string' },
      out: { type: 'string' },
      ldraw: { type: 'string' },
    },
  })
  const out = values.out ?? join(homedir(), 'ldraw-models')
  const ldraw = values.ldraw ?? join(homedir(), 'ldraw')
  const archive = openJamArchive(new Uint8Array(readFileSync(values.jam ?? DEFAULT_JAM_PATH)))
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const palette = parseBrickColorNames(readFileSync(join(ldraw, 'LDConfig.ldr'), 'utf8'))
  const reference = join(out, 'reference')
  for (const folder of [join(reference, 'chassis'), join(out, 'chassis', FALLBACK_FOLDER)]) {
    mkdirSync(folder, { recursive: true })
  }
  const champions = readRacerDatabases((path) => archive.readFile(path)).champions.champions
  const codes = champions.map((champion) => champion.modelName.toUpperCase())
  if (
    CHAMPION_CAR_CODES.some((code) => !codes.includes(code)) ||
    codes.length !== CHAMPION_CAR_CODES.length
  ) {
    throw new Error(`CHAMPS.CCB lists ${codes.join(' ')}; known-racer-models.ts has other codes`)
  }

  for (const champion of champions) {
    const code = champion.modelName.toUpperCase()
    const faces = loadChampionBodyFaces(archive, {
      textureDatabaseName: champion.textureDatabaseName,
      materialLibraryName: champion.materialLibraryName,
      modelName: champion.modelName,
      skeletonName: '',
      animationName: '',
    })
    const chassis = findBrickPieceByName(database, champion.chassisName)
    const mounts = getWheelMounts(archive, champion.chassisName)
    const lines = [
      `Car ${code} (champion ${champion.name}), frame: x forward, y left, z up, studs; the origin is the red cross.`,
      `Body: ${getDimensionText(faces)}.`,
      `Chassis ${champion.chassisName}${chassis === null ? '' : `, reference line for the chassis recipe: ${getChassisReferenceLine(database, chassis)}`}`,
      ...getWheelText(mounts),
    ]
    const colorLines = getColorLines(faces, palette)
    writeFileSync(
      join(reference, `${code}.svg`),
      createReferenceSheet({ title: code, lines, faces, wheelMounts: mounts, colorLines })
    )
    writeFileSync(
      join(reference, `${code}.txt`),
      [...lines, ...colorLines.map(({ label }) => label), ''].join('\n')
    )
  }

  for (const name of CHASSIS_NAMES) {
    const piece = findBrickPieceByName(database, name)
    if (piece === null) throw new Error(`The brick database has no chassis ${name}`)
    const faces = getChassisFaces(archive, database, piece)
    const origin = getChassisOrigin(database, piece)
    const mounts = getWheelMounts(archive, name).map((mount): WheelMount => ({
      ...mount,
      centre: [
        mount.centre[0] - origin[0],
        mount.centre[1] - origin[1],
        mount.centre[2] - origin[2],
      ],
    }))
    const lines = [
      `Chassis ${piece.name} (footprint ${String(piece.footprint.width)} x ${String(piece.footprint.height)} studs), recipe frame: the footprint's corner is the origin, x along the width, y along the depth, z up from the brick's bottom, studs.`,
      `Size: ${getDimensionText(faces)}.`,
      `The car's origin lies at x ${getNumber(origin[0])}, y ${getNumber(origin[1])}, z ${getNumber(origin[2])} studs from this corner; a car model places the recipe with: ${getChassisReferenceLine(database, piece)}`,
      ...getWheelText(mounts),
    ]
    const colorLines = getColorLines(faces, palette)
    writeFileSync(
      join(reference, 'chassis', `${name.toUpperCase()}.svg`),
      createReferenceSheet({ title: piece.name, lines, faces, wheelMounts: mounts, colorLines })
    )
    writeFileSync(
      join(reference, 'chassis', `${name.toUpperCase()}.txt`),
      [...lines, ...colorLines.map(({ label }) => label), ''].join('\n')
    )
    writeFileSync(
      join(out, 'chassis', FALLBACK_FOLDER, `${name.toUpperCase()}.dat`),
      createChassisFallbackText(archive, database, piece)
    )
  }

  writeFileSync(join(out, '_convention-test.ldr'), getConventionTestText())
  copyFileSync(resolve(import.meta.dirname, 'ldraw-models-readme.md'), join(out, 'README.md'))
  process.stdout.write(
    `Wrote ${String(champions.length)} car sheets, ${String(CHASSIS_NAMES.length)} chassis sheets, ${String(CONVENTION_MARKERS.length)} test markers into ${out}\n`
  )
}

run()

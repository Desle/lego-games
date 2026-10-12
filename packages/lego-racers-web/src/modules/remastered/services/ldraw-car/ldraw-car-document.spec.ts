import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BRICK_DATABASE_PATH,
  createBuildGrid,
  DEFAULT_SAVE_PATH,
  loadSavedCars,
  parseBrickDatabase,
  QUICK_BUILD_SAVE_PATH,
} from '@lego-games/lego-racers/car-builder'
import type { BrickPiece, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { LDRAW_BRICK_COLORS } from './ldraw-brick-colors.ts'
import { LDRAW_BRICK_MAPPINGS, UNMAPPED_BRICK_REASONS } from './ldraw-brick-mappings.ts'
import { LDRAW_COMPOSITE_MAPPINGS } from './ldraw-composite-mappings.ts'
import { createLDrawCarDocument } from './ldraw-car-document.ts'

const JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const isPresent = existsSync(JAM_PATH)
const ORIGIN = { x: 0, y: 0, z: 0 }
const RED_COLOR_INDEX = 5

const getPiece = (name: string, width: number, height: number): BrickPiece => ({
  name,
  id: 0x1389,
  footprint: { width, height, cells: new Uint8Array(width * height * 2), originVertexIndex: 0 },
  faceRecordCount: 0,
  geometryOffset: 0,
  variantIndex: 0,
  variantCount: 1,
})

const getBrick = (piece: BrickPiece, placement: Partial<PlacedBrick>): PlacedBrick => ({
  piece,
  x: 0,
  y: 0,
  orientation: 0,
  colorIndex: RED_COLOR_INDEX,
  unidentifiedValue: 0,
  baseHeight: 0,
  ...placement,
})

describe('createLDrawCarDocument', () => {
  it('places a 2 x 2 brick two studs along x and one along y as an LDraw line in LDraw axes', () => {
    // Arrange
    const design = {
      bricks: [getBrick(getPiece('L300300', 2, 2), { x: 2, y: 1 })],
      grid: createBuildGrid(),
    }

    // Act
    const { text } = createLDrawCarDocument(design, ORIGIN)

    // Assert
    expect(text).toBe('1 4 60 -24 40 1 0 0 0 1 0 0 0 1 3003.dat')
  })

  it('lifts a brick by its resting height in plates and turns it about the footprint corner', () => {
    // Arrange
    const design = {
      bricks: [getBrick(getPiece('L300300', 2, 2), { baseHeight: 3, orientation: 1 })],
      grid: createBuildGrid(),
    }

    // Act
    const { text } = createLDrawCarDocument(design, ORIGIN)

    // Assert
    expect(text).toBe('1 4 20 -48 20 0 0 1 0 1 0 -1 0 0 3003.dat')
  })

  it('lists the bricks without an LDraw part instead of dropping them', () => {
    // Arrange
    const unknown = getBrick(getPiece('NoSuchBrick', 1, 1), {})
    const design = { bricks: [unknown], grid: createBuildGrid() }

    // Act
    const document = createLDrawCarDocument(design, ORIGIN)

    // Assert
    expect([document.text, document.unmappedBricks]).toEqual(['', [unknown]])
  })

  it('draws a composite brick as its base brick and its accessory, the accessory in its own colour', () => {
    // Arrange
    const design = { bricks: [getBrick(getPiece('sLance', 2, 9), {})], grid: createBuildGrid() }

    // Act
    const { text, unmappedBricks } = createLDrawCarDocument(design, ORIGIN)

    // Assert
    expect([text.split('\n').map((line) => line.split(' ').at(-1)), unmappedBricks]).toEqual([
      ['3849.dat', '3070b.dat'],
      [],
    ])
  })

  it('moves every brick by the origin of the car', () => {
    // Arrange
    const design = { bricks: [getBrick(getPiece('L300300', 2, 2), {})], grid: createBuildGrid() }

    // Act
    const { text } = createLDrawCarDocument(design, { x: -1, y: 0.5, z: 0.4 })

    // Assert
    expect(text).toBe('1 4 0 -32 30 1 0 0 0 1 0 0 0 1 3003.dat')
  })
})

describe('the brick colours', () => {
  it('names an LDraw colour for each of the ten colours of L_COLORS.LEB', () => {
    // Arrange / Act
    const codes = LDRAW_BRICK_COLORS.map((color) => color.code)

    // Assert
    expect(codes).toEqual([0, 15, 19, 7, 8, 4, 6, 14, 2, 1])
  })
})

describe.skipIf(!isPresent)('the brick mapping against the original files', () => {
  const archive = isPresent ? openJamArchive(new Uint8Array(readFileSync(JAM_PATH))) : null
  const readFile = (path: string): Uint8Array => {
    if (archive === null) throw new Error('The original files are missing')
    return archive.readFile(path)
  }

  it('accounts for every brick of the database as mapped or unmapped, and names only bricks that exist', () => {
    // Arrange
    const names = parseBrickDatabase(readFile(BRICK_DATABASE_PATH)).pieces.map(
      (piece) => piece.name
    )

    // Act
    const unaccounted = names.filter(
      (name) =>
        !(name in LDRAW_BRICK_MAPPINGS) &&
        !(name in LDRAW_COMPOSITE_MAPPINGS) &&
        !(name in UNMAPPED_BRICK_REASONS)
    )
    const unknown = [
      ...Object.keys(LDRAW_BRICK_MAPPINGS),
      ...Object.keys(LDRAW_COMPOSITE_MAPPINGS),
      ...Object.keys(UNMAPPED_BRICK_REASONS),
    ].filter((name) => !names.includes(name))

    // Assert
    expect([unaccounted, unknown]).toEqual([[], []])
  })

  it('converts every saved design, each brick to at least a line or to the unmapped list', () => {
    // Arrange
    const cars = [DEFAULT_SAVE_PATH, QUICK_BUILD_SAVE_PATH].flatMap((path) =>
      loadSavedCars(readFile, path)
    )

    // Act
    const counts = cars.flatMap((car) => {
      if (car.design === null) return []
      const { text, unmappedBricks } = createLDrawCarDocument(car.design, ORIGIN)
      const lineCount = text === '' ? 0 : text.split('\n').length
      return [lineCount + unmappedBricks.length - car.design.bricks.length]
    })

    // Assert
    expect([cars.length, counts.every((difference) => difference >= 0)]).toEqual([28, true])
  })
})

import { openJamArchive } from '../../../jam-archive/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { getCarWeight } from '../get-car-weight/get-car-weight.ts'
import { parseBrickDatabase } from '../parse-brick-database/parse-brick-database.ts'
import { parseBrickColors } from '../parse-brick-colors/parse-brick-colors.ts'
import { parseCarSet, parseCarSetFileNames } from '../parse-car-sets/parse-car-sets.ts'
import {
  BRICK_DATABASE_PATH,
  DEFAULT_SAVE_PATH,
  loadSavedCars,
  QUICK_BUILD_SAVE_PATH,
} from './load-saved-cars.ts'

const isPresent = getIsOriginalJamPresent()
const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)

describe.skipIf(!isPresent)('the car builder on the original files', () => {
  const archive = isPresent ? openJamArchive(readOriginalJam()) : null
  const readFile = (path: string): Uint8Array => {
    if (archive === null) throw new Error('The original files are missing')
    return archive.readFile(path)
  }

  it('reads the brick database: 161 pieces, the chassis parts below 0x800 and the bricks above', () => {
    // Arrange / Act
    const database = parseBrickDatabase(readFile(BRICK_DATABASE_PATH))

    // Assert
    expect(database.pieces).toHaveLength(161)
    expect(database.pieces.filter((piece) => piece.id < 0x800)).toHaveLength(12)
    const dachas = database.pieces.find((piece) => piece.id === 0x11)
    expect(dachas?.footprint).toMatchObject({ width: 10, height: 6 })
    expect(dachas?.footprint.originVertexIndex).toBe(0x6ca)
    expect(database.faceWords).toHaveLength(29057)
    expect(database.positions).toHaveLength(2000 * 3)
  })

  it('names the ten brick colours in the order a design counts them', () => {
    // Arrange / Act
    const colors = parseBrickColors(readFile('MENUDATA\\PIECEDB\\L_COLORS.LEB'))

    // Assert
    expect(colors.map((color) => color.name)).toEqual([
      'black',
      'white',
      'biege',
      'ltgray',
      'dkgray',
      'red',
      'brown',
      'yellow',
      'green',
      'blue',
    ])
  })

  it('reads the twelve car sets with the bricks and colours they offer', () => {
    // Arrange
    const database = parseBrickDatabase(readFile(BRICK_DATABASE_PATH))
    const colors = parseBrickColors(readFile('MENUDATA\\PIECEDB\\L_COLORS.LEB'))

    // Act
    const names = parseCarSetFileNames(readFile('MENUDATA\\PIECEDB\\CRSTMGR.LEB'))
    const set = parseCarSet(readFile('MENUDATA\\PIECEDB\\DP_CSET.LEB'), database, colors)

    // Assert
    expect(names).toHaveLength(12)
    expect(names[0]).toBe('dp_cset.leg')
    expect(set.chassisName).toBe('ddchas0')
    expect(set.bricks).toHaveLength(30)
    expect(set.bricks[0]).toMatchObject({ pieceName: 'l300300', colorName: 'blue', colorIndex: 9 })
    expect(set.bricks.every((brick) => brick.pieceId >= 0x800)).toBe(true)
  })

  it('places every brick of every saved car, as the builder would', () => {
    // Arrange / Act
    const saves = [DEFAULT_SAVE_PATH, QUICK_BUILD_SAVE_PATH].map((path) =>
      loadSavedCars(readFile, path)
    )

    // Assert
    expect(saves.map((cars) => cars.length)).toEqual([4, 24])
    for (const car of saves.flat()) {
      const declared = ((car.record.designBytes[0] ?? 0) << 8) | (car.record.designBytes[1] ?? 0)
      expect(car.design?.bricks).toHaveLength(declared)
    }
  })

  it('weighs the default car: 214 unit cells, centred near the middle of the grid', () => {
    // Arrange
    const [car] = loadSavedCars(readFile, DEFAULT_SAVE_PATH)

    // Act
    const weight =
      car?.design === null || car === undefined ? null : getCarWeight(arithmetic, car.design)

    // Assert
    expect(car?.record.name).toBe('JOAN OF KART')
    expect(car?.record.chassisName).toBe('dachas0')
    expect(weight?.weight).toBe(214)
    expect(weight?.centreOffsetX).toBeCloseTo(-0.8178, 3)
    expect(weight?.centreOffsetY).toBeCloseTo(-0.0935, 3)
  })
})

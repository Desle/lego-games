import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createBuildGrid } from '@lego-games/lego-racers/car-builder'
import type { BrickPiece, CarDesign, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import { PLATE_HEIGHT, STUD_WIDTH, createPartStudLists } from '@lego-games/ldraw/building'
import { createDiskLibraryReader } from '../ldraw-library/disk-library-reader.ts'
import { loadDesignChassisDeck, loadRecipeStudBases } from './chassis-deck-loader.ts'
import type { ChassisDeck, StudBase } from './chassis-deck.types.ts'
import { getDeckRestedDesign } from './deck-rested-design.ts'

const ATTACHABLE = 0x80
const CONNECTOR = 0x80
const BRICK_PLATES = 3
const CELL_ON_STUD_DISTANCE = 5
const CHASSIS_NAME = 'testchas'
const IDENTITY = '1 0 0 0 1 0 0 0 1'

// A 1 x 1 plate with its stud, a 2 x 1 tile without one, and a tall steering wheel without studs (3829c01 has none).
const FIXTURE_FILES: Readonly<Record<string, string>> = {
  'plate.dat': `1 16 0 0 0 ${IDENTITY} stud.dat\n1 16 0 8 0 ${IDENTITY} box5.dat`,
  'wheel.dat': `1 16 0 -40 0 ${IDENTITY} box5.dat`,
}
const fixtureStudLists = createPartStudLists((name) => Promise.resolve(FIXTURE_FILES[name] ?? null))

const createPiece = (name: string, id: number, width: number, cells: number[]): BrickPiece =>
  Object.freeze({
    name,
    id,
    footprint: Object.freeze({
      width,
      height: 1,
      cells: Uint8Array.from(cells),
      originVertexIndex: 0,
    }),
    faceRecordCount: 0,
    geometryOffset: 0,
    variantIndex: 0,
    variantCount: 1,
  })

// A 10 x 6 game chassis whose cells are all attachable 3 plates up.
const chassisPiece: BrickPiece = Object.freeze({
  ...createPiece(CHASSIS_NAME, 11, 10, []),
  footprint: Object.freeze({
    width: 10,
    height: 6,
    cells: Uint8Array.from(Array.from({ length: 60 }, () => [ATTACHABLE | 3, 0]).flat()),
    originVertexIndex: 0,
  }),
})
const brickPiece = createPiece('brick', 0x800, 1, [ATTACHABLE | BRICK_PLATES, CONNECTOR])
const longBrickPiece = createPiece('long', 0x801, 2, [
  ATTACHABLE | BRICK_PLATES,
  CONNECTOR,
  ATTACHABLE | BRICK_PLATES,
  CONNECTOR,
])

const place = (piece: BrickPiece, x: number, y: number, baseHeight: number): PlacedBrick =>
  Object.freeze({ piece, x, y, orientation: 0, colorIndex: 0, unidentifiedValue: 0, baseHeight })

const createDesign = (bricks: readonly PlacedBrick[]): CarDesign =>
  Object.freeze({ bricks, grid: createBuildGrid() })

const chassis = place(chassisPiece, 0, 0, 0)

// Where a brick's bottom is drawn, in the recipe's LDraw axes (y down): the grid offset moves every built brick.
const getBottom = (deck: ChassisDeck, brick: PlacedBrick): number =>
  deck.gridOffset.y - (brick.baseHeight - chassis.baseHeight) * PLATE_HEIGHT

const getCell = (deck: ChassisDeck, stud: StudBase) => ({
  x: Math.floor((stud.x - deck.gridOffset.x) / STUD_WIDTH),
  y: Math.floor((stud.z - deck.gridOffset.z) / STUD_WIDTH),
})

const getIsOnCellCentre = (deck: ChassisDeck, stud: StudBase): boolean => {
  const cell = getCell(deck, stud)
  return (
    Math.abs((cell.x + 0.5) * STUD_WIDTH + deck.gridOffset.x - stud.x) <= CELL_ON_STUD_DISTANCE &&
    Math.abs((cell.y + 0.5) * STUD_WIDTH + deck.gridOffset.z - stud.z) <= CELL_ON_STUD_DISTANCE
  )
}

// For every stud over the grid: a brick dropped there from high up, and one on it, rested on the recipe; the bottom of each, and the
// stud base under the first (the highest one in its cell), in LDU.
const getRestedBottoms = async (
  recipe: string,
  studLists: ReturnType<typeof createPartStudLists>
) => {
  const chassisModels = new Map([[CHASSIS_NAME, recipe]])
  const deck = await loadDesignChassisDeck(createDesign([chassis]), chassisModels, studLists)
  if (deck === null) return null
  const studs = await loadRecipeStudBases(recipe, studLists)
  return studs
    .filter((stud) => getIsOnCellCentre(deck, stud))
    .map((stud) => {
      const cell = getCell(deck, stud)
      const isInGrid = cell.x >= 0 && cell.x < 10 && cell.y >= 0 && cell.y < 6
      const studBase = studs
        .filter((other) => getIsOnCellCentre(deck, other))
        .filter((other) => {
          const otherCell = getCell(deck, other)
          return otherCell.x === cell.x && otherCell.y === cell.y
        })
        .reduce((highest, other) => Math.min(highest, other.y), Infinity)
      const rested = getDeckRestedDesign(
        createDesign([
          chassis,
          place(brickPiece, cell.x, cell.y, 40),
          place(brickPiece, cell.x, cell.y, 50),
        ]),
        deck
      )
      const [, first, second] = rested.bricks
      return {
        isInGrid,
        studBase,
        first: first === undefined ? null : getBottom(deck, first),
        second: second === undefined ? null : getBottom(deck, second),
      }
    })
    .filter((bottoms) => bottoms.isInGrid)
}

const getPlateLines = (xs: readonly number[], zs: readonly number[], y: number): string[] =>
  xs.flatMap((x) =>
    zs.map((z) => `1 16 ${String(x)} ${String(y)} ${String(z)} ${IDENTITY} plate.dat`)
  )

const DECK_XS = [40, 60, 80, 100, 120, 140, 160]
const DECK_ZS = [40, 60, 80]

describe('chassis deck', () => {
  it.each([
    ['a thin plate deck', getPlateLines(DECK_XS, DECK_ZS, -8)],
    [
      'a raised deck under a tall steering wheel',
      [...getPlateLines(DECK_XS, DECK_ZS, -40), `1 16 100 -40 60 ${IDENTITY} wheel.dat`],
    ],
    [
      'a two-level deck',
      [
        ...getPlateLines([40, 60, 80], DECK_ZS, -16),
        ...getPlateLines([100, 120, 140, 160], DECK_ZS, -40),
      ],
    ],
    [
      'a deck of studs stacked on studs',
      [...getPlateLines(DECK_XS, DECK_ZS, -16), ...getPlateLines([100, 120], [60], -24)],
    ],
  ])('rests every brick of %s on the stud base under it', async (_name, lines) => {
    // Arrange
    const recipe = lines.join('\n')

    // Act
    const bottoms = await getRestedBottoms(recipe, fixtureStudLists)

    // Assert
    expect(bottoms?.length).toBeGreaterThan(0)
    for (const { studBase, first, second } of bottoms ?? []) {
      expect(first).toBe(studBase)
      expect(second).toBe(studBase - BRICK_PLATES * PLATE_HEIGHT)
    }
  })

  it('rests a brick over two levels on the higher one', async () => {
    // Arrange
    const recipe = [
      ...getPlateLines([40, 60, 80], DECK_ZS, -16),
      ...getPlateLines([100, 120], DECK_ZS, -40),
    ].join('\n')
    const deck = await loadDesignChassisDeck(
      createDesign([chassis]),
      new Map([[CHASSIS_NAME, recipe]]),
      fixtureStudLists
    )
    const cellX = Math.floor((80 - (deck?.gridOffset.x ?? 0)) / STUD_WIDTH)
    const cellY = Math.floor((60 - (deck?.gridOffset.z ?? 0)) / STUD_WIDTH)

    // Act
    const rested =
      deck === null
        ? null
        : getDeckRestedDesign(
            createDesign([chassis, place(longBrickPiece, cellX, cellY, 40)]),
            deck
          )
    const brick = rested?.bricks[1]

    // Assert
    expect(deck === null || brick === undefined ? null : getBottom(deck, brick)).toBe(-40)
  })

  it('has no deck for a recipe without studs', async () => {
    // Arrange
    const recipe = `1 16 100 -40 60 ${IDENTITY} wheel.dat`

    // Act
    const deck = await loadDesignChassisDeck(
      createDesign([chassis]),
      new Map([[CHASSIS_NAME, recipe]]),
      fixtureStudLists
    )

    // Assert
    expect(deck).toBeNull()
  })
})

// The player's own recipes and library: this runs only where they are.
const libraryRoot = process.env['LEGO_LDRAW_ROOT'] ?? join(homedir(), 'ldraw')
const chassisFolder = join(
  process.env['LEGO_LDRAW_MODELS_ROOT'] ?? join(homedir(), 'ldraw-models'),
  'chassis'
)
const getIsBuilt = (name: string): boolean =>
  readFileSync(join(chassisFolder, name), 'utf8')
    .split('\n')
    .some((line) => line.trimStart().startsWith('1 '))

// A recipe still empty in the builder is unfinished, not misplaced.
const recipeNames = existsSync(chassisFolder)
  ? readdirSync(chassisFolder).filter(
      (name) => name.toLowerCase().endsWith('.ldr') && getIsBuilt(name)
    )
  : []

describe.skipIf(recipeNames.length === 0 || !existsSync(join(libraryRoot, 'parts')))(
  'chassis deck of the player recipes',
  () => {
    const libraryStudLists = createPartStudLists(createDiskLibraryReader(libraryRoot))

    it.each(recipeNames)('rests every brick of %s on the stud base under it', async (name) => {
      // Arrange
      const recipe = readFileSync(join(chassisFolder, name), 'utf8')

      // Act
      const bottoms = await getRestedBottoms(recipe, libraryStudLists)

      // Assert
      expect(bottoms?.length).toBeGreaterThan(0)
      for (const { studBase, first, second } of bottoms ?? []) {
        expect(first).toBeCloseTo(studBase, 3)
        expect(second).toBeCloseTo(studBase - BRICK_PLATES * PLATE_HEIGHT, 3)
      }
    })
  }
)

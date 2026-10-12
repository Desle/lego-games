import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BRICK_DATABASE_PATH,
  createBuildGrid,
  getCarOrigin,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import type { PlacedBrick } from '@lego-games/lego-racers/car-builder'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { Mesh, MeshPhysicalMaterial } from 'three'
import { getLDrawBrickColor } from './ldraw-brick-colors.ts'
import { createGameBrickMeshes } from './game-brick-meshes.ts'

const JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const isPresent = existsSync(JAM_PATH)
const BLACK_COLOR_INDEX = 0
const BLUE_COLOR_INDEX = 9

// The colours the game's mesh of one brick of the given colour is drawn with.
const getDrawnColors = (pieceName: string, colorIndex: number): readonly number[] => {
  const archive = openJamArchive(new Uint8Array(readFileSync(JAM_PATH)))
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const piece = database.pieces.find((candidate) => candidate.name === pieceName)
  if (piece === undefined) throw new Error(`${pieceName} is missing`)
  const brick: PlacedBrick = {
    piece,
    x: 0,
    y: 0,
    orientation: 0,
    colorIndex,
    unidentifiedValue: 0,
    baseHeight: 0,
  }
  const origin = getCarOrigin(database, { bricks: [brick], grid: createBuildGrid() })
  return createGameBrickMeshes(archive, database, [brick], origin).children.flatMap((child) =>
    child instanceof Mesh && child.material instanceof MeshPhysicalMaterial
      ? [child.material.color.getHex()]
      : []
  )
}

describe.skipIf(!isPresent)('the game bricks drawn in LDraw colours', () => {
  it('draws the black faces of a blue chassis black, as the original does', () => {
    // Arrange
    const expectedColor = getLDrawBrickColor(BLACK_COLOR_INDEX).hex

    // Act
    const colors = getDrawnColors('DACHAS0', BLUE_COLOR_INDEX)

    // Assert
    expect(colors).toContain(expectedColor)
  })

  it('keeps the brick colour for the faces the original paints with it', () => {
    // Arrange
    const expectedColors = [getLDrawBrickColor(BLUE_COLOR_INDEX).hex]

    // Act
    const colors = getDrawnColors('L300400', BLUE_COLOR_INDEX)

    // Assert
    expect(colors).toEqual(expectedColors)
  })
})

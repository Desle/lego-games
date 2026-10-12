import {
  BRICK_DATABASE_PATH,
  createBuildGrid,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, CarDesign, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { ModelResourceNames } from '@lego-games/lego-racers/racer-appearance'
import { createLDrawCarDrawing } from '../ldraw-car/ldraw-car-drawing.ts'
import type { LDrawCarDrawing } from '../ldraw-car/ldraw-car-drawing.types.ts'
import { createPlasticBodyDecalMeshes } from './body-decals.ts'
import { createBodyResidualMeshes } from './body-residual-meshes.ts'
import { loadChampionBodyFaces } from './champion-body-faces.ts'
import { createBoxPartLines } from './opponent-car-document.ts'
import { OPPONENT_CAR_DESIGNS } from './opponent-car-designs.ts'
import type { OpponentCarDesign } from './opponent-car.types.ts'

export const getOpponentCarDesign = (modelName: string): OpponentCarDesign | null =>
  OPPONENT_CAR_DESIGNS.find(
    (design) => design.modelName.toUpperCase() === modelName.toUpperCase()
  ) ?? null

const getCarDesign = (database: BrickDatabase, opponent: OpponentCarDesign): CarDesign => ({
  bricks: opponent.bricks.flatMap(
    ([pieceName, x, y, orientation, colorIndex, baseHeight]): readonly PlacedBrick[] => {
      const piece = database.pieces.find((candidate) => candidate.name === pieceName)
      return piece === undefined
        ? []
        : [{ piece, x, y, orientation, colorIndex, unidentifiedValue: 0, baseHeight }]
    }
  ),
  grid: createBuildGrid(),
})

// A champion's or opponent's car as LDraw bricks, in the frame of the body model the original draws (studs, z up): the rebuilt
// design of the model with the printed faces (logos, numbers) of the game's own textures on it. Null for a model with no design.
export const createOpponentCarDrawing = (
  archive: JamArchive,
  names: ModelResourceNames,
  isLDrawUsed = true
): LDrawCarDrawing | null => {
  const opponent = getOpponentCarDesign(names.modelName)
  if (opponent === null) return null
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const [x, y, z] = opponent.offset
  const drawing = createLDrawCarDrawing(
    { archive, design: getCarDesign(database, opponent) },
    isLDrawUsed,
    { origin: { x, y, z }, extraText: createBoxPartLines(opponent) }
  )
  const faces = loadChampionBodyFaces(archive, names)
  drawing.object.add(createBodyResidualMeshes(faces, opponent.coveredTriangles))
  drawing.object.add(createPlasticBodyDecalMeshes(faces.decals))
  return drawing
}

import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import { Mesh, Vector3 } from 'three'
import type { Group, Object3D } from 'three'
import { parseLDrawModel } from '../ldraw-library/ldraw-library-loader.ts'
import { getDeckStuds, getFootprintCoverage } from './chassis-footprint-coverage.ts'
import { loadDesignChassisDeck } from './chassis-deck-loader.ts'
import { getGridOffset, getStudAreaBounds } from './chassis-grid-offset.ts'
import type { ChassisFit, GridOffset } from './chassis-grid-offset.types.ts'

const NO_GRID_OFFSET: GridOffset = Object.freeze({ x: 0, y: 0, z: 0 })

const getIsMesh = (object: Object3D): object is Mesh => object instanceof Mesh

// Every vertex of the model's faces in the model's frame, as x, y, z in turn.
const getFacePositions = (model: Group): readonly number[] => {
  model.updateMatrixWorld(true)
  const positions: number[] = []
  const point = new Vector3()
  model.traverse((object) => {
    if (!getIsMesh(object)) return
    const attribute = object.geometry.getAttribute('position')
    for (let index = 0; index < attribute.count; index += 1) {
      point.fromBufferAttribute(attribute, index).applyMatrix4(object.matrixWorld)
      positions.push(point.x, point.y, point.z)
    }
  })
  return positions
}

// The grid offset of the design's chassis recipe, measured on the studs of the real base the recipe builds (recipes are keyed by
// the chassis part's name in lower case).
export const loadDesignGridOffset = async (
  design: CarDesign,
  chassisModels: ReadonlyMap<string, string>
): Promise<GridOffset> => {
  for (const brick of design.bricks) {
    const recipeText = chassisModels.get(brick.piece.name.toLowerCase())
    if (recipeText === undefined) continue
    const bounds = getStudAreaBounds(getFacePositions(await parseLDrawModel(recipeText)))
    return bounds === null ? NO_GRID_OFFSET : getGridOffset(brick.piece.footprint, bounds)
  }
  return NO_GRID_OFFSET
}

// How the design's chassis recipe holds the game's grid: the grid offset (on the recipe's upright studs when the library knows them) and the share of the chassis's building cells that land on a
// stud of the base's deck; null when the design has no chassis with a recipe.
export const loadChassisFit = async (
  design: CarDesign,
  chassisModels: ReadonlyMap<string, string>
): Promise<ChassisFit | null> => {
  for (const brick of design.bricks) {
    const recipeText = chassisModels.get(brick.piece.name.toLowerCase())
    if (recipeText === undefined) continue
    const positions = getFacePositions(await parseLDrawModel(recipeText))
    const bounds = getStudAreaBounds(positions)
    const deck = await loadDesignChassisDeck(design, chassisModels)
    const gridOffset =
      deck?.gridOffset ??
      (bounds === null ? NO_GRID_OFFSET : getGridOffset(brick.piece.footprint, bounds))
    return Object.freeze({
      gridOffset,
      footprintCoverage: getFootprintCoverage(
        brick.piece.footprint,
        gridOffset,
        getDeckStuds(positions)
      ),
    })
  }
  return null
}

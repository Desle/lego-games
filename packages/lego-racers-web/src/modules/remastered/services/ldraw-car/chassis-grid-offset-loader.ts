import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import { Mesh, Vector3 } from 'three'
import type { Group, Object3D } from 'three'
import { parseLDrawModel } from '../ldraw-library/ldraw-library-loader.ts'
import { getGridOffset, getStudAreaBounds } from './chassis-grid-offset.ts'
import type { GridOffset } from './chassis-grid-offset.types.ts'

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

import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import { Box3 } from 'three'
import { parseLDrawModel } from '../ldraw-library/ldraw-library-loader.ts'
import { getGridOffset } from './chassis-grid-offset.ts'
import type { GridOffset } from './chassis-grid-offset.types.ts'

const NO_GRID_OFFSET: GridOffset = Object.freeze({ x: 0, y: 0, z: 0 })

// The grid offset of the design's chassis recipe, measured on the real base the recipe builds (recipes are keyed by the
// chassis part's name in lower case).
export const loadDesignGridOffset = async (
  design: CarDesign,
  chassisModels: ReadonlyMap<string, string>
): Promise<GridOffset> => {
  for (const brick of design.bricks) {
    const recipeText = chassisModels.get(brick.piece.name.toLowerCase())
    if (recipeText === undefined) continue
    const bounds = new Box3().setFromObject(await parseLDrawModel(recipeText))
    if (bounds.isEmpty()) return NO_GRID_OFFSET
    return getGridOffset(brick.piece.footprint, {
      minimumX: bounds.min.x,
      maximumX: bounds.max.x,
      minimumY: bounds.min.y,
      minimumZ: bounds.min.z,
      maximumZ: bounds.max.z,
    })
  }
  return NO_GRID_OFFSET
}

import type { Sprite } from '../../../world/index.ts'
import { SceneLinkError } from '../../types/scene-errors/scene-errors.ts'
import type { SceneMaterialAssignment, SceneSprite } from '../../types/scene.types.ts'
import type { LinkedMaterials } from './load-scene.types.ts'

const MATERIAL_NAME_LENGTH = 8 // 0x1002d950 copies eight characters of the name (strncpy count 8)

// GolDP.dll 0x10017ac0 squares the distance (keyword 0x3c, default FLT_MAX) into a float: FLT_MAX squared overflows to
// infinity, so a sprite without a distance is always within range.
const getSquaredDistance = (distance: number): number => Math.fround(distance * distance)

// The material of a sprite: the entry of a material assignment (keyword 0x2b; the index is checked against the world's
// list, the entry is read when the sprite is drawn, 0x1002a020), else the named material of the chain.
const getMaterialIndex = (
  sprite: Sprite,
  linkedMaterials: LinkedMaterials,
  assignments: readonly SceneMaterialAssignment[]
): number | null => {
  if (sprite.materialAssignment !== null) {
    const assignment = assignments[sprite.materialAssignment.materialAssignmentIndex]
    if (assignment === undefined) throw new SceneLinkError('Illegal mat assign reference')
    return assignment.materialIndices[sprite.materialAssignment.entryIndex] ?? null
  }
  if (sprite.materialName === '') throw new SceneLinkError('Sprite is missing material name')
  const index = linkedMaterials.indexByName.get(sprite.materialName.slice(0, MATERIAL_NAME_LENGTH))
  if (index === undefined) {
    throw new SceneLinkError(`${sprite.materialName} sprite material not found`)
  }
  return index
}

// GolDP.dll 0x10017ac0 (the sprite loop at 0x10017ecf) gives each sprite object its material, size, position and axis.
export const linkSprites = (
  worldPath: string,
  sprites: readonly Sprite[],
  linkedMaterials: LinkedMaterials,
  worldAssignments: readonly SceneMaterialAssignment[]
): readonly SceneSprite[] =>
  Object.freeze(
    sprites.map((sprite) =>
      Object.freeze({
        worldPath,
        materialIndex: getMaterialIndex(sprite, linkedMaterials, worldAssignments),
        position: sprite.position,
        axis: sprite.keyword38Vector,
        width: sprite.keyword3aValue,
        height: sprite.keyword3bValue,
        squaredDistance: getSquaredDistance(sprite.keyword3cValue),
      })
    )
  )

import type { BspTreeInstance, MeshInstance, WorldInstance } from '../../../world/index.ts'
import { getInstanceRotation } from '../../types/instance-rotation/instance-rotation.ts'
import { SceneInstanceKind } from '../../types/scene-enums/scene-enums.ts'
import { SceneLinkError } from '../../types/scene-errors/scene-errors.ts'
import type {
  SceneInstance,
  SceneInstanceKind as SceneInstanceKindValue,
  SceneInstanceLevel,
} from '../../types/scene.types.ts'
import type { InstanceLevelInput, SceneCounts, SortedLevel } from './link-instances.types.ts'

const MAXIMUM_LEVELS = 3
// 0x10057330 and 0x100576e4: FLT_MAX.
const LARGEST_FLOAT = 3.4028234663852886e38

// GolDP.dll 0x1002e640: a distance below FLT_MAX is squared, else stays FLT_MAX.
const getSquaredDistance = (distance: number): number =>
  distance < LARGEST_FLOAT ? Math.fround(distance * distance) : LARGEST_FLOAT

// GolDP.dll 0x10027c50: a later level is inserted before the first stored level with a larger distance,
// shifting the rest up; slot 0 is set first by the instance's vtable +0x50.
const getInsertedLevels = (
  levels: readonly SortedLevel[],
  level: SortedLevel
): readonly SortedLevel[] => {
  const insertAt = levels.findIndex(
    (stored, index) => index < MAXIMUM_LEVELS - 1 && level.squaredDistance < stored.squaredDistance
  )
  return insertAt < 0
    ? [...levels, level]
    : [...levels.slice(0, insertAt), level, ...levels.slice(insertAt)]
}

const getMaterialAssignmentIndex = (index: number | undefined, counts: SceneCounts) => {
  if (index === undefined || index < 0) return null
  if (counts.materialAssignmentCount <= index) {
    throw new SceneLinkError('Illegal alt mat assign ref val')
  }
  return counts.materialAssignmentOffset + index
}

// GolDP.dll 0x1002e640 for one mesh or BSP tree instance. Levels stop at the first negative mesh index; the
// material assignment of slot i stays with slot i when the levels are reordered (only the models and
// distances move).
const getLinkedInstance = <Level extends InstanceLevelInput>(
  instance: WorldInstance<Level>,
  kind: SceneInstanceKindValue,
  counts: SceneCounts
): SceneInstance => {
  const firstMeshIndex = instance.levels[0]?.meshIndex ?? -1
  if (counts.meshCount <= firstMeshIndex >>> 0) throw new SceneLinkError('Illegal mesh reference')
  const presentLevels = instance.levels.slice(0, MAXIMUM_LEVELS)
  const firstMissing = presentLevels.findIndex((level) => level.meshIndex < 0)
  const usedLevels = firstMissing < 0 ? presentLevels : presentLevels.slice(0, firstMissing)
  const materialAssignmentIndices = usedLevels.map((_level, index) =>
    getMaterialAssignmentIndex(instance.materialAssignmentIndices[index], counts)
  )
  const sortedLevels = usedLevels
    .map((level) =>
      Object.freeze({
        meshIndex: level.meshIndex,
        squaredDistance: getSquaredDistance(level.distance),
      })
    )
    .reduce<readonly SortedLevel[]>(
      (levels, level, index) => (index === 0 ? [level] : getInsertedLevels(levels, level)),
      []
    )
  const levels: readonly SceneInstanceLevel[] = sortedLevels.map((level, index) =>
    Object.freeze({
      meshIndex: counts.meshOffset + level.meshIndex,
      materialAssignmentIndex: materialAssignmentIndices[index] ?? null,
      squaredDistance: level.squaredDistance,
    })
  )
  return Object.freeze({
    name: instance.name,
    kind,
    levels: Object.freeze(levels),
    position: instance.position,
    rotation: getInstanceRotation(instance.forward, instance.up),
  })
}

export const linkMeshInstances = (
  instances: readonly MeshInstance[],
  counts: SceneCounts
): readonly SceneInstance[] =>
  instances.map((instance) => getLinkedInstance(instance, SceneInstanceKind.MESH, counts))

// BSP tree instances also check their tree index ("Illegal bsp tree reference").
export const linkBspTreeInstances = (
  instances: readonly BspTreeInstance[],
  counts: SceneCounts
): readonly SceneInstance[] =>
  instances.map((instance) => {
    const bspTreeIndex = instance.levels[0]?.bspTreeIndex ?? -1
    const linked = getLinkedInstance(instance, SceneInstanceKind.BSP_TREE, counts)
    if (counts.bspTreeCount <= bspTreeIndex >>> 0) {
      throw new SceneLinkError('Illegal bsp tree reference')
    }
    return linked
  })
